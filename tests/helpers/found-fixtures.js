import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { readConfig } from "../../src/config.js";
import { today } from "../../src/posts/validation.js";
import { removePhoto } from "../../src/posts/photos.js";
export const validFound = (change = {}) => ({
  category: "accessories",
  object_type: "Mochila",
  university: "Universidad de prueba",
  campus: "Campus central",
  general_area: "Biblioteca",
  found_from: today(),
  found_until: "",
  distinguishing_details: "Costura interior roja y tres bolsillos ocultos",
  exact_location: "Sala secreta 42",
  deposit_location: "Taquilla privada 17",
  campus_latitude: "40.413456",
  campus_longitude: "-3.712345",
  ...change,
});
export async function cleanupFound(pool, ids, mode = "test") {
  if (!ids.length) return;
  const keys = (
    await pool.query(
      `SELECT DISTINCT private_data->>'photo_key' AS key FROM found_object_versions WHERE object_id IN (SELECT id FROM found_objects WHERE author_id=ANY($1::bigint[]))`,
      [ids],
    )
  ).rows
    .map((r) => r.key)
    .filter(Boolean);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const objectIds = (
      await c.query(
        "SELECT id FROM found_objects WHERE author_id=ANY($1::bigint[])",
        [ids],
      )
    ).rows.map((r) => r.id);
    await c.query(
      "DELETE FROM notifications WHERE event_id IN (SELECT id FROM activity_events WHERE object_id=ANY($1::bigint[])) OR recipient_id=ANY($2::bigint[])",
      [objectIds, ids],
    );
    await c.query(
      "DELETE FROM activity_events WHERE object_id=ANY($1::bigint[])",
      [objectIds],
    );
    await c.query(
      "DELETE FROM claim_message_files WHERE message_id IN (SELECT id FROM claim_messages WHERE claim_id IN (SELECT id FROM claims WHERE object_id=ANY($1::bigint[])))",
      [objectIds],
    );
    for (const table of ["claim_messages", "claim_evidence", "claim_incidents"])
      await c.query(
        `DELETE FROM ${table} WHERE claim_id IN (SELECT id FROM claims WHERE object_id=ANY($1::bigint[]))`,
        [objectIds],
      );
    await c.query("DELETE FROM claims WHERE object_id=ANY($1::bigint[])", [
      objectIds,
    ]);
    for (const table of ["found_object_versions", "found_object_private"])
      await c.query(`DELETE FROM ${table} WHERE object_id=ANY($1::bigint[])`, [
        objectIds,
      ]);
    await c.query("DELETE FROM found_objects WHERE id=ANY($1::bigint[])", [
      objectIds,
    ]);
    await c.query("DELETE FROM session WHERE sess->>'userId'=ANY($1::text[])", [
      ids.map(String),
    ]);
    await c.query("DELETE FROM users WHERE id=ANY($1::bigint[])", [ids]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  await Promise.all(keys.map((key) => removePhoto(key, mode)));
}
export async function foundFixture() {
  const context = createApp(readConfig("test"));
  const people = [];
  const tokens = [];
  const password = "Una frase segura 42",
    hash = await argon2.hash(password);
  for (const name of ["author", "other"]) {
    const suffix = randomUUID().slice(0, 8),
      username = `i05-${name}-${suffix}`,
      email = `${username}@example.test`;
    const {
      rows: [row],
    } = await context.pool.query(
      `INSERT INTO users(first_name,last_name,email,password_hash,username) VALUES ('NombrePrivado','ApellidoPrivado',$1,$2,$3) RETURNING id`,
      [email, hash, username],
    );
    const agent = request.agent(context.app);
    let page = await agent.get("/iniciar-sesion");
    let csrf = page.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
    tokens.push(csrf);
    await agent
      .post("/iniciar-sesion")
      .type("form")
      .send({ email, password, _csrf: csrf })
      .expect(303);
    page = await agent.get("/publicaciones/nueva").expect(200);
    csrf = page.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
    tokens.push(csrf);
    people.push({ id: row.id, agent, csrf, username, email });
  }
  return {
    ...context,
    author: people[0],
    other: people[1],
    async cleanup() {
      await cleanupFound(
        context.pool,
        people.map((p) => p.id),
      );
      await context.pool.query(
        "DELETE FROM session WHERE sess->>'csrfToken'=ANY($1::text[])",
        [tokens],
      );
      await context.close();
    },
  };
}
export function submit(
  person,
  url,
  values = validFound(),
  photo,
  csrf = person.csrf,
) {
  let req = person.agent.post(url);
  if (csrf) req = req.field("_csrf", csrf);
  for (const [key, value] of Object.entries(values))
    req = req.field(key, String(value));
  if (photo) req = req.attach("photo", photo.buffer, photo.options);
  return req;
}
export async function publish(fixture, change = {}, photo) {
  const response = await submit(
    fixture.author,
    "/publicaciones",
    validFound(change),
    photo,
  ).expect(303);
  return response.headers.location.split("/").pop();
}
