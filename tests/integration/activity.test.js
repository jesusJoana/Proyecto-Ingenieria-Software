import { test, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  foundFixture,
  publish,
  validFound,
} from "../helpers/found-fixtures.js";
import { validClaim } from "../helpers/claim-fixtures.js";
import { claimSchema } from "../../src/claims/validation.js";
import { createClaimsService } from "../../src/claims/service.js";
import { createDeliveryService } from "../../src/delivery/service.js";
import { createActivityService } from "../../src/activity/service.js";
import { createPostsService } from "../../src/posts/service.js";
import { postSchema } from "../../src/posts/validation.js";
let f, g, claims, delivery, activity, posts;
beforeAll(async () => {
  f = await foundFixture();
  g = await foundFixture();
  claims = createClaimsService(f.pool);
  delivery = createDeliveryService(f.pool);
  activity = createActivityService(f.pool);
  posts = createPostsService(f.pool);
});
afterAll(async () => {
  await f?.cleanup();
  await g?.cleanup();
});
async function fixture() {
  const object = await publish(f);
  const a = await claims.create(
    object,
    f.other.id,
    claimSchema.parse(validClaim()),
  );
  const b = await claims.create(
    object,
    g.other.id,
    claimSchema.parse(validClaim()),
  );
  return { object, a: a.id, b: b.id };
}
test("avisos e historial propios no revelan otras reclamaciones ni motivos", async () => {
  const { a, b, object } = await fixture();
  await claims.send(a, f.other.id, "Mensaje secreto del reclamante");
  await delivery.act(a, f.author.id, "reject", {
    reason: "Motivo secreto solo A",
  });
  const history = await activity.history(g.other.id);
  expect(history.some((x) => x.claim_id === a)).toBe(false);
  expect(JSON.stringify(history)).not.toContain("Motivo secreto");
  expect(history.some((x) => x.claim_id === b)).toBe(true);
  const html = await g.other.agent.get("/actividad").expect(200);
  expect(html.text).not.toContain("Motivo secreto");
  expect(html.text).not.toContain(f.other.username);
  const author = await f.author.agent.get("/avisos").expect(200);
  expect(author.text).toContain("Nuevo mensaje privado");
  expect(author.text).not.toContain("Mensaje secreto");
  const own = await f.other.agent.get("/actividad").expect(200);
  expect(own.text).toContain("Motivo secreto solo A");
  for (const user of [f.author, f.other, g.other]) {
    const response = await user.agent.get("/avisos").expect(200);
    expect(response.text).not.toContain("Sala secreta 42");
    expect(response.headers["cache-control"]).toContain("no-store");
  }
  expect((await posts.findById(object, f.other.id)).private).toBeUndefined();
});
test("lectura de avisos requiere sesión, CSRF y destinatario y persiste", async () => {
  const { a } = await fixture();
  await delivery.act(a, f.author.id, "accept");
  const notice = (await activity.notifications(f.other.id)).find(
    (n) => n.claim_id === a && n.action === "accepted",
  );
  await request(f.app).get("/avisos").expect(401);
  await request(f.app).get("/actividad").expect(401);
  const path = `/avisos/${notice.notification_id}/leido`;
  await f.other.agent.post(path).expect(403);
  await g.other.agent
    .post(path)
    .type("form")
    .send({ _csrf: g.other.csrf })
    .expect(404);
  await f.other.agent
    .post(path)
    .type("form")
    .send({ _csrf: f.other.csrf })
    .expect(303);
  const first = (await activity.notifications(f.other.id)).find(
    (n) => n.notification_id === notice.notification_id,
  ).read_at;
  await activity.read(notice.notification_id, f.other.id);
  expect(
    (await createActivityService(f.pool).notifications(f.other.id)).find(
      (n) => n.notification_id === notice.notification_id,
    ).read_at,
  ).toEqual(first);
});
test("liberación avisa al reclamante elegido y al que vuelve a pendiente sin identificar al otro", async () => {
  const { a, b } = await fixture();
  await delivery.act(a, f.author.id, "accept");
  await delivery.act(a, f.author.id, "cancel", {
    reason: "Prueba insuficiente A",
  });
  expect(
    (await activity.notifications(f.other.id)).some(
      (n) => n.claim_id === a && n.action === "cancelled",
    ),
  ).toBe(true);
  const waiting = (await activity.notifications(g.other.id)).filter(
    (n) => n.claim_id === b,
  );
  expect(waiting.map((x) => x.action)).toEqual(["resumed", "waiting"]);
  expect(JSON.stringify(waiting)).not.toContain("Prueba insuficiente A");
});
test("paginación y parámetros no válidos; perfil refleja actividad real sin valoraciones", async () => {
  const { a } = await fixture();
  for (let i = 0; i < 22; i++) await claims.send(a, f.other.id, `Mensaje ${i}`);
  const first = await activity.notifications(f.author.id),
    second = await activity.notifications(f.author.id, 2);
  expect(first).toHaveLength(21);
  expect(second.length).toBeGreaterThan(0);
  expect(
    first
      .slice(0, 20)
      .some((x) => second.some((y) => x.notification_id === y.notification_id)),
  ).toBe(false);
  await f.author.agent.get("/avisos?page=0").expect(400);
  await f.author.agent.get("/actividad?page=x").expect(400);
  const profile = await f.author.agent.get("/perfil").expect(200);
  expect(profile.text).toContain("Hallazgos publicados");
  expect(profile.text).toContain("Devoluciones completadas");
  expect(profile.text).not.toContain("valoraciones");
  expect(profile.text).not.toContain("Intercambios completados");
  const publicProfile = await f.other.agent
    .get(`/u/${f.author.username}`)
    .expect(200);
  expect(publicProfile.text).not.toContain("Proponer un intercambio");
  expect(publicProfile.text).not.toContain("valoraciones");
});
test("edición privada no avisa ni expone versiones; edición pública notifica a los activos", async () => {
  const { a, object } = await fixture();
  await posts.update(
    object,
    f.author.id,
    postSchema.parse(
      validFound({ distinguishing_details: "Nuevo secreto privado reservado" }),
    ),
  );
  expect(
    (await activity.notifications(f.other.id)).filter(
      (n) => n.object_id === object && n.action === "edited",
    ),
  ).toHaveLength(0);
  expect(
    (await activity.history(f.other.id)).filter(
      (n) => n.object_id === object && n.action === "edited",
    ),
  ).toHaveLength(0);
  await posts.update(
    object,
    f.author.id,
    postSchema.parse(
      validFound({
        general_area: "Zona pública actualizada",
        distinguishing_details: "Nuevo secreto privado reservado",
      }),
    ),
  );
  expect(
    (await activity.notifications(f.other.id)).filter(
      (n) => n.object_id === object && n.action === "edited",
    ),
  ).toHaveLength(1);
  await expect(posts.versions(object, f.other.id)).rejects.toMatchObject({
    status: 403,
  });
  const versions = await posts.versions(object, f.author.id);
  expect(versions.length).toBe(3);
  await delivery.act(a, f.author.id, "accept");
  const view = await f.other.agent.get(`/reclamaciones/${a}`).expect(200);
  expect(view.text).not.toContain("Nuevo secreto");
});
