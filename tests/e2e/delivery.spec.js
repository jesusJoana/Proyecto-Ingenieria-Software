import { test, expect } from "@playwright/test";
import {
  browserPerson,
  cleanupBrowser,
  login,
} from "../helpers/found-browser.js";
import { validFound } from "../helpers/found-fixtures.js";
import { validClaim } from "../helpers/claim-fixtures.js";
import { postSchema } from "../../src/posts/validation.js";
import { claimSchema } from "../../src/claims/validation.js";
import { createPostsService } from "../../src/posts/service.js";
import { createClaimsService } from "../../src/claims/service.js";
let author, claimant, other, object, a, b;
test.beforeEach(async () => {
  author = await browserPerson();
  claimant = await browserPerson();
  other = await browserPerson();
  object = (
    await createPostsService(author.pool).create(
      author.id,
      postSchema.parse(validFound()),
    )
  ).id;
  const service = createClaimsService(author.pool);
  a = (
    await service.create(object, claimant.id, claimSchema.parse(validClaim()))
  ).id;
  b = (await service.create(object, other.id, claimSchema.parse(validClaim())))
    .id;
});
test.afterEach(async () => {
  await cleanupBrowser(author);
  await cleanupBrowser(claimant);
  await cleanupBrowser(other);
});
test("reserva, espera, cancelación, devolución y avisos desde tres cuentas", async ({
  page,
  browser,
}) => {
  const c = await browser.newContext(),
    d = await browser.newContext();
  try {
    const cp = await c.newPage(),
      op = await d.newPage();
    await login(page, author);
    await login(cp, claimant);
    await login(op, other);
    await cp.goto(`/reclamaciones/${a}`);
    await cp
      .getByLabel("Mensaje", { exact: true })
      .fill("Borrador conservado durante el cambio de estado");
    await page.goto(`/reclamaciones/${a}`);
    await page
      .getByRole("button", { name: "Aceptar reclamación y reservar" })
      .click();
    await expect(cp.locator("[data-action-update]")).toBeVisible({
      timeout: 8000,
    });
    await expect(cp.locator("[data-claim-status]")).toHaveText("Aceptada");
    await expect(cp.getByLabel("Mensaje", { exact: true })).toHaveValue(
      "Borrador conservado durante el cambio de estado",
    );
    await expect(
      cp.getByRole("button", { name: "Cancelar solicitud", exact: true }),
    ).toBeDisabled();
    await op.goto(`/reclamaciones/${b}`);
    await expect(op.locator("[data-claim-status]")).toHaveText("En espera");
    await expect(op.getByText(claimant.username, { exact: true })).toHaveCount(
      0,
    );
    await cp.goto(`/reclamaciones/${a}`);
    await cp
      .getByLabel("Motivo de la cancelación")
      .fill("No puedo recogerlo hoy");
    await cp
      .getByRole("button", { name: "Cancelar reserva", exact: true })
      .click();
    await expect(cp.locator("[data-claim-status]")).toHaveText("Cancelada");
    await op.goto("/avisos");
    await expect(
      op.getByRole("heading", {
        name: "Reclamación pendiente de nuevo",
        exact: true,
      }),
    ).toBeVisible();
    await op.getByRole("button", { name: "Marcar como leído" }).first().click();
    await expect(op.getByText("Leído", { exact: true }).first()).toBeVisible();
    await page.goto(`/reclamaciones/${b}`);
    await page
      .getByRole("button", { name: "Aceptar reclamación y reservar" })
      .click();
    await page.getByLabel("Confirmo que he entregado el objeto").check();
    await page
      .getByRole("button", { name: "Confirmar entrega", exact: true })
      .click();
    await expect(
      page.getByText("La reserva se mantiene.", { exact: false }),
    ).toBeVisible();
    await op.goto(`/reclamaciones/${b}`);
    await op.getByLabel("Confirmo que he recibido el objeto").check();
    await op
      .getByRole("button", { name: "Confirmar recepción", exact: true })
      .click();
    await expect(op.locator("[data-claim-status]")).toHaveText("Completada");
    await op.goto("/actividad");
    await expect(
      op.getByRole("heading", { name: "Devolución completada", exact: true }),
    ).toBeVisible();
    await page.goto("/perfil");
    await expect(
      page.getByText("Devoluciones completadas", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Intercambios completados", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: "test-results/i07-profile-desktop.png",
      fullPage: true,
    });
    const anonymous = await browser.newContext();
    try {
      const p = await anonymous.newPage();
      expect((await p.goto(`/publicaciones/${object}`)).status()).toBe(404);
    } finally {
      await anonymous.close();
    }
  } finally {
    await c.close();
    await d.close();
  }
});
test("incidencia, acuerdo bilateral, anulación y cancelación con vista móvil", async ({
  page,
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const cp = await context.newPage();
    await login(page, author);
    await login(cp, claimant);
    await page.goto(`/reclamaciones/${a}`);
    await page
      .getByRole("button", { name: "Aceptar reclamación y reservar" })
      .click();
    await page.getByLabel("Confirmo que he entregado el objeto").check();
    await page
      .getByRole("button", { name: "Confirmar entrega", exact: true })
      .click();
    await cp.goto(`/reclamaciones/${a}`);
    await expect(
      cp.getByRole("button", { name: "Cancelar reserva", exact: true }),
    ).toHaveCount(0);
    await cp
      .getByLabel("Motivo de la incidencia")
      .fill("Se confirmó la entrega antes de tiempo");
    await cp.getByRole("button", { name: "Registrar incidencia" }).click();
    await cp.getByLabel("Acepto anular la confirmación registrada").check();
    await cp.getByRole("button", { name: "Acordar anulación" }).click();
    await expect(
      cp.getByText("Acuerdo del autor: pendiente.", { exact: false }),
    ).toBeVisible();
    await page.reload();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "test-results/i07-incident-mobile.png",
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.body.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByLabel("Acepto anular la confirmación registrada").check();
    await page.getByRole("button", { name: "Acordar anulación" }).click();
    await page
      .getByLabel("Motivo de la cancelación")
      .fill("Ambas partes acordamos cancelar");
    await page
      .getByRole("button", { name: "Cancelar reserva", exact: true })
      .click();
    await expect(page.locator("[data-claim-status]")).toHaveText("Cancelada");
    await page.goto("/actividad");
    await expect(
      page.getByRole("heading", {
        name: "Confirmación anulada por acuerdo de ambos",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
test("rechazo con motivo y retirada cierran solicitudes y mantienen consulta", async ({
  page,
  browser,
}) => {
  await login(page, author);
  await page.goto(`/reclamaciones/${a}`);
  await page.getByLabel("Motivo del rechazo").fill("Los detalles no coinciden");
  await page
    .getByRole("button", { name: "Rechazar reclamación", exact: true })
    .click();
  await expect(page.locator("[data-claim-status]")).toHaveText("Rechazada");
  await page.goto(`/publicaciones/${object}/retirar`);
  await page
    .getByLabel("Motivo de la retirada")
    .fill("Custodia trasladada a conserjería");
  await page.getByLabel("Confirmo la retirada del hallazgo").check();
  await page
    .getByRole("button", { name: "Retirar hallazgo", exact: true })
    .click();
  const context = await browser.newContext();
  try {
    const cp = await context.newPage();
    await login(cp, other);
    await cp.goto(`/reclamaciones/${b}`);
    await expect(cp.locator("[data-claim-status]")).toHaveText(
      "Cerrada por retirada",
    );
    await expect(
      cp.getByRole("button", { name: "Enviar mensaje" }),
    ).toHaveCount(0);
    await cp.goto("/avisos");
    await expect(
      cp.getByRole("heading", { name: "Hallazgo retirado", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
