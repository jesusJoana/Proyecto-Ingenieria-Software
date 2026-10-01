/**
 * Configuración de las pruebas de ReFind (npm.cmd run test).
 * Las comprobaciones del entorno tienen su propia configuración en vitest.setup.config.js.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Ejecutar las pruebas unitarias y de integración, en carpetas separadas.
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    // Las pruebas comparten la base refind_test: ejecutarlas de una en una.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
