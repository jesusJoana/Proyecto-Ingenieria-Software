/** I05: publicación y consulta real; los detalles y fotos nunca llegan al visitante. */
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  browserPerson,
  cleanupBrowser,
  login,
  fillFound,
} from "../helpers/found-browser.js";
let person;
test.beforeEach(async ({ page }) => {
  person = await browserPerson();
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
});
test.afterEach(async () => cleanupBrowser(person));
test("publica, conserva valores tras error y consulta solo datos públicos", async ({
  page,
  browser,
}) => {
  await login(page, person);
  const type = `Mochila ${randomUUID().slice(0, 8)}`;
  await fillFound(page, { object_type: type, distinguishing_details: "Corta" });
  await page
    .getByRole("button", { name: "Publicar hallazgo", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Tipo general del objeto")).toHaveValue(type);
  await page
    .getByLabel("Detalles distintivos")
    .fill("Costura interior roja y tres bolsillos ocultos");
  await page
    .getByRole("button", { name: "Publicar hallazgo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/publicaciones\/\d+$/);
  const url = new URL(page.url()).pathname;
  await expect(
    page.getByRole("heading", { name: "Tus datos privados" }),
  ).toBeVisible();
  await expect(page.getByText("Sala secreta 42")).toBeVisible();
  await expect(page.locator("[data-map-point]")).toHaveAttribute(
    "data-lat",
    "40.41",
  );
  await page.screenshot({
    path: "test-results/i05-detail-desktop.png",
    fullPage: true,
  });
  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  try {
    const response = await publicPage.goto(url);
    expect(response.status()).toBe(200);
    const html = await response.text();
    for (const secret of [
      "Costura interior",
      "Sala secreta",
      "Taquilla privada",
      "NombrePrivado",
      person.email,
      "40.413456",
    ])
      expect(html).not.toContain(secret);
    await publicPage.goto("/");
    await expect(
      publicPage.locator("[data-found-card]").filter({ hasText: type }),
    ).toBeVisible();
    await publicPage.getByRole("searchbox").fill(type);
    await publicPage
      .getByRole("button", { name: "Buscar", exact: true })
      .click();
    await expect(publicPage.locator("[data-found-card]")).toHaveCount(1);
    await publicPage.getByRole("searchbox").fill("Costura interior roja");
    await publicPage
      .getByRole("button", { name: "Buscar", exact: true })
      .click();
    await expect(publicPage.locator("[data-found-card]")).toHaveCount(0);
    await publicPage.goto(`/objetos-por-zonas?q=${encodeURIComponent(type)}`);
    await expect(publicPage.locator("[data-map-point]")).toHaveCount(1);
    const circle = publicPage.locator(
      "[data-found-map] .leaflet-overlay-pane path",
    );
    await expect(circle).toHaveCount(1);
    await expect(circle).toBeVisible();
    await circle.click();
    await expect(publicPage.locator(".leaflet-popup-content")).toContainText(
      type,
    );
    await publicPage.setViewportSize({ width: 390, height: 844 });
    expect(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await publicPage.screenshot({
      path: "test-results/i05-map-mobile.png",
      fullPage: true,
    });
  } finally {
    await visitor.close();
  }
  await page.goto("/mis-publicaciones");
  await expect(
    page.locator("[data-found-card]").filter({ hasText: type }),
  ).toContainText("Disponible");
});
test("quien pierde consulta; publicar un hallazgo requiere acceso", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Buscar mi objeto", exact: true })
    .click();
  await expect(page).toHaveURL(/\/publicaciones$/);
  await page.goto("/");
  await page
    .getByRole("link", { name: "Publicar objeto encontrado", exact: true })
    .click();
  await expect(page).toHaveURL(/\/iniciar-sesion$/);
});
