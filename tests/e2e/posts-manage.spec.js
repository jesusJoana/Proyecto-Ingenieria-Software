/** Gestionar una publicación desde el navegador con refind_e2e. Usa un usuario único y limpia sus datos. */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import pg from 'pg';
import sharp from 'sharp';
import { readConfig } from '../../src/config.js';
import { today } from '../../src/posts/validation.js';

const pool = new pg.Pool({ connectionString: readConfig('e2e').DATABASE_URL });
const password = 'Una frase segura 42';
const photoDirectory = fileURLToPath(
  new URL('../../public/uploads/posts/', import.meta.url),
);
let email;

test.beforeEach(async () => {
  email = `browser-manage-${randomUUID()}@example.test`;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await pool.query(
    `INSERT INTO users (username, first_name, last_name, email, password_hash)
     VALUES ($3, 'Marta', 'Gil', $1, $2)`,
    [email, hash, `manage-${randomUUID().slice(0, 8)}`],
  );
});
test.afterEach(async () => {
  // Si la prueba falla antes de eliminar, se borran también las fotos que queden.
  const { rows } = await pool.query(
    `SELECT photo_filename FROM object_posts
     WHERE photo_filename IS NOT NULL
       AND author_id = (SELECT id FROM users WHERE email = $1)`,
    [email],
  );
  for (const { photo_filename } of rows)
    await unlink(`${photoDirectory}${photo_filename}`).catch(() => {});
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

/** Para qué sirve: validar el ciclo completo de una publicación.
 * Qué comprueba: publicar, encontrarla con el buscador, marcarla como reservada desde el detalle y
 * como resuelta desde Mis publicaciones (deja de aparecer en el listado por defecto y aparece con
 * el filtro Resueltas), editarla añadiendo una foto y eliminarla tras confirmar, sin desbordar en móvil. */
test('publica, busca, reserva, resuelve, edita y elimina', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  );
  const marker = randomUUID().slice(0, 8);
  const title = `Estuche verde ${marker}`;
  const editedTitle = `Estuche verde con cremallera ${marker}`;

  await page.goto('/iniciar-sesion');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: false })
    .click();

  // Publicar.
  await page.goto('/publicaciones/nueva');
  await page.getByLabel('He perdido un objeto').check();
  await page.getByLabel('Título').fill(title);
  await page
    .getByLabel('Descripción')
    .fill('Estuche de tela verde con bolígrafos y una calculadora.');
  await page.getByLabel('Categoría').selectOption({ label: 'Accesorios' });
  await page.getByLabel('Fecha en que se perdió o se encontró').fill(today());
  await page.getByLabel('Último lugar conocido', { exact: true }).fill('Aula 1.4');
  await page
    .getByLabel('Universidad', { exact: true })
    .fill('Universidad de prueba');
  await page.getByLabel('Campus o sede', { exact: true }).fill('Campus norte');
  await page.getByLabel('Ciudad', { exact: true }).fill('Madrid');
  await page.getByLabel('País', { exact: true }).fill('España');
  await page
    .getByLabel('Dirección del campus', { exact: true })
    .fill('Calle del Campus 2');
  await page.getByLabel('Latitud', { exact: true }).fill('40.45');
  await page.getByLabel('Longitud', { exact: true }).fill('-3.72');
  await page.getByRole('button', { name: 'Publicar objeto' }).click();
  await expect(page).toHaveURL(/\/publicaciones\/\d+\?publicada=ok$/);
  const detailUrl = new URL(page.url()).pathname;

  // Buscar.
  await page.getByRole('link', { name: 'Publicaciones', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Buscar en título y descripción' })
    .fill(marker);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`\\?q=${marker}`));
  const card = page.getByRole('article').filter({ hasText: title });
  await expect(card).toContainText('Activa');
  await card.getByRole('link', { name: title }).click();

  // Reservar desde el detalle.
  await page.getByRole('button', { name: 'Marcar como reservada' }).click();
  await expect(page).toHaveURL(new RegExp(`${detailUrl}\\?estado=ok$`));
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'El estado de la publicación se ha actualizado.' }),
  ).toBeVisible();
  await expect(page.locator('.post-detail .post-status')).toHaveText('Reservada');
  await expect(page.getByRole('button', { name: 'Anular reserva' })).toBeVisible();

  // Resolver desde Mis publicaciones.
  await page.getByRole('link', { name: 'Mis publicaciones' }).click();
  const mine = page.getByRole('article').filter({ hasText: title });
  await expect(mine).toContainText('Reservada');
  await mine.getByRole('button', { name: 'Marcar como resuelta' }).click();
  await expect(page).toHaveURL(/\/mis-publicaciones\?estado=ok$/);
  await expect(mine).toContainText('Resuelta');
  await expect(mine.getByRole('button', { name: 'Reactivar' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Las resueltas no salen por defecto, sí con su filtro.
  await page.goto(`/publicaciones?q=${marker}`);
  await expect(
    page.getByText('No hay publicaciones que coincidan con la búsqueda.'),
  ).toBeVisible();
  await page.getByLabel('Estado', { exact: true }).selectOption('resolved');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/estado=resolved/);
  await expect(card).toContainText('Resuelta');

  // Editar: título y foto nueva.
  await card.getByRole('link', { name: title }).click();
  await page.getByRole('link', { name: 'Editar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${detailUrl}/editar$`));
  await expect(page.getByLabel('Título')).toHaveValue(title);
  await expect(page.getByLabel('Universidad', { exact: true })).toHaveValue(
    'Universidad de prueba',
  );
  await page.getByLabel('Título').fill(editedTitle);
  await page.getByLabel('Foto', { exact: false }).setInputFiles({
    name: 'estuche.png',
    mimeType: 'image/png',
    buffer: await sharp({
      create: { width: 60, height: 40, channels: 3, background: '#2f8a4c' },
    })
      .png()
      .toBuffer(),
  });
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(new RegExp(`${detailUrl}\\?editada=ok$`));
  await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
  const photo = page.locator('.post-detail-photo');
  await expect(photo).toHaveAttribute('src', /^\/uploads\/posts\/.+\.webp$/);
  const photoUrl = await photo.getAttribute('src');
  await expect(page.locator('.post-detail .post-status')).toHaveText('Resuelta');

  // Eliminar tras confirmar.
  await page.getByRole('link', { name: 'Eliminar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: `¿Eliminar «${editedTitle}»?` }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(new RegExp(`${detailUrl}$`));
  await page.getByRole('link', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await expect(page).toHaveURL(/\/mis-publicaciones\?eliminada=ok$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'La publicación se ha eliminado.' }),
  ).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: editedTitle })).toHaveCount(0);
  expect((await page.request.get(photoUrl)).status()).toBe(404);
  expect((await page.request.get(detailUrl)).status()).toBe(404);
});
