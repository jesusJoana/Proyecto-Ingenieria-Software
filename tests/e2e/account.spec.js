/** Cambio de contraseña desde el navegador con refind_e2e. Usa un correo único y limpia sus datos. */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import pg from 'pg';
import { readConfig } from '../../src/config.js';
const pool = new pg.Pool({ connectionString: readConfig('e2e').DATABASE_URL });
const oldPassword = 'Contraseña actual 1';
const newPassword = 'Una frase nueva 42';
let email;

test.beforeEach(async () => {
  email = `browser-account-${randomUUID()}@example.test`;
  const hash = await argon2.hash(oldPassword, { type: argon2.argon2id });
  await pool.query(
    `INSERT INTO users (username, first_name, last_name, email, password_hash)
     VALUES ($3, 'Ana', 'García', $1, $2)`,
    [email, hash, `cuenta-${randomUUID().slice(0, 8)}`],
  );
});
test.afterEach(async () => {
  await pool.query(
    "DELETE FROM session WHERE sess->>'userId' IN (SELECT id::text FROM users WHERE email = $1)",
    [email],
  );
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
});
test.afterAll(async () => {
  await pool.end();
});

async function login(page, password) {
  await page.goto('/iniciar-sesion');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: false }).click();
}

/** Para qué sirve: validar el cambio de contraseña completo desde el menú de la cuenta.
 * Qué comprueba: abre la página desde Mi cuenta, muestra el error con una contraseña actual
 * incorrecta, confirma el cambio y, tras salir, solo permite entrar con la nueva. */
test('permite cambiar la contraseña desde Mi cuenta', async ({ page }) => {
  await login(page, oldPassword);
  await page.getByRole('button', { name: 'Mi cuenta' }).click();
  await page.getByRole('link', { name: 'Cambiar contraseña' }).click();
  await expect(page).toHaveURL(/\/cambiar-contrasena$/);
  await expect(
    page.getByRole('heading', { name: 'Cambiar contraseña' }),
  ).toBeVisible();

  // Contraseña actual incorrecta: error y campos vacíos.
  await page.getByLabel('Contraseña actual', { exact: true }).fill('No es la actual 99');
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Cambiar contraseña', exact: false }).click();
  await expect(page.getByRole('alert')).toContainText(
    'La contraseña actual no es correcta.',
  );
  await expect(page.getByLabel('Contraseña actual', { exact: true })).toHaveValue('');

  // Contraseña actual correcta: confirmación.
  await page.getByLabel('Contraseña actual', { exact: true }).fill(oldPassword);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Cambiar contraseña', exact: false }).click();
  await expect(page.getByRole('status')).toContainText(
    'Tu contraseña se ha cambiado correctamente.',
  );

  // Salir y comprobar que solo vale la nueva.
  await page.goto('/');
  await page.getByRole('button', { name: 'Mi cuenta' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login(page, oldPassword);
  await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos');
  await login(page, newPassword);
  await expect(page.getByRole('button', { name: 'Mi cuenta' })).toBeVisible();
});

/** Para qué sirve: impedir el acceso a la página sin sesión iniciada.
 * Qué comprueba: abrir la dirección directamente lleva a la pantalla de acceso. */
test('sin sesión lleva al acceso', async ({ page }) => {
  await page.goto('/cambiar-contrasena');
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
});
