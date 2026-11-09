import { test, expect } from "vitest";
import ejs from "ejs";
import { fileURLToPath } from "node:url";
const render = (view, data) =>
  ejs.renderFile(
    fileURLToPath(new URL(`../../views/${view}.ejs`, import.meta.url)),
    data,
  );
test("navegación conserva identidad y ofrece historial y avisos", async () => {
  const html = await render("index", {
    posts: [],
    title: "ReFind",
    userId: "1",
    csrf: "token",
    accountUsername: "ana",
    accountAvatarFilename: "ana.webp",
  });
  expect(html).toContain("Cuenta de @ana");
  expect(html).toContain("/uploads/avatars/ana.webp");
  expect(html).toContain('href="/actividad"');
  expect(html).toContain('href="/avisos"');
});
test("perfil público no ofrece intercambios ni muestra valoraciones históricas", async () => {
  const html = await render("public-profile", {
    title: "ana",
    userId: "2",
    csrf: "token",
    profile: {
      id: "1",
      first_name: "Ana",
      last_name: "Prueba",
      username: "ana",
      avatar_filename: null,
      age: null,
      locality: null,
      organization: null,
      description: null,
      averageRating: 5,
      reviewCount: 1,
      reviews: [{ comment: "Histórico privado" }],
    },
  });
  expect(html).not.toContain("Histórico privado");
  expect(html).not.toContain("/intercambios");
  expect(html).not.toContain("valoraciones");
});
