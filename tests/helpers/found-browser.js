import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import pg from "pg";
import { readConfig } from "../../src/config.js";
import { cleanupFound, validFound } from "./found-fixtures.js";
export async function browserPerson() {
  const browserPool = new pg.Pool({
    connectionString: readConfig("e2e").DATABASE_URL,
  });
  const username = `i05-${randomUUID().slice(0, 8)}`,
    email = `${username}@example.test`,
    password = "Una frase segura 42";
  const {
    rows: [row],
  } = await browserPool.query(
    `INSERT INTO users(username,first_name,last_name,email,password_hash) VALUES($1,'NombrePrivado','ApellidoPrivado',$2,$3) RETURNING id`,
    [username, email, await argon2.hash(password)],
  );
  return { ...row, username, email, password, pool: browserPool };
}
export async function cleanupBrowser(person) {
  if (!person) return;
  try {
    await cleanupFound(person.pool, [person.id], "e2e");
  } finally {
    await person.pool.end();
  }
}
export async function login(page, person) {
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico").fill(person.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(person.password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: false })
    .click();
  await page.waitForURL("/");
}
export async function fillFound(page, changes = {}) {
  const values = validFound(changes);
  await page.goto("/publicaciones/nueva");
  for (const key of [
    "object_type",
    "university",
    "campus",
    "general_area",
    "found_from",
    "found_until",
    "distinguishing_details",
    "exact_location",
    "deposit_location",
  ])
    await page.locator(`[name="${key}"]`).fill(values[key]);
  await page.getByLabel("Categoría").selectOption(values.category);
  await page
    .getByText("Referencia del campus en el mapa (opcional)", { exact: true })
    .click();
  await page.getByLabel("Latitud del campus").fill(values.campus_latitude);
  await page.getByLabel("Longitud del campus").fill(values.campus_longitude);
  return values;
}
