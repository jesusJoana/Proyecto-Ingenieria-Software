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
    page.getByRole("heading", {
      name: "Objetos que vuelven a historias",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Iniciar sesión", exact: true }),
  ).toBeVisible();

  // Verificar también la respuesta y página de una ruta inexistente.
  const missing = await page.goto("/ruta-inexistente-comprobacion-e2e");
  expect(missing.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Página no encontrada" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

/** I05: la portada consulta registros reales; una búsqueda inexistente no muestra ejemplos. */
test("busca en los hallazgos y muestra ausencia de coincidencias", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("[data-object-card]")).toHaveCount(0);
  await page.getByRole("searchbox").fill("sin-coincidencia-i05-917f42");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/\/publicaciones\?q=/);
  await expect(page.locator("[data-found-card]")).toHaveCount(0);
  await expect(
    page.getByText("No hay objetos que coincidan con tu búsqueda."),
  ).toBeVisible();
});

/**
 * Para qué sirve: Comprobar que las acciones aún pendientes informan sin simular un registro.
 * Qué comprueba: Contacto abre el aviso y Entendido lo cierra. (Publicar ya lleva al formulario
 * real; se comprueba en posts.spec.js.)
 */
test("las acciones pendientes informan sin simular un registro", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Contacto", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "todavía no está disponible",
  );
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
