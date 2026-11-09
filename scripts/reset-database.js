import { readConfig } from "../src/config.js";
import { parseResetArguments, rebuildDatabase } from "./lib/database-reset.js";

try {
  const { mode, confirmation } = parseResetArguments(process.argv.slice(2));
  const result = await rebuildDatabase(readConfig(mode), confirmation);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    `${error.message} Código: ${error.code ?? "INVALID_ARGUMENTS"}`,
  );
  if (error.phase)
    console.error(
      "Cerrar conexiones y revisar configuración/migraciones. Repetir el mismo comando tras corregir la causa.",
    );
  process.exitCode = 1;
}
