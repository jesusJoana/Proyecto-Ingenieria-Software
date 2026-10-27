/** Recuperación de contraseña desde el navegador con refind_e2e. Usa un correo único y limpia sus datos. */
import { test, expect } from '@playwright/test';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import pg from 'pg';
import { readConfig } from '../../src/config.js';

const pool = new pg.Pool({ connectionString: readConfig('e2e').DATABASE_URL });
const oldPassword = 'Contraseña antigua 1';
const newPassword = 'Una frase nueva 42';
let email;

test.beforeEach(async () => {
  email = `browser-reset-${randomUUID()}@example.test`;
  const hash = await argon2.hash(oldPassword, { type: argon2.argon2id });
  await pool.query(
    `INSERT INTO users (username, first_name, last_name, email, password_hash)
     VALUES ($3, 'Ana', 'García', $1, $2)`,
    [email, hash, `reset-${randomUUID().slice(0, 8)}`],
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

/**
 * En modo console el enlace solo se escribe en la terminal del servidor. Para «abrir el
 * correo», la prueba sustituye el hash guardado por el de un token que ella conoce.
 */
async function openEmailLink(page) {
  const token = randomBytes(32).toString('hex');
  const { rowCount } = await pool.query(
    `UPDATE password_reset_tokens SET token_hash = $1
     WHERE user_id = (SELECT id FROM users WHERE email = $2) AND used_at IS NULL`,
    [createHash('sha256').update(token).digest('hex'), email],
  );
  expect(rowCount).toBe(1);
  await page.goto(`/restablecer-contrasena/${token}`);
  return token;
}

/** Para qué sirve: validar la recuperación completa como la haría una persona.
 * Qué comprueba: desde el acceso pide el enlace, ve el mensaje genérico, elige una contraseña
 * (primero con un error), vuelve al acceso con aviso, entra con la nueva y el enlace ya no sirve. */
test('permite recuperar la contraseña desde el acceso', async ({ page }) => {
  await page.goto('/iniciar-sesion');
  await page.getByRole('link', { name: '¿Has olvidado tu contraseña?' }).click();
  await expect(page).toHaveURL(/\/recuperar-contrasena$/);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.',
  );

  const token = await openEmailLink(page);
  await expect(page.getByRole('heading', { name: 'Elige una nueva contraseña' })).toBeVisible();

  // Confirmación distinta: error y se puede volver a intentar.
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill('Otra frase 42 distinta');
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('Las contraseñas no coinciden.');

  await page.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await expect(page).toHaveURL(/\/iniciar-sesion\?restablecida=ok$/);
  await expect(page.getByRole('status')).toContainText('Tu contraseña se ha restablecido.');

  await login(page, oldPassword);
  await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos.');
  await login(page, newPassword);
  await expect(page).toHaveURL(/\/$/);

  // El mismo enlace ya no sirve (se abre en un contexto sin sesión).
  const guest = await page.context().browser().newPage();
  await guest.goto(`${new URL(page.url()).origin}/restablecer-contrasena/${token}`);
  await expect(guest.getByRole('alert')).toContainText('El enlace no es válido o ha caducado');
  await expect(guest.getByRole('link', { name: 'Solicitar un enlace nuevo' })).toBeVisible();
  await guest.close();
});

/** Para qué sirve: comprobar que la página se ve bien en un móvil.
 * Qué comprueba: el formulario de correo cabe en 375 px sin desplazamiento horizontal. */
test('el formulario de recuperación se adapta al móvil', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/recuperar-contrasena');
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
