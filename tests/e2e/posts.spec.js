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
 * Qué comprueba: tras iniciar sesión, publicar desde la navegación lateral muestra un error de validación
 * conservando lo escrito; al corregirlo, el objeto aparece en su detalle con el autor, en el
 * listado público y en Mis publicaciones. */
test('publica un objeto y lo muestra en el detalle y en el listado', async ({
  page,
}) => {
  // Los mapas se prueban sin depender de la red del proveedor de teselas.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  );
  const title = `Paraguas azul ${randomUUID().slice(0, 6)}`;
  await page.goto('/iniciar-sesion');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: false })
    .click();

  await page
    .getByRole('navigation', { name: 'Secciones de ReFind' })
    .getByRole('link', { name: 'Publicar', exact: true })
    .click();
  await expect(page).toHaveURL(/\/publicaciones\/nueva$/);

  await page.getByLabel('He encontrado un objeto').check();
  await page.getByLabel('Título').fill(title);
  await page.getByLabel('Descripción').fill('Corta');
  await page.getByLabel('Categoría').selectOption({ label: 'Accesorios' });
  await page.getByLabel('Fecha en que se perdió o se encontró').fill(today());
  await page.getByLabel('Lugar del hallazgo', { exact: true }).fill('Aula 2.3');
  await page
    .getByLabel('Universidad', { exact: true })
    .fill('Universidad de prueba');
  await page
    .getByLabel('Campus o sede', { exact: true })
    .fill('Campus central');
  await page.getByLabel('Ciudad', { exact: true }).fill('Madrid');
  await page.getByLabel('País', { exact: true }).fill('España');
  await page
    .getByLabel('Dirección del campus', { exact: true })
    .fill('Calle del Campus 1');
  await page.getByLabel('Latitud', { exact: true }).fill('40.4');
  await page.getByLabel('Longitud', { exact: true }).fill('-3.7');
  await page
    .getByLabel('Dónde está depositado ahora', { exact: false })
    .fill('Conserjería');
  await page.getByLabel('Color').fill('Azul');
  await page.getByRole('button', { name: 'Publicar objeto' }).click();

  // Error de validación: se mantiene lo escrito.
  await expect(page.getByRole('alert')).toContainText(
    'Describe el objeto con al menos 10 caracteres.',
  );
  await expect(page.getByLabel('Título')).toHaveValue(title);
  await expect(page.getByLabel('He encontrado un objeto')).toBeChecked();
  await expect(page.getByLabel('Universidad', { exact: true })).toHaveValue(
    'Universidad de prueba',
  );
  await expect(page.getByLabel('Latitud', { exact: true })).toHaveValue('40.4');
  await expect(
    page.getByLabel('Dónde está depositado ahora', { exact: false }),
  ).toHaveValue('Conserjería');

  await page
    .getByLabel('Descripción')
    .fill('Paraguas plegable azul marino con mango de madera.');
  await page.getByRole('button', { name: 'Publicar objeto' }).click();

  // Detalle.
  await expect(page).toHaveURL(/\/publicaciones\/\d+\?publicada=ok$/);
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Tu publicación se ha creado correctamente.' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText('Aula 2.3')).toBeVisible();
  await expect(page.getByText(`@${username}`)).toBeVisible();
  await expect(
    page.locator('[data-post-map] .leaflet-marker-icon'),
  ).toHaveCount(1);
  await expect(
    page.getByText(
      'Referencia general del campus; no indica el punto exacto del objeto.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Depositado actualmente en', { exact: true }),
  ).toBeVisible();
  const detailUrl = new URL(page.url()).pathname;

  // Listado público.
  await page.getByRole('link', { name: 'Publicaciones', exact: true }).click();
  await expect(page).toHaveURL(/\/publicaciones$/);
  const card = page.getByRole('article').filter({ hasText: title });
  await expect(card).toContainText('Encontrado');
  await expect(card).toContainText('Accesorios');
  // La búsqueda se hace en el servidor y queda en la URL.
  await page
    .getByRole('searchbox', { name: 'Buscar en título y descripción' })
    .fill(title);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/publicaciones\?q=/);
  await expect(page.locator('[data-post]')).toHaveCount(1);
  await page.getByLabel('Tipo', { exact: true }).selectOption('lost');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(
    page.getByText('No hay publicaciones que coincidan con la búsqueda.'),
  ).toBeVisible();
  await page.getByLabel('Tipo', { exact: true }).selectOption('');
  await page
    .getByLabel('Categoría', { exact: true })
    .selectOption('accessories');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(card).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('navigation', { name: 'Secciones de ReFind' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await card.getByRole('link', { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`${detailUrl}$`));

  // Mis publicaciones.
  await page.getByRole('link', { name: 'Mis publicaciones' }).click();
  await expect(
    page.getByRole('article').filter({ hasText: title }),
  ).toContainText('Activa');

  await page
    .getByRole('link', { name: 'Objetos por zonas', exact: true })
    .click();
  await page
    .getByLabel('Universidad', { exact: true })
    .fill('Universidad de prueba');
  await page
    .getByLabel('Campus o sede', { exact: true })
    .fill('Campus central');
  await page
    .getByLabel('Tipo de objeto', { exact: true })
    .selectOption('found');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const mapped = page.locator('[data-zone-post]').filter({ hasText: title });
  await expect(mapped).toBeVisible();
  await mapped.getByRole('button', { name: 'Ver en el mapa' }).click();
  await expect(page.locator('.leaflet-popup')).toContainText(title);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/university-zones-mobile.png',
    fullPage: true,
  });
  await mapped.getByRole('link', { name: title, exact: true }).click();
  await page
    .getByRole('link', { name: 'Editar ubicación', exact: true })
    .click();
  await page.getByLabel('Qué señala el mapa').selectOption('exact');
  await page.locator('#location-map').click({ position: { x: 120, y: 120 } });
  await expect(page.getByLabel('Latitud', { exact: true })).not.toHaveValue(
    '40.4',
  );
  await page
    .getByLabel('Dónde está depositado ahora', { exact: true })
    .fill('Conserjería B');
  await page.getByRole('button', { name: 'Guardar ubicación' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'La ubicación se ha actualizado correctamente.' }),
  ).toBeVisible();
  await expect(page.locator('[data-post-map]')).toHaveAttribute(
    'data-mode',
    'exact',
  );
  await expect(page.getByText('Conserjería B', { exact: true })).toBeVisible();
});

/** Para qué sirve: impedir publicar sin sesión.
 * Qué comprueba: el botón de la portada lleva al acceso. */
test('sin sesión, publicar lleva al acceso', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Publicar objeto perdido' }).click();
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
});
