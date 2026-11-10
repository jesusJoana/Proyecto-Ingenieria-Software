import { test, expect } from "@playwright/test";
import {
  browserPerson,
  cleanupBrowser,
  login,
  fillFound,
} from "../helpers/found-browser.js";
let person;
test.beforeEach(async ({ page }) => {
  person = await browserPerson();
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
});
test.afterEach(async () => cleanupBrowser(person));

test("captura puntual, revisión, dirección opcional, privacidad y cambio de custodia", async ({
  page,
  context,
  browser,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 40.4134567,
    longitude: -3.7123456,
    accuracy: 25,
  });
  await page.route("**/publicaciones/ubicacion/direccion", (route) =>
    route.fulfill({ json: { address: "Biblioteca central, Madrid" } }),
  );
  await login(page, person);
  await fillFound(page);
  const found = page.locator('[data-private-location][data-prefix="found"]');
  await found.locator("[data-location-description]").fill("");
  await expect(found.locator("[data-private-lat]")).toHaveValue("");
  await found
    .getByRole("button", { name: "Usar mi ubicación actual", exact: true })
    .click();
  await expect(
    found.getByRole("status", { name: "Estado de la ubicación" }),
  ).toContainText("25 metros");
  await expect(found.locator("[data-private-lat]")).toHaveValue("40.4134567");
  await expect(found.locator("[data-location-description]")).toHaveValue(
    "Biblioteca central, Madrid",
  );
  await expect(found.locator(".leaflet-marker-draggable")).toBeVisible();
  await page
    .getByRole("button", { name: "Publicar hallazgo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/publicaciones\/\d+$/);
  const url = page.url();
  await expect(
    page.getByText("Coordenadas originales del hallazgo:"),
  ).toBeVisible();
  const guest = await browser.newContext();
  try {
    const response = await guest.request.get(url);
    expect(await response.text()).not.toContain("40.4134567");
    expect(await response.text()).not.toContain("Biblioteca central, Madrid");
  } finally {
    await guest.close();
  }
  await page
    .getByRole("link", { name: "Editar hallazgo", exact: true })
    .click();
  await context.setGeolocation({
    latitude: 41.1234567,
    longitude: -4.1234567,
    accuracy: 250,
  });
  const custody = page.locator(
    '[data-private-location][data-prefix="custody"]',
  );
  await custody
    .getByRole("button", { name: /Usar mi ubicación actual/ })
    .click();
  await expect(
    custody.getByRole("status", { name: "Estado de la ubicación" }),
  ).toContainText("Precisión baja");
  await custody
    .locator("[data-location-description]")
    .fill("Conserjería del edificio A");
  // Corregir el punto elimina la precisión del GPS, que ya no corresponde al punto manual.
  const map = custody.locator("[data-private-map]");
  await map.click({ position: { x: 180, y: 150 } });
  await expect(
    custody.getByRole("status", { name: "Estado de la ubicación" }),
  ).toContainText("Punto ajustado manualmente");
  await expect(custody.locator("[data-private-accuracy]")).toHaveValue("");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page.getByText("Biblioteca central, Madrid", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Conserjería del edificio A", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("40.4134567");
});

test("permiso denegado permite escribir y publicar sin mapa en móvil", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.locationRequests = 0;
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (_success, error) => {
          window.locationRequests++;
          error({ code: 1 });
        },
      },
    });
  });
  await page.route("**/vendor/leaflet/leaflet.js", (route) => route.abort());
  await login(page, person);
  await fillFound(page);
  expect(await page.evaluate(() => window.locationRequests)).toBe(0);
  const found = page.locator('[data-prefix="found"]');
  await found
    .getByRole("button", { name: "Usar mi ubicación actual", exact: true })
    .click();
  await expect(
    found.getByRole("status", { name: "Estado de la ubicación" }),
  ).toContainText("Permiso de ubicación denegado");
  await found.getByRole("button", { name: "Introducir manualmente" }).click();
  await found
    .locator("[data-location-description]")
    .fill("Biblioteca, planta baja");
  await page
    .getByRole("button", { name: "Publicar hallazgo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/publicaciones\/\d+$/);
  await expect(
    page.getByText("Biblioteca, planta baja", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("un error de dirección conserva la ubicación y una captura tardía no deshace la entrada manual", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (success) => {
          window.finishLocation = () =>
            success({
              coords: { latitude: 40.4, longitude: -3.7, accuracy: 10 },
            });
        },
      },
    });
  });
  await login(page, person);
  await fillFound(page);
  const found = page.locator('[data-prefix="found"]');
  await found
    .getByRole("button", { name: "Usar mi ubicación actual", exact: true })
    .click();
  await found.getByRole("button", { name: "Introducir manualmente" }).click();
  await found
    .locator("[data-location-description]")
    .fill("Lugar corregido a mano");
  await page.evaluate(() => window.finishLocation());
  await expect(found.locator("[data-private-lat]")).toHaveValue("");
  await expect(found.locator("[data-location-description]")).toHaveValue(
    "Lugar corregido a mano",
  );
  await page.route("**/publicaciones/ubicacion/direccion", (route) =>
    route.abort(),
  );
  await found
    .getByRole("button", { name: "Usar mi ubicación actual", exact: true })
    .click();
  await page.evaluate(() => window.finishLocation());
  await expect(found.locator("[data-private-lat]")).toHaveValue("40.4000000");
  await page
    .getByRole("button", { name: "Publicar hallazgo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/publicaciones\/\d+$/);
});
