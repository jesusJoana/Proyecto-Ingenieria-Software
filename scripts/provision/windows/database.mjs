/** Solo invocado por PowerShell dentro de la VM. Credenciales por stdin, nunca por argv.
 * setup: crea lo que falta; verify: verifica sin alterar roles ni .env;
 * persistence: lectura del marcador tras reinicio, sin recrearlo.
 */
import { createRequire } from "node:module";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import {
  buildEnvironments,
  assertInstance,
  roleStatements,
} from "./database-plan.mjs";
let stage = "entrada";
try {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const { secrets, mode, dataDirectory } = JSON.parse(input);
  if (!["setup", "verify", "persistence"].includes(mode))
    throw new Error("Modo invalido");
  const root = path.resolve(process.argv[2]);
  const pg = createRequire(path.join(root, "package.json"))("pg");
  const envs = buildEnvironments(secrets);
  const admin = new pg.Client({
    host: "127.0.0.1",
    port: 5433,
    user: "postgres",
    password: secrets.postgres,
    database: "postgres",
    connectionTimeoutMillis: 8000,
    query_timeout: 15000,
  });
  const clientFor = (e, database = e.database) =>
    new pg.Client({
      host: "127.0.0.1",
      port: 5433,
      user: e.role,
      password: e.password,
      database,
      connectionTimeoutMillis: 8000,
      query_timeout: 15000,
    });
  stage = "identidad de PostgreSQL";
  await admin.connect();
  try {
    const {
      rows: [identity],
    } = await admin.query(
      "SELECT current_setting('server_version_num') AS version, inet_server_port() AS port, current_setting('cluster_name') AS cluster, current_setting('data_directory') AS data",
    );
    assertInstance(identity, dataDirectory);
    // Comprobar todos los .env antes de cambiar bases; no reemplazar uno distinto.
    for (const e of envs) {
      stage = "archivo .env." + e.mode;
      e.file = path.join(root, ".env." + e.mode);
      e.text = `APP_ENV=${e.mode}\nDATABASE_URL=${e.url}\nSESSION_SECRET=${e.secret}\nPORT=${e.port}\n`;
      try {
        const old = await readFile(e.file, "utf8");
        if (old.replaceAll("\r\n", "\n") !== e.text)
          throw new Error("Archivo existente distinto");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        if (mode !== "setup") throw error;
      }
    }
    for (const e of envs) {
      stage = "rol y base " + e.mode;
      const { rows: roles } = await admin.query(
        "SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1",
        [e.role],
      );
      if (roles.length) {
        const r = roles[0];
        if (
          !r.rolcanlogin ||
          r.rolsuper ||
          r.rolcreatedb ||
          r.rolcreaterole ||
          r.rolreplication ||
          r.rolbypassrls
        )
          throw new Error("Atributos de rol inesperados");
      } else if (mode === "setup")
        await admin.query(roleStatements(e.role, e.password));
      else throw new Error("Falta rol");
      const { rows: bases } = await admin.query(
        "SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1",
        [e.database],
      );
      if (bases.length && bases[0].owner !== e.role)
        throw new Error("Propietario ajeno");
      if (!bases.length) {
        if (mode !== "setup") throw new Error("Falta base");
        await admin.query(
          `CREATE DATABASE ${e.database} OWNER ${e.role} ENCODING 'UTF8' TEMPLATE template0`,
        );
      }
      // Probar la clave guardada. Nunca restablecer contrasenas al repetir.
      const own = clientFor(e);
      try {
        await own.connect();
      } finally {
        await own.end();
      }
      if (mode === "setup") {
        await admin.query(
          `REVOKE CONNECT, TEMPORARY ON DATABASE ${e.database} FROM PUBLIC`,
        );
        await admin.query(
          `GRANT CONNECT, TEMPORARY ON DATABASE ${e.database} TO ${e.role}`,
        );
      }
    }
  } finally {
    await admin.end();
  }
  for (const e of envs) {
    stage = "escritura y aislamiento " + e.mode;
    const own = clientFor(e);
    try {
      await own.connect();
      const {
        rows: [id],
      } = await own.query(
        "SELECT current_database() AS db,current_user AS usr",
      );
      if (id.db !== e.database || id.usr !== e.role)
        throw new Error("Identidad incorrecta");
      if (mode !== "persistence") {
        // Tabla temporal: demuestra DDL/escritura/lectura sin alterar entidades de la app.
        await own.query("BEGIN");
        try {
          await own.query(
            "CREATE TEMP TABLE refind_probe (id integer PRIMARY KEY, valor text)",
          );
          await own.query("INSERT INTO refind_probe VALUES (1,'ReFind')");
          const { rows } = await own.query("SELECT valor FROM refind_probe");
          if (rows[0]?.valor !== "ReFind")
            throw new Error("Escritura incorrecta");
        } finally {
          await own.query("ROLLBACK");
        }
      }
      if (mode === "setup") {
        await own.query(
          "CREATE TABLE IF NOT EXISTS public.refind_vm_probe (id integer PRIMARY KEY, valor text NOT NULL)",
        );
        await own.query(
          "INSERT INTO public.refind_vm_probe VALUES (1,'ReFind-VM-v1') ON CONFLICT (id) DO NOTHING",
        );
      }
      const { rows: marker } = await own.query(
        "SELECT id,valor FROM public.refind_vm_probe",
      );
      if (
        marker.length !== 1 ||
        marker[0].id !== 1 ||
        marker[0].valor !== "ReFind-VM-v1"
      )
        throw new Error("Marcador de persistencia inesperado");
    } finally {
      await own.end();
    }
    // Una clave incorrecta o un servidor caido NO cuentan como aislamiento correcto.
    for (const other of envs.filter((o) => o.database !== e.database)) {
      const cross = clientFor(e, other.database);
      let denied = false;
      try {
        await cross.connect();
      } catch (error) {
        if (error.code === "42501") denied = true;
        else throw error;
      } finally {
        await cross.end();
      }
      if (!denied) throw new Error("Conexion cruzada permitida");
    }
    if (mode === "setup")
      try {
        await access(e.file);
      } catch {
        await writeFile(e.file, e.text, { flag: "wx" });
      }
    console.log(
      `OK: ${e.mode}: identidad, permisos, lectura${mode === "persistence" ? " persistente tras reinicio" : ", escritura"} y dos accesos cruzados rechazados.`,
    );
  }
} catch (error) {
  console.error(
    `ERROR: ${stage}. Codigo: ${error.code ?? "SETUP_CHECK"}. Revisar el paso y los secretos locales; no se muestran valores.`,
  );
  process.exitCode = 1;
}
