/**
 * Pruebas de navegador de ReFind: npm.cmd run test:e2e.
 * Requiere .env.e2e, Chromium y las migraciones aplicadas en refind_e2e.
 * Arranca su propio servidor E2E y lo cierra al terminar. No reutiliza otro
 * servidor abierto en ese puerto, para no probar por error el de desarrollo.
 */
import { defineConfig } from '@playwright/test';
import { readConfig } from './src/config.js';

const config = readConfig('e2e');
const baseURL = `http://127.0.0.1:${config.PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: { baseURL, browserName: 'chromium', headless: true },
  outputDir: 'test-results/e2e',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/e2e', open: 'never' }],
  ],
  webServer: {
    command: 'npm run start:e2e',
    // /health exige que PostgreSQL responda antes de empezar las pruebas.
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
