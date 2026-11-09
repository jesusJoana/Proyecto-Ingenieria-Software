import { beforeAll, afterAll, expect, test } from "vitest";
import request from "supertest";
import sharp from "sharp";
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
const image = async () => ({
  buffer: await sharp({
    create: { width: 30, height: 30, channels: 3, background: "#567812" },
  })
    .png()
    .toBuffer(),
  options: { filename: "photo.png", contentType: "image/png" },
});
const withdraw = (
  person,
  id,
  data = { reason: "Ya no lo conservo", confirm: "1" },
) =>
  person.agent
    .post(`/publicaciones/${id}/retirar`)
    .type("form")
    .send({ _csrf: person.csrf, ...data });
async function reserve(id) {
  const c = await f.pool.connect();
  try {
    await c.query("BEGIN");
    const {
      rows: [claim],
    } = await c.query(
      "INSERT INTO claims(object_id,author_id,claimant_id,description,distinguishing_details,lost_location,date_unknown) VALUES ($1,$2,$3,'Descripción','Detalle','Lugar',true) RETURNING id",
      [id, f.author.id, f.other.id],
    );
    await c.query("UPDATE claims SET status='accepted' WHERE id=$1", [
      claim.id,
    ]);
    await c.query("UPDATE found_objects SET status='reserved' WHERE id=$1", [
      id,
    ]);
    await c.query("COMMIT");
    return claim.id;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
test("edición y retirada exigen autor y CSRF", async () => {
  const id = await publish(f);
  await f.other.agent.get(`/publicaciones/${id}/editar`).expect(403);
  await submit(f.other, `/publicaciones/${id}/editar`).expect(403);
  await withdraw(f.other, id).expect(403);
  await submit(
    f.author,
    `/publicaciones/${id}/editar`,
    validFound(),
    null,
    "",
  ).expect(403);
  await f.author.agent
    .post(`/publicaciones/${id}/retirar`)
    .type("form")
    .send({ reason: "Motivo", confirm: "1" })
    .expect(403);
  await request(f.app).get(`/publicaciones/${id}/editar`).expect(303);
  await request(f.app).get(`/publicaciones/${id}/retirar`).expect(303);
});
test("edita datos públicos y privados, conserva autor y versiones", async () => {
  const id = await publish(f);
  await submit(
    f.author,
    `/publicaciones/${id}/editar`,
    validFound({
      object_type: "Bolso",
      distinguishing_details: "Nuevo detalle reservado",
      author_id: f.other.id,
      status: "returned",
    }),
  ).expect(303);
  const post = await service.findById(id, f.author.id);
  expect(post.object_type).toBe("Bolso");
  expect(post.status).toBe("available");
  expect(post.isAuthor).toBe(true);
  const versions = await service.versions(id, f.author.id);
  expect(versions).toHaveLength(2);
  expect(versions[1].private_data.distinguishing_details).toContain("Costura");
  await f.author.agent.get(`/publicaciones/${id}/historial`).expect(200);
  await f.other.agent.get(`/publicaciones/${id}/historial`).expect(403);
});
test("error de edición conserva datos y no añade versión", async () => {
  const id = await publish(f);
  await submit(
    f.author,
    `/publicaciones/${id}/editar`,
    validFound({ object_type: "" }),
  ).expect(422);
  expect(await service.versions(id, f.author.id)).toHaveLength(1);
  expect((await service.findById(id, f.author.id)).object_type).toBe("Mochila");
});
test("sustituir/quitar foto conserva fotos históricas privadas", async () => {
  const id = await publish(f, {}, await image());
  const original = (await service.findById(id, f.author.id)).private.photo_key;
  await submit(
    f.author,
    `/publicaciones/${id}/editar`,
    validFound(),
    await image(),
  ).expect(303);
  const replacement = (await service.findById(id, f.author.id)).private
    .photo_key;
  expect(replacement).not.toBe(original);
  await submit(
    f.author,
    `/publicaciones/${id}/editar`,
    validFound({ remove_photo: "1" }),
  ).expect(303);
  expect(
    (await service.findById(id, f.author.id)).private.photo_key,
  ).toBeNull();
  for (const key of [original, replacement]) {
    await f.author.agent.get(`/publicaciones/${id}/fotos/${key}`).expect(200);
    await f.other.agent.get(`/publicaciones/${id}/fotos/${key}`).expect(404);
  }
});
test("reserva no revela privados; cambios privados no avisan y públicos sí", async () => {
  const id = await publish(f, {}, await image());
  await reserve(id);
  const key = (await service.findById(id, f.author.id)).private.photo_key;
  await f.other.agent.get(`/publicaciones/${id}/fotos/${key}`).expect(404);
  await submit(
    f.author,
    `/publicaciones/${id}/editar`,
    validFound({ distinguishing_details: "Otro detalle muy privado" }),
  ).expect(303);
  const count = async () =>
    Number(
      (
        await f.pool.query(
          "SELECT count(*) FROM notifications n JOIN activity_events e ON e.id=n.event_id WHERE e.object_id=$1",
          [id],
        )
      ).rows[0].count,
    );
  expect(await count()).toBe(0);
  await submit(
    f.author,
    `/publicaciones/${id}/editar`,
    validFound({ general_area: "Cafetería" }),
  ).expect(303);
  expect(await count()).toBe(1);
  await withdraw(f.author, id).expect(409);
});
test("retirada exige motivo y confirmación y conserva historial sin reactivación", async () => {
  const id = await publish(f, { object_type: "RetirarObjetoI05" });
  await withdraw(f.author, id, { reason: "Motivo" }).expect(422);
  await withdraw(f.author, id, { reason: " ", confirm: "1" }).expect(422);
  await withdraw(f.author, id).expect(303);
  expect((await service.findById(id, f.author.id)).status).toBe("withdrawn");
  await request(f.app).get(`/publicaciones/${id}`).expect(404);
  await f.author.agent.get(`/publicaciones/${id}/historial`).expect(200);
  await submit(f.author, `/publicaciones/${id}/editar`).expect(409);
  await withdraw(f.author, id).expect(409);
  expect((await service.search({ q: "RetirarObjetoI05" })).posts).toHaveLength(
    0,
  );
});
test("rutas antiguas no permiten cambiar estado ni borrar físicamente", async () => {
  const id = await publish(f);
  for (const action of ["estado", "eliminar", "ubicacion"])
    await f.author.agent
      .post(`/publicaciones/${id}/${action}`)
      .type("form")
      .send({ _csrf: f.author.csrf, status: "returned" })
      .expect(404);
  expect((await service.findById(id, f.author.id)).status).toBe("available");
});
test("retirada con reclamación pendiente se bloquea hasta I07", async () => {
  const id = await publish(f);
  await f.pool.query(
    "INSERT INTO claims(object_id,author_id,claimant_id,description,distinguishing_details,lost_location,date_unknown) VALUES ($1,$2,$3,'Objeto','Detalle','Lugar',true)",
    [id, f.author.id, f.other.id],
  );
  await withdraw(f.author, id).expect(409);
});
test("búsqueda pública no utiliza privados ni interpreta comodines", async () => {
  const id = await publish(f, {
    object_type: "BusquedaUnicaI05",
    distinguishing_details: "SecretoSoloBusquedaI05",
    general_area: "Zona 100%",
  });
  expect(
    (await service.search({ q: "SecretoSoloBusquedaI05" })).posts,
  ).toHaveLength(0);
  expect((await service.search({ q: "BusquedaUnicaI05" })).posts[0].id).toBe(
    id,
  );
  expect(
    (await service.search({ q: "100%" })).posts.some((p) => p.id === id),
  ).toBe(true);
  expect(
    (await service.search({ q: "%" })).posts.every(
      (p) => p.general_area.includes("%") || p.object_type.includes("%"),
    ),
  ).toBe(true);
  const page = await request(f.app)
    .get("/publicaciones?q=BusquedaUnicaI05&category=accessories")
    .expect(200);
  expect(page.text).toContain(`/publicaciones/${id}`);
  await request(f.app)
    .get("/publicaciones?page=abc")
    .expect(200)
    .then((r) => expect(r.text).toContain("filtros no válidos"));
});
test("filtros conjuntos, solapamiento de fechas y páginas de 20", async () => {
  for (let i = 0; i < 21; i++)
    await service.create(f.author.id, {
      ...validFound({
        object_type: "PaginaI05 " + i,
        found_from: "2026-10-01",
        found_until: "2026-10-05",
      }),
      campus_latitude: null,
      campus_longitude: null,
    });
  const first = await service.search({
    q: "PaginaI05",
    from: "2026-10-04",
    until: "2026-10-10",
  });
  expect(first.posts).toHaveLength(20);
  expect(first.hasNext).toBe(true);
  const second = await service.search({ q: "PaginaI05", page: 2 });
  expect(second.posts).toHaveLength(1);
  expect(second.hasNext).toBe(false);
  expect(first.posts.map((p) => p.id)).not.toContain(second.posts[0].id);
  expect(
    (await service.search({ q: "PaginaI05", category: "keys" })).posts,
  ).toHaveLength(0);
  expect(
    (await service.search({ q: "PaginaI05", from: "2026-10-06" })).posts,
  ).toHaveLength(0);
});
test("una escritura inválida revierte hallazgo, privado e historial", async () => {
  const before = Number(
    (
      await f.pool.query(
        "SELECT count(*) FROM found_objects WHERE author_id=$1",
        [f.author.id],
      )
    ).rows[0].count,
  );
  await expect(
    service.create(f.author.id, {
      ...validFound(),
      campus_latitude: null,
      campus_longitude: null,
      photoKey: "invalid-uuid",
    }),
  ).rejects.toThrow();
  expect(
    Number(
      (
        await f.pool.query(
          "SELECT count(*) FROM found_objects WHERE author_id=$1",
          [f.author.id],
        )
      ).rows[0].count,
    ),
  ).toBe(before);
});

test("ediciones concurrentes conservan versiones completas y consecutivas", async () => {
  const id = await publish(f);
  const changes = [
    { object_type: "Bolsa A", distinguishing_details: "Detalle privado de A" },
    { object_type: "Bolsa B", distinguishing_details: "Detalle privado de B" },
  ];
  await Promise.all(
    changes.map((change) =>
      submit(
        f.author,
        `/publicaciones/${id}/editar`,
        validFound(change),
      ).expect(303),
    ),
  );
  const versions = await service.versions(id, f.author.id);
  expect(versions.map((v) => v.version)).toEqual([3, 2, 1]);
  for (const change of changes) {
    const version = versions.find(
      (v) => v.public_data.object_type === change.object_type,
    );
    expect(version.private_data.distinguishing_details).toBe(
      change.distinguishing_details,
    );
  }
});
test("devuelto se oculta al visitante, mantiene acceso del reclamante y bloquea edición", async () => {
  const id = await publish(
    f,
    { object_type: "DevueltoUnicoI05" },
    await image(),
  );
  const claim = await reserve(id);
  const c = await f.pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "UPDATE claims SET status='completed',author_confirmed_at=now(),claimant_confirmed_at=now() WHERE id=$1",
      [claim],
    );
    await c.query("UPDATE found_objects SET status='returned' WHERE id=$1", [
      id,
    ]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  await request(f.app).get(`/publicaciones/${id}`).expect(404);
  const detail = await f.other.agent.get(`/publicaciones/${id}`).expect(200);
  expect(detail.text).not.toContain("Sala secreta 42");
  expect(detail.text).not.toContain("/fotos/");
  await f.other.agent.get(`/publicaciones/${id}/historial`).expect(403);
  await submit(f.author, `/publicaciones/${id}/editar`).expect(409);
  await withdraw(f.author, id).expect(409);
  expect((await service.search({ q: "DevueltoUnicoI05" })).posts).toHaveLength(
    0,
  );
});
