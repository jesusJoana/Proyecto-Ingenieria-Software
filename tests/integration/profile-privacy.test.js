import { test, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import { foundFixture } from "../helpers/found-fixtures.js";
let f, filename;
beforeAll(async () => {
  f = await foundFixture();
});
afterAll(async () => {
  if (filename)
    await unlink(
      new URL(`../../public/uploads/avatars/${filename}`, import.meta.url),
    ).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  await f?.cleanup();
});
test("datos personales no aparecen en perfil público ni búsqueda y el correo no localiza personas", async () => {
  await f.pool.query(
    "UPDATE users SET description='Biografía privada distintiva',locality='Localidad privada',age=27,organization='Organización reservada' WHERE id=$1",
    [f.author.id],
  );
  for (const agent of [request(f.app), f.other.agent]) {
    const r = await agent.get(`/u/${f.author.username}`).expect(200);
    expect(r.text).toContain("@" + f.author.username);
    for (const value of [
      "NombrePrivado",
      "ApellidoPrivado",
      "Biografía privada distintiva",
      "Localidad privada",
      "Organización reservada",
      f.author.email,
    ])
      expect(r.text).not.toContain(value);
  }
  const search = await f.other.agent
    .get("/amigos")
    .query({ q: f.author.username })
    .expect(200);
  expect(search.text).toContain("@" + f.author.username);
  expect(search.text).not.toContain("NombrePrivado");
  expect(search.text).not.toContain("ApellidoPrivado");
  const email = await f.other.agent
    .get("/amigos")
    .query({ q: f.author.email })
    .expect(200);
  expect(email.text).not.toContain("@" + f.author.username);
  const own = await f.author.agent.get("/perfil").expect(200);
  expect(own.text).toContain("Biografía privada distintiva");
});
test("foto propia accesible; terceros y anónimos bloqueados incluso con rutas codificadas", async () => {
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
  await f.author.agent
    .post("/perfil")
    .field("_csrf", f.author.csrf)
    .field("username", f.author.username)
    .field("first_name", "NombrePrivado")
    .field("last_name", "ApellidoPrivado")
    .field("email", f.author.email)
    .attach("avatar", image, { filename: "foto.png", contentType: "image/png" })
    .expect(303);
  filename = (
    await f.pool.query("SELECT avatar_filename FROM users WHERE id=$1", [
      f.author.id,
    ])
  ).rows[0].avatar_filename;
  const own = await f.author.agent
    .get(`/uploads/avatars/${filename}`)
    .expect(200);
  expect(own.headers["cache-control"]).toContain("no-store");
  for (const path of [
    `/uploads/avatars/${filename}`,
    `/uploads/%61vatars/${filename}`,
    `/uploads/avatars./${filename}`,
    `/UPLOADS/AVATARS/${filename}`,
    `/uploads%5Cavatars%5C${filename}`,
  ]) {
    await request(f.app).get(path).expect(404);
    await f.other.agent.get(path).expect(404);
  }
});
