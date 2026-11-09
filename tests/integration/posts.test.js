import { beforeAll, afterAll, expect, test } from "vitest";
import request from "supertest";
import sharp from "sharp";
import {
  foundFixture,
  publish,
  submit,
  validFound,
} from "../helpers/found-fixtures.js";
let f;
beforeAll(async () => {
  f = await foundFixture();
});
afterAll(async () => {
  await f?.cleanup();
});
const image = async () => ({
  buffer: await sharp({
    create: { width: 40, height: 30, channels: 3, background: "#227766" },
  })
    .png()
    .toBuffer(),
  options: { filename: "photo.png", contentType: "image/png" },
});
test("publicar exige sesión y CSRF", async () => {
  await request(f.app).get("/publicaciones/nueva").expect(303);
  await request(f.app).post("/publicaciones").expect(303);
  await submit(f.author, "/publicaciones", validFound(), null, "").expect(403);
});
test("alta atómica con campos públicos/privados y autor de sesión", async () => {
  const id = await publish(f, {
    author_id: f.other.id,
    status: "returned",
    title: "TituloInventado",
  });
  const {
    rows: [row],
  } = await f.pool.query(
    "SELECT * FROM found_objects f JOIN found_object_private p ON p.object_id=f.id WHERE f.id=$1",
    [id],
  );
  expect(String(row.author_id)).toBe(String(f.author.id));
  expect(row.status).toBe("available");
  expect(row.distinguishing_details).toContain("Costura");
  expect(row.campus_latitude).toBe("40.41");
  expect(
    (
      await f.pool.query(
        "SELECT count(*)::int AS n FROM found_object_versions WHERE object_id=$1",
        [id],
      )
    ).rows[0].n,
  ).toBe(1);
  const page = await f.author.agent.get(`/publicaciones/${id}`).expect(200);
  expect(page.text).toContain("Tus datos privados");
  expect(page.text).not.toContain("TituloInventado");
});
test("visitante y otra cuenta no reciben datos privados en detalle, lista, mapa ni portada", async () => {
  const id = await publish(f, { object_type: "PrivacidadHallazgo" });
  const secrets = [
    "Costura interior roja",
    "Sala secreta 42",
    "Taquilla privada 17",
    "NombrePrivado",
    "ApellidoPrivado",
    f.author.email,
    "40.413456",
    "-3.712345",
  ];
  for (const agent of [request(f.app), f.other.agent])
    for (const url of [
      `/publicaciones/${id}`,
      "/publicaciones?q=PrivacidadHallazgo",
      "/objetos-por-zonas?q=PrivacidadHallazgo",
      "/",
    ]) {
      const page = await agent.get(url).expect(200);
      for (const secret of secrets) expect(page.text).not.toContain(secret);
    }
});
test("no permite publicar pérdidas y los enlaces antiguos llevan a consultar", async () => {
  await submit(f.author, "/publicaciones", validFound({ kind: "lost" })).expect(
    422,
  );
  await f.author.agent
    .get("/publicaciones/nueva?tipo=perdido")
    .expect(303)
    .expect("Location", "/publicaciones");
  const page = await request(f.app).get("/").expect(200);
  expect(page.text).not.toContain("/publicaciones/nueva?tipo=perdido");
  expect(page.text).toContain("Buscar mi objeto");
});
test.each([
  { object_type: "" },
  { category: "bad" },
  { found_from: "2999-01-01" },
  { found_until: "1900-01-01" },
  { distinguishing_details: "corto" },
  { campus_latitude: "900" },
  { campus_longitude: "" },
])(
  "rechaza entradas sin guardar y conserva los valores: %o",
  async (change) => {
    const values = validFound({ object_type: "SinGuardarI05", ...change });
    const before = (
      await f.pool.query(
        "SELECT count(*)::int AS n FROM found_objects WHERE author_id=$1",
        [f.author.id],
      )
    ).rows[0].n;
    const page = await submit(f.author, "/publicaciones", values).expect(422);
    expect(page.text).toContain("Campus central");
    expect(
      (
        await f.pool.query(
          "SELECT count(*)::int AS n FROM found_objects WHERE author_id=$1",
          [f.author.id],
        )
      ).rows[0].n,
    ).toBe(before);
  },
);
test("foto opcional y archivo accesible exclusivamente por el autor", async () => {
  const id = await publish(f, {}, await image());
  const key = (
    await f.pool.query(
      "SELECT photo_key FROM found_object_private WHERE object_id=$1",
      [id],
    )
  ).rows[0].photo_key;
  const url = `/publicaciones/${id}/fotos/${key}`;
  await f.author.agent
    .get(url)
    .expect(200)
    .expect("Content-Type", /image\/webp/)
    .expect("Cache-Control", "private, no-store");
  await f.other.agent.get(url).expect(404);
  await request(f.app).get(url).expect(303);
  await request(f.app).get(`/uploads/posts/${key}.webp`).expect(404);
  const page = await request(f.app).get(`/publicaciones/${id}`);
  expect(page.text).not.toContain(key);
  await publish(f, {
    deposit_location: "",
    exact_location: "",
    campus_latitude: "",
    campus_longitude: "",
  });
});
test.each([
  {
    buffer: Buffer.from("fake"),
    options: { filename: "fake.png", contentType: "image/png" },
  },
  {
    buffer: Buffer.from("html"),
    options: { filename: "fake.html", contentType: "text/html" },
  },
  {
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    options: { filename: "large.png", contentType: "image/png" },
  },
])("rechaza fotos falsas, formato y tamaño inválidos", async (photo) => {
  await submit(f.author, "/publicaciones", validFound(), photo).expect(422);
});
test("HTML se escapa y Mis publicaciones no incluye objetos de otra cuenta", async () => {
  const id = await publish(f, { object_type: "<script>alert(42)</script>" });
  const page = await request(f.app).get(`/publicaciones/${id}`);
  expect(page.text).toContain("&lt;script&gt;");
  expect(page.text).not.toContain("<script>alert(42)</script>");
  const mine = await f.other.agent.get("/mis-publicaciones");
  expect(mine.text).not.toContain(`/publicaciones/${id}`);
});
test.each(["0", "abc", "9223372036854775807"])(
  "detalle inexistente %s devuelve 404",
  async (id) => {
    await request(f.app).get(`/publicaciones/${id}`).expect(404);
  },
);

test("hallazgo sin coordenadas sigue en lista y zonas explica la ausencia conservando filtros", async () => {
  const type = "SinMapaRevisionI05";
  const id = await publish(f, {
    object_type: type,
    campus_latitude: "",
    campus_longitude: "",
  });
  const zones = await request(f.app)
    .get(`/objetos-por-zonas?q=${type}&campus=Campus%20central`)
    .expect(200);
  expect(zones.text).toContain(
    "No hay hallazgos con referencia de campus en el mapa",
  );
  expect(zones.text).not.toContain("hidden data-map-point");
  const link = zones.text
    .match(/href="([^"]+)">Ver también hallazgos sin mapa/)[1]
    .replaceAll("&amp;", "&");
  const url = new URL(link, "http://localhost");
  expect(url.searchParams.get("q")).toBe(type);
  expect(url.searchParams.get("campus")).toBe("Campus central");
  const list = await request(f.app).get(link).expect(200);
  expect(list.text).toContain(`/publicaciones/${id}`);
});
