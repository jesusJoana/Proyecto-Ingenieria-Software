/**
 * Ejecutar con npm.cmd run check:tests:browser; requiere Chromium de Playwright.
 * Comprueba arranque del navegador e interacción con una página en memoria.
 * No accede a internet ni comprueba pantallas de ReFind. Playwright gestiona
 * la página y su contexto y cierra el navegador al terminar la ejecución.
 */
import { test, expect } from '@playwright/test';

/**
 * Para qué sirve: Comprobar que Playwright puede abrir Chromium e interactuar con una página.
 * Qué comprueba: Crea un campo en una página en memoria, escribe Mochila y comprueba que
 * conserva ese valor. No arranca ReFind ni utiliza PostgreSQL.
 */
test('Chromium arranca y permite interactuar', async ({ page }) => {
  // Preparar un campo accesible mediante su etiqueta, sin servidor web.
  await page.setContent('<label>Objeto <input></label>');
  // Simular la escritura del usuario en Chromium.
  await page.getByRole('textbox', { name: 'Objeto' }).fill('Mochila');
  // Confirmar que la interacción dejó el valor esperado en el campo.
  await expect(page.getByRole('textbox', { name: 'Objeto' })).toHaveValue('Mochila');
});
