/** Flujo de amistades y chat con PostgreSQL real. */
import { afterAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { readConfig } from "../../src/config.js";

const { app, pool, close } = createApp(readConfig("test"));
const password = "Una frase segura 42";
const suffix = randomUUID().slice(0, 8);
const names = ["ana", "bea", "cora", "dani"];
const people = names.map((name) => ({
  username: `friends-${name}-${suffix}`,
  email: `friends-${name}-${suffix}@example.test`,
  first_name: name,
  last_name: "ReFind",
  id: null,
  agent: null,
}));
const tokens = [];
const csrfByPerson = new Map();

async function tokenFor(person) {
  const page = await person.agent.get("/perfil/editar").expect(200);
  const token = page.text.match(/name="_csrf" value="([a-f0-9]+)"/)?.[1];
  expect(token).toBeTruthy();
  tokens.push(token);
  csrfByPerson.set(person.id, token);
  return token;
}

async function login(person) {
  person.agent = request.agent(app);
  const page = await person.agent.get("/iniciar-sesion").expect(200);
  const csrf = page.text.match(/name="_csrf" value="([a-f0-9]+)"/)?.[1];
  tokens.push(csrf);
  await person.agent
    .post("/iniciar-sesion")
    .type("form")
    .send({ email: person.email, password, _csrf: csrf })
    .expect(303);
}

function postForm(person, path, values = {}) {
  return person.agent
    .post(path)
    .type("form")
    .send({ ...values, _csrf: csrfByPerson.get(person.id) });
}

afterAll(async () => {
  const ids = people.map((person) => person.id).filter(Boolean);
  if (ids.length) {
    await pool.query(
      `DELETE FROM session
       WHERE sess->>'userId' = ANY($1::text[])
          OR sess->>'csrfToken' = ANY($2::text[])`,
      [ids.map(String), tokens],
    );
    await pool.query("DELETE FROM users WHERE id = ANY($1::bigint[])", [ids]);
  }
  await close();
});

describe("Amigos y chat", () => {
  test("protege solicitudes y chat, y completa el flujo con solicitudes concurrentes", async () => {
    await request(app).get("/amigos").expect(401);
    await request(app)
      .get("/api/amigos/1/mensajes")
      .expect(401)
      .expect({ error: "Inicia sesión para usar Amigos y Chat." });

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    for (const person of people) {
      const {
        rows: [user],
      } = await pool.query(
        `INSERT INTO users (username, first_name, last_name, email, password_hash)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          person.username,
          person.first_name,
          person.last_name,
          person.email,
          passwordHash,
        ],
      );
      person.id = String(user.id);
      await login(person);
      await tokenFor(person);
    }

    const [ana, bea, cora, dani] = people;
    const search = await ana.agent
      .get("/amigos")
      .query({ q: bea.email })
      .expect(200);
    const resultRow = search.text.match(
      /<article class="friend-row">[\s\S]*?<\/article>/,
    )?.[0];
    expect(resultRow).toContain(`@${bea.username}`);
    expect(resultRow).not.toContain(bea.email);
    expect(resultRow).not.toContain("password_hash");

    await postForm(ana, `/amigos/solicitudes/${ana.id}`)
      .expect(303)
      .expect("Location", "/amigos?resultado=propia");
    await postForm(ana, `/amigos/solicitudes/${bea.id}`)
      .expect(303)
      .expect("Location", "/amigos?resultado=sent");

    const {
      rows: [requestRow],
    } = await pool.query(
      `SELECT id, requester_id, recipient_id, status FROM friendships
       WHERE user_low_id = LEAST($1::bigint, $2::bigint)
         AND user_high_id = GREATEST($1::bigint, $2::bigint)`,
      [ana.id, bea.id],
    );
    expect(requestRow.status).toBe("pending");
    await postForm(ana, `/amigos/solicitudes/${requestRow.id}/aceptar`)
      .expect(303)
      .expect("Location", "/amigos?resultado=no-disponible");

    await postForm(bea, `/amigos/solicitudes/${ana.id}`)
      .expect(303)
      .expect("Location", "/amigos?resultado=incoming-pending");
    const { rows: duplicates } = await pool.query(
      `SELECT id FROM friendships
       WHERE user_low_id = LEAST($1::bigint, $2::bigint)
         AND user_high_id = GREATEST($1::bigint, $2::bigint)`,
      [ana.id, bea.id],
    );
    expect(duplicates).toHaveLength(1);

    await postForm(bea, `/amigos/solicitudes/${requestRow.id}/aceptar`)
      .expect(303)
      .expect("Location", "/amigos?resultado=aceptada");
    expect((await ana.agent.get("/amigos").expect(200)).text).toContain(
      `@${bea.username}`,
    );
    await cora.agent.get(`/amigos/${ana.id}/chat`).expect(404);
    await ana.agent.get(`/amigos/${bea.id}/chat`).expect(200);

    const messageCsrf = await tokenFor(ana);
    await ana.agent
      .post(`/api/amigos/${bea.id}/mensajes`)
      .type("form")
      .send({ content: "   ", _csrf: messageCsrf })
      .expect(422)
      .expect(({ body }) => expect(body.error).toContain("Escribe un mensaje"));
    await ana.agent
      .post(`/api/amigos/${bea.id}/mensajes`)
      .type("form")
      .send({ content: "x".repeat(2001), _csrf: messageCsrf })
      .expect(422);

    const unsafeLookingText = '<script>alert("hola")</script>';
    const sent = await ana.agent
      .post(`/api/amigos/${bea.id}/mensajes`)
      .type("form")
      .send({ content: unsafeLookingText, _csrf: messageCsrf })
      .expect(201);
    expect(sent.body.message.content).toBe(unsafeLookingText);
    const received = await bea.agent
      .get(`/api/amigos/${ana.id}/mensajes`)
      .expect(200);
    expect(received.body.messages[0].content).toBe(unsafeLookingText);
    await bea.agent
      .post(`/api/amigos/${ana.id}/mensajes`)
      .type("form")
      .send({
        content: "Segundo mensaje",
        _csrf: csrfByPerson.get(bea.id),
      })
      .expect(201);
    const ordered = await ana.agent
      .get(`/api/amigos/${bea.id}/mensajes`)
      .expect(200);
    expect(ordered.body.messages.map((message) => message.content)).toEqual([
      unsafeLookingText,
      "Segundo mensaje",
    ]);
    const chat = await ana.agent.get(`/amigos/${bea.id}/chat`).expect(200);
    expect(chat.text).toContain(
      "&lt;script&gt;alert(&#34;hola&#34;)&lt;/script&gt;",
    );

    const simultaneous = await Promise.all([
      postForm(cora, `/amigos/solicitudes/${dani.id}`),
      postForm(dani, `/amigos/solicitudes/${cora.id}`),
    ]);
    expect(simultaneous.map((response) => response.status)).toEqual([303, 303]);
    const {
      rows: [concurrentRequest],
    } = await pool.query(
      `SELECT id, requester_id, recipient_id, status FROM friendships
       WHERE user_low_id = LEAST($1::bigint, $2::bigint)
         AND user_high_id = GREATEST($1::bigint, $2::bigint)`,
      [cora.id, dani.id],
    );
    expect(concurrentRequest.status).toBe("pending");
    const sender = people.find(
      (person) => person.id === String(concurrentRequest.requester_id),
    );
    const recipient = people.find(
      (person) => person.id === String(concurrentRequest.recipient_id),
    );
    await postForm(
      recipient,
      `/amigos/solicitudes/${concurrentRequest.id}/cancelar`,
    )
      .expect(303)
      .expect("Location", "/amigos?resultado=no-disponible");
    await postForm(
      sender,
      `/amigos/solicitudes/${concurrentRequest.id}/cancelar`,
    )
      .expect(303)
      .expect("Location", "/amigos?resultado=cancelada");

    await postForm(sender, `/amigos/solicitudes/${recipient.id}`)
      .expect(303)
      .expect("Location", "/amigos?resultado=sent");
    const {
      rows: [secondRequest],
    } = await pool.query(
      `SELECT id FROM friendships
       WHERE user_low_id = LEAST($1::bigint, $2::bigint)
         AND user_high_id = GREATEST($1::bigint, $2::bigint)`,
      [cora.id, dani.id],
    );
    await postForm(
      recipient,
      `/amigos/solicitudes/${secondRequest.id}/rechazar`,
    )
      .expect(303)
      .expect("Location", "/amigos?resultado=rechazada");
    await postForm(sender, `/amigos/solicitudes/${recipient.id}`)
      .expect(303)
      .expect("Location", "/amigos?resultado=sent");
    const {
      rows: [thirdRequest],
    } = await pool.query(
      `SELECT id, status FROM friendships
       WHERE user_low_id = LEAST($1::bigint, $2::bigint)
         AND user_high_id = GREATEST($1::bigint, $2::bigint)`,
      [cora.id, dani.id],
    );
    expect(thirdRequest.status).toBe("pending");
    await postForm(
      recipient,
      `/amigos/solicitudes/${thirdRequest.id}/aceptar`,
    ).expect(303);

    await postForm(bea, `/amigos/${ana.id}/eliminar`)
      .expect(303)
      .expect("Location", "/amigos?resultado=eliminada");
    await ana.agent.get(`/amigos/${bea.id}/chat`).expect(404);
    await ana.agent.get(`/api/amigos/${bea.id}/mensajes`).expect(404);
    const { rows: remainingMessages } = await pool.query(
      "SELECT id FROM friendship_messages WHERE sender_id = $1 OR sender_id = $2",
      [ana.id, bea.id],
    );
    expect(remainingMessages).toHaveLength(0);
  });
});
