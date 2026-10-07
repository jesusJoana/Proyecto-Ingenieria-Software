/** Flujos reales con navegador y refind_e2e. Cada prueba usa un correo único y limpia sus datos. */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { readConfig } from '../../src/config.js';
const pool = new pg.Pool({ connectionString: readConfig('e2e').DATABASE_URL });
let email;
const password = 'Una frase segura 42';
const tokens = new Set();
test.beforeEach(async ({ page }) => {
  email = `browser-${randomUUID()}@example.test`;
  // Recoger tokens de nuestras propias respuestas para retirar sesiones anónimas de prueba.
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'document') return;
    try {
      const html = await response.text();
      const token = html.match(/name="_csrf" value="([a-f0-9]+)"/)?.[1];
      if (token) tokens.add(token);
    } catch {
      /* Una redirección puede no tener cuerpo. */
    }
  });
});
test.afterEach(async ({ context }) => {
  const cookie = (await context.cookies()).find((c) => c.name === 'refind.sid');
  if (cookie) {
    const sid = decodeURIComponent(cookie.value)
      .replace(/^s:/, '')
      .split('.')[0];
    await pool.query('DELETE FROM session WHERE sid=$1', [sid]);
  }
  const { rows } = await pool.query('SELECT id FROM users WHERE email=$1', [
    email,
  ]);
  for (const user of rows)
    await pool.query("DELETE FROM session WHERE sess->>'userId'=$1", [
      String(user.id),
    ]);
  await pool.query('DELETE FROM users WHERE email=$1', [email]);
  await pool.query(
    "DELETE FROM session WHERE sess->>'csrfToken' = ANY($1::text[])",
    [[...tokens]],
  );
  tokens.clear();
});
test.afterAll(async () => {
  await pool.end();
});

async function fillRegistration(page) {
  await page.getByLabel('Nombre', { exact: true }).fill('Ana');
  await page.getByLabel('Apellidos', { exact: true }).fill('García');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Organización', { exact: false }).fill('Universidad');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(password);
}

/** Para qué sirve: validar el recorrido completo desde la portada con datos persistidos.
 * Qué comprueba: registro, confirmación, acceso, persistencia tras recargar y cierre de sesión. */
test('permite registrarse, iniciar sesión y salir desde la portada', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Registrarse', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Crear una cuenta' }),
  ).toBeVisible();
  await fillRegistration(page);
  await page
    .getByRole('button', { name: 'Crear cuenta', exact: false })
    .click();
  await expect(page).toHaveURL(/\/iniciar-sesion\?registro=ok$/);
  await expect(page.getByRole('status')).toContainText(
    'Tu cuenta se ha creado',
  );
  await page.getByLabel('Correo electrónico').fill(email.toUpperCase());
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: false })
    .click();
  const account = page.getByRole('button', { name: 'Mi cuenta' });
  await expect(account).toBeVisible();
  await page.reload();
  // El menú de la cuenta muestra sus opciones al desplegarlo.
  await account.click();
  await expect(
    page.getByText('Sesión iniciada', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mi perfil' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cambiar contraseña' }),
  ).toBeVisible();
  // Mientras no exista su página, Cambiar contraseña informa de que está pendiente.
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('todavía no está disponible');
  await dialog.getByRole('button', { name: 'Entendido' }).click();
  await expect(dialog).toBeHidden();
  await account.click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'Iniciar sesión', exact: true }),
  ).toBeVisible();
});

/** Para qué sirve: mostrar errores comprensibles sin perder los campos públicos.
 * Qué comprueba: contraseña discordante, corrección, correo duplicado y contraseñas vacías al fallar. */
test('muestra errores de registro y permite corregirlos', async ({ page }) => {
  await page.goto('/registro');
  await fillRegistration(page);
  await page
    .getByLabel('Confirmar contraseña', { exact: true })
    .fill('Otra frase distinta');
  await page
    .getByRole('button', { name: 'Crear cuenta', exact: false })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Las contraseñas no coinciden',
  );
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Ana');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
  await fillRegistration(page);
  await page
    .getByRole('button', { name: 'Crear cuenta', exact: false })
    .click();
  await expect(page).toHaveURL(/registro=ok/);
  await page.goto('/registro');
  await fillRegistration(page);
  await page
    .getByRole('button', { name: 'Crear cuenta', exact: false })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Ya existe una cuenta con este correo',
  );
});

/** Para qué sirve: rechazar accesos inválidos y mantener la navegación en pantallas pequeñas.
 * Qué comprueba: error de credenciales, botón mostrar contraseña y ausencia de desbordamiento móvil. */
test('el acceso informa del error y funciona a tamaño móvil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/iniciar-sesion');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Mostrar contraseña', exact: true })
    .click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: false })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Correo o contraseña incorrectos',
  );
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Regístrate', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Crear una cuenta' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
