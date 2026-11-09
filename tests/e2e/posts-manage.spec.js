/** I05: edición versionada y retirada; reserva y devolución pertenecen a I07. */
import { test, expect } from "@playwright/test";
import sharp from "sharp";
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
test("edita con foto privada, conserva versiones y retira sin borrar", async ({
  page,
  browser,
}) => {
  await login(page, person);
  await fillFound(page);
  await page
    .getByRole("button", { name: "Publicar hallazgo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/publicaciones\/\d+$/);
  const url = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Editar hallazgo" }).click();
  await page.getByLabel("Tipo general del objeto").fill("Estuche");
  await page.getByLabel("Fotografía privada (opcional)").setInputFiles({
    name: "estuche.png",
    mimeType: "image/png",
    buffer: await sharp({
      create: { width: 60, height: 40, channels: 3, background: "#2f8a4c" },
    })
      .png()
      .toBuffer(),
  });
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("heading", { name: /Estuche/ })).toBeVisible();
  const photo = page.getByAltText("Foto privada del hallazgo");
  await expect(photo).toBeVisible();
  const photoUrl = await photo.getAttribute("src");
  expect((await page.request.get(photoUrl)).status()).toBe(200);
  await page.getByRole("link", { name: "Editar hallazgo" }).click();
  await page.getByLabel("Quitar la foto actual").check();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByAltText("Foto privada del hallazgo")).toHaveCount(0);
  await page.getByRole("link", { name: "Consultar versiones" }).click();
  await expect(
    page.getByRole("heading", { name: "Versión 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Versión 3", exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText("Foto privada de la versión 2")).toBeVisible();
  await page.goto(url);
  await page.getByRole("link", { name: "Retirar hallazgo" }).click();
  await page
    .getByLabel("Motivo de la retirada")
    .fill("Depositado en la oficina central");
  await page.getByLabel("Confirmo la retirada del hallazgo").check();
  await page
    .getByRole("button", { name: "Retirar hallazgo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/mis-publicaciones$/);
  await expect(
    page.locator("[data-found-card]").filter({ hasText: "Estuche" }),
  ).toContainText("Retirado");
  await page.goto(url);
  await expect(page.getByRole("link", { name: "Editar hallazgo" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Consultar versiones" }),
  ).toBeVisible();
  expect((await page.request.get(photoUrl)).status()).toBe(200);
  const visitor = await browser.newContext();
  try {
    const p = await visitor.newPage();
    expect((await p.goto(url)).status()).toBe(404);
    expect((await p.request.get(photoUrl, { maxRedirects: 0 })).status()).toBe(
      303,
    );
  } finally {
    await visitor.close();
  }
});
