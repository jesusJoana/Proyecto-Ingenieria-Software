/** Configuración de la prueba aislada de Chromium: npm.cmd run check:tests:browser. */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Seleccionar solo la prueba de navegador; excluir el test de Vitest.
  testDir: './tests/setup',
  testMatch: 'browser.spec.js',
  // Ejecutar con un trabajador y sin ventana visible; no arrancar un servidor web.
  workers: 1,
  use: { browserName: 'chromium', headless: true },
  // Guardar resultados locales e informe HTML sin abrirlo automáticamente.
  outputDir: 'test-results/setup',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/setup', open: 'never' }],
  ],
});
