import { fileURLToPath } from "node:url";
import { readConfig } from "../src/config.js";
import { cleanDatabaseFiles } from "./lib/clean-database-files.js";

try {
  if (process.argv.slice(2).join(" ") !== "--confirm all-local-files") {
    throw new Error("Uso: npm run db:clean-files -- --confirm all-local-files");
  }
  if (process.env.REFIND_PRIVATE_UPLOADS_DIR)
    throw new Error("Revisar primero la ruta externa de adjuntos.");
  const configs = ["development", "test", "e2e"].map(readConfig);
  const count = await cleanDatabaseFiles(
    configs,
    fileURLToPath(new URL("../", import.meta.url)),
  );
  console.log(
    `Eliminados ${count} archivos locales de prueba. Directorios conservados.`,
  );
} catch (error) {
  console.error(
    error.code
      ? `No se completó la limpieza. Código: ${error.code}`
      : error.message,
  );
  process.exitCode = 1;
}
