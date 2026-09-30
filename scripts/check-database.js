/**
 * Comprobación de PostgreSQL: npm.cmd run check:db.
 * Requiere un servidor ya iniciado y .env.development, .env.test y .env.e2e
 * con APP_ENV y DATABASE_URL propios de cada entorno.
 * Solo consulta: no crea bases, roles o tablas ni cambia permisos.
 * Salida 0 si los tres entornos pasan; salida 1 si falla alguno.
 * No comprueba escritura real, persistencia tras reiniciar ni pgAdmin.
 */
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';

let failures = 0;
// Repetir las mismas comprobaciones con el rol propio de cada una de las tres bases.
for (const [mode, suffix] of [['development', 'dev'], ['test', 'test'], ['e2e', 'e2e']]) {
  let client;
  try {
// 1. Leer el archivo local correspondiente sin mostrar sus credenciales.
    const env = parseEnv(await readFile(new URL(`../.env.${mode}`, import.meta.url), 'utf8'));
    const target = new URL(env.DATABASE_URL);
    const database = `refind_${suffix}`;
    const user = `${database}_user`;
    // 2. Exigir entorno, dirección local, base y rol previstos antes de conectar.
    if (env.APP_ENV !== mode || target.protocol !== 'postgresql:' ||
        target.hostname !== '127.0.0.1' || target.pathname !== `/${database}` ||
        decodeURIComponent(target.username) !== user || !target.password) {
      throw new Error('Configuración local incorrecta; revisar base, rol, contraseña y APP_ENV.');
    }
    // 3. Conectar con las credenciales indicadas; limitar la espera a cinco segundos.
    client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000,
      query_timeout: 5000, application_name: 'refind-environment-check' });
    await client.connect();
    // 4. Comprobar la identidad real de la conexión, PostgreSQL 17.11 y permisos
    // USAGE/CREATE del esquema public. Consultar permisos no prueba una escritura.
    const { rows: [row] } = await client.query(`SELECT current_database() AS db,
      current_user AS usuario, current_setting('server_version_num') AS version,
      has_schema_privilege(current_user, 'public', 'USAGE') AS uso,
      has_schema_privilege(current_user, 'public', 'CREATE') AS crear`);
    if (row.db !== database || row.usuario !== user || row.version !== '170011' || !row.uso || !row.crear) {
      throw new Error('Base, rol, versión 17.11 o permisos de esquema incorrectos.');
    }
    // 5. Exigir las tres bases y permiso CONNECT únicamente sobre la propia.
    // Se consultan privilegios; no se intentan conexiones cruzadas reales.
    const { rows } = await client.query(`SELECT datname,
      has_database_privilege(current_user, oid, 'CONNECT') AS permitido
      FROM pg_database WHERE datname = ANY($1::text[])`,
      [['refind_dev', 'refind_test', 'refind_e2e']]);
    if (rows.length !== 3 || rows.some((item) => item.permitido !== (item.datname === database))) {
      throw new Error('Faltan bases o los permisos de conexión no están aislados.');
    }
    console.log(`OK: ${mode}: conexión, versión y permisos.`);
  } catch (error) {
    failures++;
    // No imprimir errores del cliente: podrían incluir datos de conexión.
    console.error(`ERROR: ${mode}: revisar .env.${mode}, servicio, versión y permisos. Código: ${error.code ?? 'CHECK_FAILED'}`);
  } finally {
    // Cerrar la conexión también cuando una comprobación haya fallado.
    if (client) await client.end().catch(() => {});
  }
}
console.log('Comprobación de lectura: no valida escritura, reinicio persistente ni pgAdmin.');
// Cualquier entorno fallido hace fallar el comando completo.
process.exitCode = failures ? 1 : 0;
