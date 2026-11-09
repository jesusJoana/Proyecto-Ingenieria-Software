import pg from "pg";
import { resetTarget, checkResetConnection } from "./database-reset.js";
import { cleanLocalFiles } from "./local-files.js";

export async function cleanDatabaseFiles(configs, root) {
  const expected = {
    development: "refind_dev",
    test: "refind_test",
    e2e: "refind_e2e",
  };
  if (
    configs.length !== 3 ||
    new Set(configs.map((c) => c.APP_ENV)).size !== 3 ||
    configs.some((c) => !Object.hasOwn(expected, c.APP_ENV))
  )
    throw new Error("Se requieren los tres entornos.");
  const clients = [];
  try {
    for (const config of configs) {
      const target = resetTarget(config, expected[config.APP_ENV]);
      const client = new pg.Client({
        connectionString: config.DATABASE_URL,
        connectionTimeoutMillis: 5000,
      });
      clients.push(client);
      await client.connect();
      await checkResetConnection(client, target);
      const { rows: tables } =
        await client.query(`SELECT tablename FROM pg_tables
        WHERE schemaname='public' AND tablename<>'pgmigrations'`);
      for (const { tablename } of tables) {
        const { rows } = await client.query(
          `SELECT 1 FROM public."${tablename.replaceAll('"', '""')}" LIMIT 1`,
        );
        if (rows.length)
          throw new Error(
            `${config.APP_ENV}: contiene datos; reiniciar las tres bases antes de limpiar archivos.`,
          );
      }
    }
    return await cleanLocalFiles(root);
  } finally {
    await Promise.all(clients.map((c) => c.end().catch(() => {})));
  }
}
