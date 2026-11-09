import { test, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { foundFixture, publish } from "../helpers/found-fixtures.js";
import { claimSubmit, validClaim, pdf } from "../helpers/claim-fixtures.js";
import { createClaimsService } from "../../src/claims/service.js";
import { claimSchema } from "../../src/claims/validation.js";
let f, g, service;
beforeAll(async () => {
  f = await foundFixture();
  g = await foundFixture();
  service = createClaimsService(f.pool);
});
afterAll(async () => {
  await f?.cleanup();
  await g?.cleanup();
});
async function fixture(files = []) {
  const object = await publish(f);
  const r = await claimSubmit(
    f.other,
    `/publicaciones/${object}/reclamar`,
    validClaim(),
    files,
  ).expect(303);
  return { object, id: r.headers.location.split("/").pop() };
}
const send = (
  person,
  id,
  body = "Mensaje privado de comprobación",
  files = [],
) => claimSubmit(person, `/reclamaciones/${id}/mensajes`, { body }, files);
test("autor y reclamante conversan y descargan adjuntos; terceros excluidos", async () => {
  const { id, object } = await fixture([pdf()]);
  await send(f.author, id, "Respuesta solo para reclamante", [pdf()]).expect(
    303,
  );
  const otherClaim = await service.create(
    object,
    g.other.id,
    claimSchema.parse(validClaim()),
  );
  for (const person of [f.author, f.other]) {
    const r = await person.agent.get(`/reclamaciones/${id}`).expect(200);
    expect(r.text).toContain("Respuesta solo para reclamante");
    expect(r.text).not.toContain("Sala secreta 42");
    expect(r.text).not.toContain("Taquilla privada 17");
    const files = [
      ...r.text.matchAll(/href="(\/reclamaciones\/\d+\/archivos\/[^\"]+)"/g),
    ].map((m) => m[1]);
    expect(files).toHaveLength(2);
    for (const url of files) {
      await person.agent
        .get(url)
        .expect(200)
        .then((x) => {
          expect(x.headers["cache-control"]).toContain("no-store");
          expect(x.headers["content-disposition"]).toContain("attachment");
        });
      await g.other.agent.get(url).expect(404);
      await request(f.app).get(url).expect(303);
      await person.agent
        .get(
          url.replace(
            `/reclamaciones/${id}/`,
            `/reclamaciones/${otherClaim.id}/`,
          ),
        )
        .expect(404);
    }
  }
  for (const url of [
    `/reclamaciones/${id}`,
    `/reclamaciones/${id}/mensajes.json`,
  ])
    await g.other.agent.get(url).expect(404);
  await send(g.other, id).expect(404);
  const list = await g.other.agent.get("/reclamaciones").expect(200);
  expect(list.text).not.toContain(`href="/reclamaciones/${id}"`);
  expect(list.text).toContain(`href="/reclamaciones/${otherClaim.id}"`);
});
test("mensajes exigen CSRF y texto y no interpretan HTML", async () => {
  const { id } = await fixture();
  await claimSubmit(
    f.other,
    `/reclamaciones/${id}/mensajes`,
    { body: "Prueba" },
    [],
    "",
  ).expect(403);
  await send(f.other, id, " ").expect(422);
  await send(f.other, id, "<script>alert(1)</script>").expect(303);
  const page = await f.author.agent.get(`/reclamaciones/${id}`).expect(200);
  expect(page.text).toContain("&lt;script&gt;");
  expect(page.text).not.toContain("<script>alert");
});
test("conversación cerrada permite leer y descargar, nunca escribir", async () => {
  const { id } = await fixture([pdf()]);
  await send(f.other, id).expect(303);
  await f.pool.query(
    "UPDATE claims SET status='rejected',decision_reason='No coincide' WHERE id=$1",
    [id],
  );
  await send(f.other, id, "Intento cerrado", [pdf()]).expect(409);
  const result = await f.author.agent
    .get(`/reclamaciones/${id}/mensajes.json`)
    .expect(200);
  expect(result.body.writable).toBe(false);
  expect(result.body.messages).toHaveLength(1);
  const page = await f.other.agent.get(`/reclamaciones/${id}`).expect(200);
  expect(page.text).not.toContain("data-message-form");
  const key = (await service.evidence(id, f.other.id))[0].storage_key;
  await f.other.agent.get(`/reclamaciones/${id}/archivos/${key}`).expect(200);
});
test("sondeo paginado y mensajes anteriores no pierden envíos", async () => {
  const { id } = await fixture();
  for (let n = 0; n < 53; n++)
    await service.send(id, f.other.id, `Mensaje ${n}`);
  const initial = await service.messages(id, f.author.id);
  expect(initial.messages).toHaveLength(50);
  expect(initial.messages[0].body).toBe("Mensaje 3");
  expect(initial.more).toBe(true);
  const older = await service.messages(id, f.author.id, {
    before: initial.messages[0].id,
  });
  expect(older.messages.map((m) => m.body)).toEqual([
    "Mensaje 0",
    "Mensaje 1",
    "Mensaje 2",
  ]);
  const first = await f.author.agent
    .get(`/reclamaciones/${id}/mensajes.json?after=0`)
    .expect(200);
  expect(first.body.messages).toHaveLength(50);
  expect(first.body.more).toBe(true);
  const second = await f.author.agent
    .get(
      `/reclamaciones/${id}/mensajes.json?after=${first.body.messages.at(-1).id}`,
    )
    .expect(200);
  expect(second.body.messages.map((m) => m.body)).toEqual([
    "Mensaje 50",
    "Mensaje 51",
    "Mensaje 52",
  ]);
  const values = JSON.stringify(second.body);
  expect(values).not.toContain("distinguishing_details");
  expect(values).not.toContain(f.other.email);
});
test("cierre concurrente impide insertar después del bloqueo", async () => {
  const { id } = await fixture();
  const c = await f.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "UPDATE claims SET status='cancelled',decision_reason='Prueba concurrente' WHERE id=$1",
      [id],
    );
    const pending = service.send(id, f.other.id, "No debe guardarse");
    const assertion = expect(pending).rejects.toThrow("cerrada");
    await c.query("COMMIT");
    await assertion;
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
  expect((await service.messages(id, f.other.id)).messages).toHaveLength(0);
});
test("fallo de adjunto revierte el mensaje", async () => {
  const { id } = await fixture();
  await expect(
    service.send(id, f.other.id, "Mensaje con fallo", [
      {
        storage_key: "bad",
        original_name: "x.pdf",
        mime_type: "application/pdf",
        byte_size: 1,
      },
    ]),
  ).rejects.toThrow();
  expect((await service.messages(id, f.other.id)).messages).toHaveLength(0);
});
test("parámetros de paginación y rutas malformadas se rechazan", async () => {
  const { id } = await fixture();
  await f.author.agent.get(`/reclamaciones/${id}?before=bad`).expect(400);
  await f.author.agent
    .get(`/reclamaciones/${id}/mensajes.json?after=bad`)
    .expect(400);
  await f.author.agent.get("/reclamaciones?page=-1").expect(400);
  await f.author.agent.get(`/reclamaciones/${id}/archivos/invalid`).expect(404);
});
