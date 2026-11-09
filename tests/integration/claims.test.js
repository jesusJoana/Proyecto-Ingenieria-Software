import { readdir } from "node:fs/promises";
import { attachmentDirectory } from "../../src/claims/attachments.js";
import { test, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { foundFixture, publish } from "../helpers/found-fixtures.js";
import { claimSubmit, validClaim, pdf } from "../helpers/claim-fixtures.js";
import { createClaimsService } from "../../src/claims/service.js";
import { claimSchema } from "../../src/claims/validation.js";
let f, service;
beforeAll(async () => {
  f = await foundFixture();
  service = createClaimsService(f.pool);
});
afterAll(async () => f?.cleanup());
const create = async (id, change = {}, files = []) =>
  claimSubmit(
    f.other,
    `/publicaciones/${id}/reclamar`,
    validClaim(change),
    files,
  );
test("sesión, CSRF y objeto propio", async () => {
  const id = await publish(f);
  await request(f.app).get(`/publicaciones/${id}/reclamar`).expect(303);
  await claimSubmit(
    f.other,
    `/publicaciones/${id}/reclamar`,
    validClaim(),
    [],
    "",
  ).expect(403);
  await claimSubmit(f.author, `/publicaciones/${id}/reclamar`).expect(403);
});
test("alta vincula participantes de sesión, evidencia y conversación sin amistad", async () => {
  const id = await publish(f);
  const r = await create(
    id,
    { author_id: f.other.id, claimant_id: f.author.id, status: "accepted" },
    [pdf()],
  );
  expect(r.status).toBe(303);
  const cid = r.headers.location.split("/").pop();
  const claim = await service.get(cid, f.other.id);
  expect(claim.author_id).toBe(f.author.id);
  expect(claim.claimant_id).toBe(f.other.id);
  expect(claim.status).toBe("pending");
  expect(claim.date_unknown).toBe(true);
  expect(claim.lost_from).toBeNull();
  expect(await service.evidence(cid, f.author.id)).toHaveLength(1);
  await f.author.agent.get(r.headers.location).expect(200);
  await f.other.agent
    .get(`/publicaciones/${id}/reclamar`)
    .expect(303)
    .then((x) => expect(x.headers.location).toBe(r.headers.location));
  const list = await f.author.agent.get("/reclamaciones").expect(200);
  expect(list.text).toContain(r.headers.location);
});
for (const changes of [
  { description: "corta" },
  { distinguishing_details: "" },
  { lost_location: " " },
  { date_unknown: undefined, lost_from: "2999-01-01" },
])
  test(`datos inválidos no crean reclamación ${JSON.stringify(changes)}`, async () => {
    const id = await publish(f);
    const r = await create(id, changes);
    expect(r.status).toBe(422);
    expect(
      (await f.pool.query("SELECT id FROM claims WHERE object_id=$1", [id]))
        .rowCount,
    ).toBe(0);
    expect(r.text).toContain(changes.description ?? validClaim().description);
  });
test("rechaza adjuntos no válidos sin crear registros", async () => {
  const id = await publish(f);
  for (const files of [
    [{ ...pdf(), buffer: Buffer.from("no PDF") }],
    [pdf(), pdf(), pdf(), pdf()],
  ])
    expect((await create(id, {}, files)).status).toBe(422);
  expect(
    (await f.pool.query("SELECT id FROM claims WHERE object_id=$1", [id]))
      .rowCount,
  ).toBe(0);
});
test("dos envíos concurrentes dejan una reclamación y una conversación", async () => {
  const id = await publish(f);
  const results = await Promise.all([create(id), create(id)]);
  expect(results.map((r) => r.status).sort()).toEqual([303, 409]);
  expect(
    (await f.pool.query("SELECT id FROM claims WHERE object_id=$1", [id]))
      .rowCount,
  ).toBe(1);
});
test("objeto retirado no admite reclamaciones", async () => {
  const id = await publish(f);
  await f.pool.query(
    "UPDATE found_objects SET status='withdrawn',withdrawal_reason='Prueba' WHERE id=$1",
    [id],
  );
  expect((await create(id)).status).toBe(409);
});
test("repetición exige información y vincula antecedente del servidor", async () => {
  const id = await publish(f);
  const r = await create(id);
  const previous = r.headers.location.split("/").pop();
  await f.pool.query(
    "UPDATE claims SET status='rejected',decision_reason='No coincide' WHERE id=$1",
    [previous],
  );
  expect((await create(id)).status).toBe(422);
  const newer = await create(id, {
    additional_information: "Añado el número de serie guardado",
    previous_claim_id: "99999",
  });
  expect(newer.status).toBe(303);
  const claim = await service.get(
    newer.headers.location.split("/").pop(),
    f.other.id,
  );
  expect(claim.previous_claim_id).toBe(previous);
  await f.other.agent.get(`/reclamaciones/${previous}`).expect(200);
});
test("fallo de evidencia revierte reclamación y evento", async () => {
  const id = await publish(f);
  await expect(
    service.create(id, f.other.id, claimSchema.parse(validClaim()), [
      {
        storage_key: "invalid",
        original_name: "prueba.pdf",
        mime_type: "application/pdf",
        byte_size: 10,
      },
    ]),
  ).rejects.toThrow();
  expect(
    (await f.pool.query("SELECT id FROM claims WHERE object_id=$1", [id]))
      .rowCount,
  ).toBe(0);
  expect(
    (
      await f.pool.query(
        "SELECT id FROM activity_events WHERE object_id=$1 AND action='claimed'",
        [id],
      )
    ).rowCount,
  ).toBe(0);
});
for (const id of ["abc", "0", "99999999999999999999"])
  test(`id inválido ${id}`, async () =>
    await f.other.agent.get(`/reclamaciones/${id}`).expect(404));

test("cambio de disponibilidad entre formulario y guardado limpia archivos nuevos", async () => {
  const id = await publish(f);
  const files = () =>
    readdir(attachmentDirectory("test")).catch((e) => {
      if (e.code === "ENOENT") return [];
      throw e;
    });
  const before = (await files()).sort();
  const original = f.pool.query.bind(f.pool);
  let changed = false;
  const spy = vi.spyOn(f.pool, "query").mockImplementation((...args) => {
    const result = original(...args);
    if (
      !changed &&
      typeof args[0] === "string" &&
      args[0].startsWith("SELECT id,author_id,status,") &&
      args[1][0] === id
    ) {
      changed = true;
      return result.then(async (value) => {
        await original(
          "UPDATE found_objects SET status='withdrawn',withdrawal_reason='Cambio concurrente' WHERE id=$1",
          [id],
        );
        return value;
      });
    }
    return result;
  });
  try {
    expect((await create(id, {}, [pdf()])).status).toBe(409);
  } finally {
    spy.mockRestore();
  }
  expect(changed).toBe(true);
  expect((await files()).sort()).toEqual(before);
  expect(
    (await f.pool.query("SELECT id FROM claims WHERE object_id=$1", [id]))
      .rowCount,
  ).toBe(0);
});
test("listado de conversaciones pagina sin duplicar ni revelar otras cuentas", async () => {
  for (let i = 0; i < 21; i++) {
    const object = await publish(f);
    await service.create(object, f.other.id, claimSchema.parse(validClaim()));
  }
  const first = await service.list(f.author.id, 1),
    second = await service.list(f.author.id, 2);
  expect(first.claims).toHaveLength(20);
  expect(first.hasNext).toBe(true);
  expect(
    new Set([...first.claims, ...second.claims].map((c) => c.id)).size,
  ).toBe(first.claims.length + second.claims.length);
  expect(first.claims.every((c) => c.other_username === f.other.username)).toBe(
    true,
  );
});
