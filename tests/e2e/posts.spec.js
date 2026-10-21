/** Publicar un objeto desde el navegador con refind_e2e. Usa un usuario único y limpia sus datos. */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import pg from 'pg';
import { readConfig } from '../../src/config.js';
import { today } from '../../src/posts/validation.js';
const pool = new pg.Pool({ connectionString: readConfig('e2e').DATABASE_URL });
const password = 'Una frase segura 42';
let email;
let username;

test.beforeEach(async () => {
  email = `browser-posts-${randomUUID()}@example.test`;
  username = `posts-${randomUUID().slice(0, 8)}`;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await pool.query(
    `INSERT INTO users (username, first_name, last_name, email, password_hash)
     VALUES ($3, 'Lucía', 'Martín', $1, $2)`,
    [email, hash, username],
  );
});
test.afterEach(async () => {
  await pool.query(
    "DELETE FROM session WHERE sess->>'userId' IN (SELECT id::text FROM users WHERE email = $1)",
    [email],
  );
  // Sus publicaciones se borran en cascada.
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
});
test.afterAll(async () => {
  await pool.end();
});

/** Para qué sirve: validar el flujo completo de publicación.
 * Qué comprueba: tras iniciar sesión, publicar desde el menú muestra un error de validación
 * conservando lo escrito; al corregirlo, el objeto aparece en su detalle con el autor, en el
 * listado público y en Mis publicaciones. */
test('publica un objeto y lo muestra en el detalle y en el listado', async ({ page }) => {
  const title = `Paraguas azul ${randomUUID().slice(0, 6)}`;
  await page.goto('/iniciar-sesion');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: false }).click();

  await page.getByRole('button', { name: `Cuenta de @${username}` }).click();
  await page.getByRole('link', { name: 'Publicar objeto', exact: true }).click();
  await expect(page).toHaveURL(/\/publicaciones\/nueva$/);

  await page.getByLabel('He encontrado un objeto').check();
  await page.getByLabel('Título').fill(title);
  await page.getByLabel('Descripción').fill('Corta');
  await page.getByLabel('Categoría').selectOption({ label: 'Accesorios' });
  await page.getByLabel('Fecha en que se perdió o se encontró').fill(today());
  await page.getByLabel('Lugar').fill('Aula 2.3');
  await page.getByLabel('Color').fill('Azul');
  await page.getByRole('button', { name: 'Publicar objeto' }).click();

  // Error de validación: se mantiene lo escrito.
  await expect(page.getByRole('alert')).toContainText(
    'Describe el objeto con al menos 10 caracteres.',
  );
  await expect(page.getByLabel('Título')).toHaveValue(title);
  await expect(page.getByLabel('He encontrado un objeto')).toBeChecked();

  await page.getByLabel('Descripción').fill('Paraguas plegable azul marino con mango de madera.');
  await page.getByRole('button', { name: 'Publicar objeto' }).click();

  // Detalle.
  await expect(page).toHaveURL(/\/publicaciones\/\d+\?publicada=ok$/);
  await expect(page.getByRole('status')).toContainText('Tu publicación se ha creado correctamente.');
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText('Aula 2.3')).toBeVisible();
  await expect(page.getByText(`@${username}`)).toBeVisible();
  const detailUrl = new URL(page.url()).pathname;

  // Listado público.
  await page.getByRole('link', { name: 'Publicaciones', exact: true }).click();
  await expect(page).toHaveURL(/\/publicaciones$/);
  const card = page.getByRole('article').filter({ hasText: title });
  await expect(card).toContainText('Encontrado');
  await expect(card).toContainText('Accesorios');
  await card.getByRole('link', { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`${detailUrl}$`));

  // Mis publicaciones.
  await page.getByRole('link', { name: 'Mis publicaciones' }).click();
  await expect(page.getByRole('article').filter({ hasText: title })).toContainText('Activa');
});

/** Para qué sirve: impedir publicar sin sesión.
 * Qué comprueba: el botón de la portada lleva al acceso. */
test('sin sesión, publicar lleva al acceso', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Publicar objeto perdido' }).click();
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
});
