import { test, expect } from "@playwright/test";
import {
  browserPerson,
  cleanupBrowser,
  login,
  fillFound,
} from "../helpers/found-browser.js";
import { pdf } from "../helpers/claim-fixtures.js";
let author, claimant, third;
test.beforeEach(async () => {
  author = await browserPerson();
  claimant = await browserPerson();
  third = await browserPerson();
});
test.afterEach(async () => {
  await cleanupBrowser(author);
  await cleanupBrowser(claimant);
  await cleanupBrowser(third);
});
test("reclamar abre conversación privada sin amistad, con adjuntos y recepción sin perder borrador", async ({
  page,
  browser,
}) => {
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await login(page, author);
  await fillFound(page);
  await page
    .getByRole("button", { name: "Publicar hallazgo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/publicaciones\/\d+$/);
  const objectUrl = new URL(page.url()).pathname;
  const second = await browser.newContext(),
    outsider = await browser.newContext();
  try {
    const b = await second.newPage();
    await b.route("https://tile.openstreetmap.org/**", (r) => r.abort());
    await login(b, claimant);
    await b.goto(objectUrl);
    await expect(
      b.getByRole("heading", { name: "Tus datos privados" }),
    ).toHaveCount(0);
    await b.getByRole("link", { name: "Reclamar objeto", exact: true }).click();
    await b.getByLabel("Descripción del objeto").fill("Corta");
    await b
      .getByLabel("Detalles distintivos que recuerdas")
      .fill("Costura interior roja y un bolsillo oculto");
    await b.getByLabel("Dónde lo perdiste").fill("Biblioteca del campus");
    await b.getByLabel("No lo recuerdo").check();
    await b.getByRole("button", { name: "Enviar reclamación" }).click();
    await expect(b.getByRole("alert")).toBeVisible();
    await expect(b.getByLabel("Dónde lo perdiste")).toHaveValue(
      "Biblioteca del campus",
    );
    await b
      .getByLabel("Descripción del objeto")
      .fill("Mochila de tela con asa ancha");
    const file = pdf();
    await b
      .getByLabel("Pruebas adjuntas (opcionales)")
      .setInputFiles({
        name: file.name,
        mimeType: file.type,
        buffer: file.buffer,
      });
    await b.screenshot({
      path: "test-results/i06-form-desktop.png",
      fullPage: true,
    });
    await b.getByRole("button", { name: "Enviar reclamación" }).click();
    await expect(b).toHaveURL(/\/reclamaciones\/\d+$/);
    const claimUrl = new URL(b.url()).pathname;
    await b
      .getByLabel("Mensaje", { exact: true })
      .fill("Hola, puedo describir el contenido");
    await b.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(b.locator("[data-messages]")).toContainText(
      "Hola, puedo describir el contenido",
    );
    await b
      .getByLabel("Mensaje", { exact: true })
      .fill("Borrador que debe conservarse");
    await page.goto("/reclamaciones");
    await page.getByRole("link", { name: /Mochila encontrado/ }).click();
    await expect(page.locator("[data-messages]")).toContainText(
      "Hola, puedo describir el contenido",
    );
    const download = page.getByRole("link", {
      name: "prueba.pdf",
      exact: true,
    });
    expect(
      (await page.request.get(await download.getAttribute("href"))).status(),
    ).toBe(200);
    await page
      .getByLabel("Mensaje", { exact: true })
      .fill("Puedes indicar los detalles del interior");
    await page
      .getByLabel("Adjuntos del mensaje (opcionales)")
      .setInputFiles({
        name: "respuesta.pdf",
        mimeType: file.type,
        buffer: file.buffer,
      });
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(b.locator("[data-messages]")).toContainText(
      "Puedes indicar los detalles del interior",
      { timeout: 12000 },
    );
    await expect(b.getByLabel("Mensaje", { exact: true })).toHaveValue(
      "Borrador que debe conservarse",
    );
    await expect(
      b.getByRole("link", { name: "respuesta.pdf", exact: true }),
    ).toBeVisible();
    const outsiderPage = await outsider.newPage();
    await login(outsiderPage, third);
    expect((await outsiderPage.goto(claimUrl)).status()).toBe(404);
    const attachment = await b
      .getByRole("link", { name: "respuesta.pdf", exact: true })
      .getAttribute("href");
    expect((await outsiderPage.request.get(attachment)).status()).toBe(404);
    await b.setViewportSize({ width: 390, height: 844 });
    expect(
      await b.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await b.screenshot({
      path: "test-results/i06-chat-mobile.png",
      fullPage: true,
    });
    const claimId = claimUrl.split("/").pop();
    await author.pool.query(
      "UPDATE claims SET status='rejected',decision_reason='No coincide' WHERE id=$1",
      [claimId],
    );
    await b.reload();
    await expect(b.getByLabel("Mensaje", { exact: true })).toHaveCount(0);
    await expect(
      b.getByText("La conversación está cerrada y solo permite consulta."),
    ).toBeVisible();
    await expect(
      b.getByRole("link", { name: "respuesta.pdf", exact: true }),
    ).toBeVisible();
    await b.goto(objectUrl);
    await b.getByRole("link", { name: "Reclamar objeto", exact: true }).click();
    await expect(
      b.getByRole("link", { name: "Consultar antecedente" }),
    ).toHaveAttribute("href", claimUrl);
    await expect(
      b.getByLabel("Qué información adicional aportas"),
    ).toBeVisible();
  } finally {
    await second.close();
    await outsider.close();
  }
});
