/**
 * Aplica a la base de datos de un entorno las migraciones pendientes.
 *
 * Uso (mediante los scripts de package.json):
 *   npm.cmd run db:migrate        -> refind_dev
 *   npm.cmd run db:migrate:test   -> refind_test
 *   npm.cmd run db:migrate:e2e    -> refind_e2e
 *
 * Lee la conexión con src/config.js, ejecuta en orden los archivos de la
 * carpeta migrations/ que aún no se hayan aplicado en esa base y los anota en
 * la tabla pgmigrations para no repetirlos. Nunca deshace migraciones.
 */
import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';
import { readConfig } from '../src/config.js';

const mode = process.argv[2];

try {
  const config = readConfig(mode);

  const applied = await runner({
    databaseUrl: config.DATABASE_URL,
    dir: fileURLToPath(new URL('../migrations', import.meta.url)),
    direction: 'up',
    count: Infinity,
    migrationsTable: 'pgmigrations',
    // Exigir que las migraciones se apliquen en el orden de sus números.
    checkOrder: true,
    // Si una falla, no se aplica ninguna de las de esta ejecución.
    singleTransaction: true,
    // Mostrar solo nuestro resumen, no todo el SQL ejecutado.
    log: () => {},
  });

  if (applied.length === 0) {
    console.log(`${mode}: la base de datos ya estaba al día; no hay migraciones pendientes.`);
  } else {
    for (const migration of applied) console.log(`${mode}: aplicada ${migration.name}`);
    console.log(`${mode}: ${applied.length} migraciones aplicadas.`);
  }
} catch (error) {
  console.error(`ERROR al migrar ${mode ?? '(sin entorno)'}: ${error.message}`);
  process.exitCode = 1;
}
