import { beforeAll, afterAll, test, expect } from "vitest";
import request from "supertest";
import {
  foundFixture,
  publish,
  submit,
  validFound,
} from "../helpers/found-fixtures.js";
import { createPostsService } from "../../src/posts/service.js";
let f, service;
beforeAll(async () => {
  f = await foundFixture();
  service = createPostsService(f.pool);
});
afterAll(async () => {
  await f?.cleanup();
});

test("persiste posición privada, la excluye de terceros e historial público y conserva origen al cambiar custodia", async () => {
  const id = await publish(f, {
    found_latitude: "40.4134567",
    found_longitude: "-3.7123456",
    found_accuracy: "12",
    custody_latitude: "40.4234567",
    custody_longitude: "-3.7223456",
    custody_accuracy: "30",
  });
  const own = await service.findById(id, f.author.id);
  expect(own.private).toMatchObject({
    found_latitude: 40.4134567,
    found_accuracy: 12,
    custody_latitude: 40.4234567,
  });
  for (const viewer of [null, f.other.id]) {
    expect(await service.findById(id, viewer)).not.toHaveProperty("private");
  }
  for (const path of [
    `/publicaciones/${id}`,
    "/publicaciones",
    "/objetos-por-zonas",
  ]) {
    const res = await f.other.agent.get(path).expect(200);
    expect(res.text).not.toContain("40.4134567");
    expect(res.text).not.toContain("40.4234567");
  }
  await submit(f.author, `/publicaciones/${id}/editar`, {
    ...validFound(),
    exact_location: "Intento de cambiar origen",
    found_latitude: "20",
    found_longitude: "30",
    custody_latitude: "41.1234567",
    custody_longitude: "-4.1234567",
    deposit_location: "Conserjería nueva",
  }).expect(303);
  const updated = await service.findById(id, f.author.id);
  expect(updated.private).toMatchObject({
    found_latitude: 40.4134567,
    found_longitude: -3.7123456,
    exact_location: "Sala secreta 42",
    custody_latitude: 41.1234567,
    deposit_location: "Conserjería nueva",
  });
  const versions = await service.versions(id, f.author.id);
  expect(versions[0].private_data.custody_latitude).toBe(41.1234567);
  expect(versions[1].private_data.custody_latitude).toBe(40.4234567);
  expect(versions[0].public_data).not.toHaveProperty("found_latitude");
});

test("consulta de dirección exige sesión, CSRF y coordenadas válidas; admite proveedor no disponible", async () => {
  const url = "/publicaciones/ubicacion/direccion";
  await request(f.app)
    .post(url)
    .type("form")
    .send({ latitude: "40", longitude: "-3" })
    .expect(303);
  await f.author.agent
    .post(url)
    .type("form")
    .send({ latitude: "40", longitude: "-3" })
    .expect(403);
  await f.author.agent
    .post(url)
    .type("form")
    .send({ _csrf: f.author.csrf, latitude: "999", longitude: "0" })
    .expect(422);
  const res = await f.author.agent
    .post(url)
    .type("form")
    .send({ _csrf: f.author.csrf, latitude: "40", longitude: "-3" })
    .expect(200);
  expect(res.headers["cache-control"]).toContain("no-store");
  expect(res.body.address).toBeNull();
});
