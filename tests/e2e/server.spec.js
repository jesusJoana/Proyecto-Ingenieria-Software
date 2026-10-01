/**
 * Comprobación básica del servidor actual desde un navegador real.
 * Los flujos reales de registro y acceso se comprueban en auth.spec.js.
 * Playwright arranca ReFind con .env.e2e mediante playwright.config.js.
 */
import { test, expect } from "@playwright/test";

/**
 * Para qué sirve: Comprobar desde Chromium la portada y la pantalla de página no encontrada.
 * Qué comprueba: La portada responde HTTP 200 y muestra el título y el botón Iniciar sesión;
 * una ruta inexistente responde HTTP 404 y muestra su título. No se producen errores JavaScript
 * durante esas visitas.
 */
test("la página inicial carga y permite navegar sin errores de JavaScript", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/");
  expect(response.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Encuéntralo con ReFind", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();

  // Verificar también la respuesta y página de una ruta inexistente.
  const missing = await page.goto("/ruta-inexistente-comprobacion-e2e");
  expect(missing.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Página no encontrada" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

/**
 * Para qué sirve: Comprobar el filtrado y la recuperación de una búsqueda sin coincidencias.
 * Qué comprueba: Hay tres ejemplos; Perdidos deja solo las llaves; buscar paraguas no muestra
 * tarjetas y presenta el aviso; Ver todos restaura las tres. Solo utiliza ejemplos locales, no
 * publicaciones de la base de datos.
 */
test("permite filtrar los ejemplos y recuperarse de una búsqueda sin resultados", async ({
  page,
}) => {
  await page.goto("/");
  const cards = page.locator("[data-object-card]:visible");
  await expect(cards).toHaveCount(3);
  await page.getByRole("button", { name: "Perdidos", exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Llaves con llavero azul");
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await page.getByRole("searchbox").fill("paraguas");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(cards).toHaveCount(0);
  await expect(
    page.getByText("No hay objetos que coincidan con tu búsqueda."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver todos", exact: true }).click();
  await expect(cards).toHaveCount(3);
});

/**
 * Para qué sirve: Comprobar que la publicación todavía informa de que está pendiente.
 * Qué comprueba: Publicar objeto perdido abre el aviso y Entendido lo cierra.
 */
test("las acciones pendientes informan sin simular un registro", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Publicar objeto perdido", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "todavía no está disponible",
  );
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
