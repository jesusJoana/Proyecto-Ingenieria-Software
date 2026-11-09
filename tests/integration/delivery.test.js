import { test, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { foundFixture, publish } from "../helpers/found-fixtures.js";
import { validClaim } from "../helpers/claim-fixtures.js";
import { claimSchema } from "../../src/claims/validation.js";
import { createClaimsService } from "../../src/claims/service.js";
import { createDeliveryService } from "../../src/delivery/service.js";
import { createPostsService } from "../../src/posts/service.js";
let f, g, service, claims, posts;
beforeAll(async () => {
  f = await foundFixture();
  g = await foundFixture();
  service = createDeliveryService(f.pool);
  claims = createClaimsService(f.pool);
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
const state = async (id) =>
  (await f.pool.query("SELECT * FROM claims WHERE id=$1", [id])).rows[0];
const act = (person, id, action, data = {}) =>
  person.agent
    .post(`/reclamaciones/${id}/acciones/${action}`)
    .type("form")
    .send({ _csrf: person.csrf, ...data });
test("HTTP sesión, CSRF, actor, terceros, acciones y motivos", async () => {
  const { a } = await fixture();
  await request(f.app).post(`/reclamaciones/${a}/acciones/accept`).expect(303);
  await f.author.agent.post(`/reclamaciones/${a}/acciones/accept`).expect(403);
  await act(f.other, a, "accept").expect(403);
  await act(g.other, a, "accept").expect(404);
  await act(f.author, a, "reject", { reason: "" }).expect(422);
  await act(f.author, a, "unknown").expect(400);
  await act(f.author, a, "reject", { reason: ["a", "b"] }).expect(422);
  expect((await state(a)).status).toBe("pending");
});
test("rechazo con motivo afecta solo a su reclamación y admite repetición con antecedente", async () => {
  const { a, b, object } = await fixture();
  await act(f.author, a, "reject", { reason: "No coincide la costura" }).expect(
    303,
  );
  expect((await state(a)).decision_reason).toBe("No coincide la costura");
  expect((await state(b)).status).toBe("pending");
  const repeated = await claims.create(
    object,
    f.other.id,
    claimSchema.parse(
      validClaim({
        additional_information: "Aporto el detalle del bolsillo interior",
      }),
    ),
  );
  expect(String((await state(repeated.id)).previous_claim_id)).toBe(String(a));
});
test("aceptaciones concurrentes producen una reserva y las demás en espera", async () => {
  const { a, b, object } = await fixture();
  const results = await Promise.allSettled([
    service.act(a, f.author.id, "accept"),
    service.act(b, f.author.id, "accept"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect([(await state(a)).status, (await state(b)).status].sort()).toEqual([
    "accepted",
    "waiting",
  ]);
  expect((await posts.findById(object, f.author.id)).status).toBe("reserved");
  await expect(
    claims.create(object, g.author.id, claimSchema.parse(validClaim())),
  ).rejects.toMatchObject({ status: 409 });
});
test("cancelación por autor libera reserva, reactiva espera y conserva conversaciones", async () => {
  const { a, b, object } = await fixture();
  await service.act(a, f.author.id, "accept");
  await claims.send(a, f.other.id, "Mensaje conservado");
  await service.act(a, f.author.id, "cancel", {
    reason: "No se acredita propiedad",
  });
  expect((await state(a)).status).toBe("cancelled");
  expect((await state(b)).status).toBe("pending");
  expect((await posts.findById(object)).status).toBe("available");
  expect((await claims.messages(a, f.other.id)).messages[0].body).toBe(
    "Mensaje conservado",
  );
  await expect(
    claims.send(a, f.other.id, "No permitido"),
  ).rejects.toMatchObject({ status: 409 });
});
test.each(["pending", "waiting"])(
  "reclamante cancela solicitud %s sin afectar otra",
  async (status) => {
    const { a, b } = await fixture();
    if (status === "waiting") await service.act(a, f.author.id, "accept");
    await service.act(b, g.other.id, "cancel", {
      reason: "Ya lo he encontrado",
    });
    expect((await state(b)).status).toBe("cancelled");
    expect((await state(a)).status).toBe(
      status === "waiting" ? "accepted" : "pending",
    );
  },
);
test.each([true, false])(
  "doble confirmación en ambos órdenes (autor primero %s), cierre y reintentos",
  async (authorFirst) => {
    const { a, b, object } = await fixture();
    await service.act(a, f.author.id, "accept");
    const first = authorFirst ? f.author : f.other,
      second = authorFirst ? f.other : f.author;
    await service.act(a, first.id, "confirm");
    expect((await state(a)).status).toBe("accepted");
    await expect(
      service.act(a, first.id, "cancel", { reason: "Cancelar" }),
    ).rejects.toMatchObject({ status: 409 });
    await service.act(a, second.id, "confirm");
    await service.act(a, first.id, "confirm");
    await service.act(a, second.id, "confirm");
    expect((await state(a)).status).toBe("completed");
    expect((await state(b)).status).toBe("closed_delivered");
    expect(await posts.findById(object)).toBeNull();
    expect((await posts.findById(object, f.other.id)).status).toBe("returned");
    await expect(
      posts.withdraw(object, f.author.id, "Motivo"),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (
        await f.pool.query(
          "SELECT count(*)::int AS n FROM activity_events WHERE claim_id=$1 AND action='completed'",
          [a],
        )
      ).rows[0].n,
    ).toBe(1);
  },
);
test("confirmaciones simultáneas completan una sola entrega", async () => {
  const { a } = await fixture();
  await service.act(a, f.author.id, "accept");
  await Promise.all([
    service.act(a, f.author.id, "confirm"),
    service.act(a, f.other.id, "confirm"),
  ]);
  expect((await state(a)).status).toBe("completed");
});
test("incidencia exige dos acuerdos, anula confirmación y protege contra formularios antiguos", async () => {
  const { a, b } = await fixture();
  await service.act(a, f.author.id, "accept");
  await service.act(a, f.author.id, "confirm");
  await service.act(a, f.other.id, "incident", {
    reason: "Entrega aún no realizada",
  });
  await service.act(a, f.other.id, "incident", { reason: "Reintento" });
  let info = await service.details(a, f.other.id);
  expect(info.incidents).toHaveLength(1);
  const incidentId = info.incidents[0].id;
  await service.act(a, f.other.id, "agree", { incidentId });
  expect((await state(a)).author_confirmed_at).not.toBeNull();
  await service.act(a, f.author.id, "agree", { incidentId });
  expect((await state(a)).author_confirmed_at).toBeNull();
  await expect(
    service.act(a, f.other.id, "confirm", { cycle: "0" }),
  ).rejects.toMatchObject({ status: 409 });
  await service.act(a, f.author.id, "confirm", { cycle: incidentId });
  await service.act(a, f.other.id, "incident", {
    reason: "Nueva incidencia posterior",
  });
  await service.act(a, f.author.id, "agree", { incidentId });
  expect((await state(a)).author_confirmed_at).not.toBeNull();
  info = await service.details(a, f.author.id);
  const next = info.incidents[0].id;
  await service.act(a, f.author.id, "agree", { incidentId: next });
  await service.act(a, f.other.id, "agree", { incidentId: next });
  await service.act(a, f.other.id, "cancel", {
    reason: "Acuerdo final de cancelación",
  });
  expect((await state(b)).status).toBe("pending");
});
test("segunda confirmación puede completar devolución aun con incidencia y no admite cancelación posterior", async () => {
  const { a } = await fixture();
  await service.act(a, f.author.id, "accept");
  await service.act(a, f.author.id, "confirm");
  await service.act(a, f.other.id, "incident", {
    reason: "Duda aclarada después",
  });
  const results = await Promise.allSettled([
    service.act(a, f.other.id, "confirm"),
    service.act(a, f.author.id, "cancel", { reason: "Intento simultáneo" }),
  ]);
  expect(results[0].status).toBe("fulfilled");
  expect(results[1].status).toBe("rejected");
  expect((await state(a)).status).toBe("completed");
});
test("fallo de avisos revierte estados y eventos de la reserva", async () => {
  const { a, b, object } = await fixture();
  const db = await f.pool.connect();
  const original = db.query.bind(db);
  const query = vi
    .spyOn(db, "query")
    .mockImplementation((sql, args) =>
      String(sql).startsWith("INSERT INTO notifications")
        ? Promise.reject(new Error("fallo simulado"))
        : original(sql, args),
    );
  const proxy = {
    connect: async () => ({ query: db.query.bind(db), release: () => {} }),
  };
  try {
    await expect(
      createDeliveryService(proxy).act(a, f.author.id, "accept"),
    ).rejects.toThrow("fallo simulado");
  } finally {
    query.mockRestore();
    db.release();
  }
  expect((await state(a)).status).toBe("pending");
  expect((await state(b)).status).toBe("pending");
  expect((await posts.findById(object)).status).toBe("available");
  expect(
    (
      await f.pool.query(
        "SELECT 1 FROM activity_events WHERE claim_id=$1 AND action='accepted'",
        [a],
      )
    ).rowCount,
  ).toBe(0);
});
test("retirada cierra reclamaciones, conserva conversación y excluye terceros", async () => {
  const { a, b, object } = await fixture();
  await claims.send(a, f.other.id, "Texto conservado");
  await posts.withdraw(object, f.author.id, "Objeto entregado a conserjería");
  expect((await state(a)).status).toBe("closed_withdrawn");
  expect((await state(b)).status).toBe("closed_withdrawn");
  await f.other.agent.get(`/reclamaciones/${a}`).expect(200);
  await g.other.agent.get(`/reclamaciones/${a}`).expect(404);
  expect(await posts.findById(object)).toBeNull();
});
test("confirmación HTTP requiere aceptación expresa y no acepta identidad manipulada", async () => {
  const { a } = await fixture();
  await act(f.author, a, "accept").expect(303);
  await act(f.other, a, "confirm", { cycle: "0" }).expect(422);
  await act(f.other, a, "confirm", {
    cycle: "0",
    confirm: "1",
    author_id: f.other.id,
  }).expect(303);
  expect((await state(a)).author_confirmed_at).toBeNull();
  expect((await state(a)).claimant_confirmed_at).not.toBeNull();
});
test("primera confirmación y cancelación simultáneas dejan un único resultado coherente", async () => {
  const { a, b, object } = await fixture();
  await service.act(a, f.author.id, "accept");
  const results = await Promise.allSettled([
    service.act(a, f.other.id, "cancel", { reason: "Cancelación simultánea" }),
    service.act(a, f.author.id, "confirm"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const current = await state(a),
    post = await posts.findById(object, f.author.id);
  if (current.status === "cancelled") {
    expect(post.status).toBe("available");
    expect((await state(b)).status).toBe("pending");
    expect(current.author_confirmed_at).toBeNull();
  } else {
    expect(current.status).toBe("accepted");
    expect(post.status).toBe("reserved");
    expect(current.author_confirmed_at).not.toBeNull();
    expect((await state(b)).status).toBe("waiting");
  }
});
