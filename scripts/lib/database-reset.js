import pg from "pg";
import { runner } from "node-pg-migrate";
import { fileURLToPath } from "node:url";

export const migrationDirectory = fileURLToPath(
  new URL("../../migrations/", import.meta.url),
);
const suffixes = { development: "dev", test: "test", e2e: "e2e" };
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';

export function resetTarget(config, confirmation) {
  const suffix = suffixes[config.APP_ENV];
  if (!suffix || !Object.hasOwn(suffixes, config.APP_ENV))
    throw new Error("Entorno no permitido.");
  const database = `refind_${suffix}`;
  const role = `${database}_user`;
  let url;
  try {
    url = new URL(config.DATABASE_URL);
  } catch {
    throw new Error("URL de base de datos incorrecta.");
  }
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.search ||
    url.hash ||
    url.pathname !== `/${database}` ||
    decodeURIComponent(url.username) !== role ||
    !url.password
  ) {
    throw new Error("Destino de reinicio no permitido.");
  }
  if (confirmation !== database)
    throw new Error(`Indicar --confirm ${database}.`);
  return { database, role, port: Number(url.port || 5432) };
}

export function parseResetArguments(args) {
  if (
    args.length !== 3 ||
    args[1] !== "--confirm" ||
    !Object.hasOwn(suffixes, args[0])
  ) {
    throw new Error(
      "Uso: npm run db:reset -- development|test|e2e --confirm refind_dev|refind_test|refind_e2e",
    );
  }
  return { mode: args[0], confirmation: args[2] };
}

export async function checkResetConnection(client, target) {
  const {
    rows: [identity],
  } = await client.query(`SELECT current_database() AS db,
    current_user AS role, session_user AS session_role, inet_server_addr()::text AS host,
    inet_server_port() AS port, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
    pg_get_userbyid(d.datdba) AS owner FROM pg_roles r JOIN pg_database d
    ON d.datname=current_database() WHERE r.rolname=current_user`);
  if (
    !identity ||
    identity.db !== target.database ||
    identity.role !== target.role ||
    identity.session_role !== target.role ||
    (identity.host !== "127.0.0.1/32" && identity.host !== "127.0.0.1") ||
    identity.port !== target.port ||
    identity.owner !== target.role ||
    identity.rolsuper ||
    identity.rolcreatedb ||
    identity.rolcreaterole
  ) {
    throw new Error(
      "Identidad real, propietario o privilegios incompatibles con el reinicio.",
    );
  }
  const { rows } = await client.query(
    `SELECT datname,
    has_database_privilege(current_user,oid,'CONNECT') AS allowed FROM pg_database
    WHERE datname=ANY($1::text[])`,
    [["refind_dev", "refind_test", "refind_e2e"]],
  );
  if (
    rows.length !== 3 ||
    rows.some((r) => r.allowed !== (r.datname === target.database))
  ) {
    throw new Error("Las tres bases no están aisladas.");
  }
  await assertIdle(client);
}

async function assertIdle(client) {
  const {
    rows: [row],
  } =
    await client.query(`SELECT count(*)::int AS connections FROM pg_stat_activity
    WHERE datname=current_database() AND pid<>pg_backend_pid()`);
  if (row.connections)
    throw new Error(
      "Base ocupada: cerrar servidores, pruebas y conexiones de pgAdmin.",
    );
}

export async function applyMigrations(
  client,
  { dir = migrationDirectory, count = Infinity } = {},
) {
  return runner({
    dbClient: client,
    dir,
    count,
    direction: "up",
    checkOrder: true,
    migrationsTable: "pgmigrations",
    singleTransaction: true,
    log: () => {},
  });
}

/** Conserva la transacción exterior: node-pg-migrate controla un savepoint. */
function migrationSavepoint(client) {
  return {
    query(sql, values) {
      const commands = {
        BEGIN: "SAVEPOINT refind_migrations",
        COMMIT: "RELEASE SAVEPOINT refind_migrations",
        ROLLBACK: "ROLLBACK TO SAVEPOINT refind_migrations",
      };
      if (typeof sql === "string" && Object.hasOwn(commands, sql))
        return client.query(commands[sql]);
      // Las migraciones sin transacción romperían la atomicidad del reinicio.
      if (
        typeof sql === "string" &&
        /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/i.test(sql)
      ) {
        throw new Error("El reinicio requiere migraciones transaccionales.");
      }
      return client.query(sql, values);
    },
  };
}

export async function rebuildDatabase(
  config,
  confirmation,
  { dir = migrationDirectory } = {},
) {
  const target = resetTarget(config, confirmation);
  const client = new pg.Client({
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    application_name: "refind-reset",
  });
  let phase = "conexión";
  try {
    await client.connect();
    phase = "verificación";
    await checkResetConnection(client, target);
    await client.query("BEGIN");
    await client.query(
      "SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'",
    );
    const {
      rows: [lock],
    } = await client.query(
      "SELECT pg_try_advisory_xact_lock(740401) AS acquired",
    );
    if (!lock.acquired) throw new Error("Otro reinicio está en curso.");
    const { rows: schemas } =
      await client.query(`SELECT nspname FROM pg_namespace
      WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('public','information_schema')`);
    if (schemas.length)
      throw new Error(
        "Hay esquemas ajenos a public; revisar antes de reiniciar.",
      );
    const {
      rows: [schema],
    } = await client.query(`SELECT pg_get_userbyid(nspowner) AS owner,
      nspacl IS NULL AS default_acl FROM pg_namespace WHERE nspname='public'`);
    if (!schema) throw new Error("Falta el esquema public.");
    const { rows: grants } =
      await client.query(`SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC'
      ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
      FROM pg_namespace n, LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a
      WHERE n.nspname='public'`);
    phase = "reconstrucción";
    await client.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION ${quote(schema.owner)};
      REVOKE ALL ON SCHEMA public FROM PUBLIC`);
    for (const grant of grants) {
      if (!["USAGE", "CREATE"].includes(grant.privilege_type))
        throw new Error("Permiso de esquema inesperado.");
      await client.query(`GRANT ${grant.privilege_type} ON SCHEMA public TO
        ${grant.grantee === "PUBLIC" ? "PUBLIC" : quote(grant.grantee)}${grant.is_grantable ? " WITH GRANT OPTION" : ""}`);
    }
    phase = "migraciones";
    const applied = await applyMigrations(migrationSavepoint(client), { dir });
    phase = "comprobación final";
    const pending = await applyMigrations(migrationSavepoint(client), { dir });
    if (pending.length) throw new Error("Quedaron migraciones pendientes.");
    await client.query(
      "CREATE TEMP TABLE refind_reset_check(value text NOT NULL) ON COMMIT DROP",
    );
    await client.query("INSERT INTO refind_reset_check VALUES ('ReFind')");
    const {
      rows: [probe],
    } = await client.query("SELECT value FROM refind_reset_check");
    if (probe.value !== "ReFind")
      throw new Error("Falló la escritura y lectura.");
    await assertIdle(client);
    await client.query("COMMIT");
    return {
      environment: config.APP_ENV,
      database: target.database,
      migrations: applied.map((m) => m.name),
      repeated: true,
      files: "No eliminados: usar db:clean-files tras limpiar las tres bases.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    // Mensajes del servidor pueden contener datos: solo código y fase en el CLI.
    const failure = new Error(
      `Reinicio fallido en ${phase}. Se ha solicitado reversión.`,
      { cause: error },
    );
    failure.phase = phase;
    failure.code = error.code ?? "RESET_FAILED";
    throw failure;
  } finally {
    await client.end().catch(() => {});
  }
}
