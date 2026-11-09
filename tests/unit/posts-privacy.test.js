import { expect, test } from "vitest";
import { publicPost, PUBLIC_POST_FIELDS } from "../../src/posts/privacy.js";
import { photoPath } from "../../src/posts/photos.js";
test("proyección pública elimina cualquier campo ajeno a la lista autorizada", () => {
  const row = {
    id: "1",
    title: "Mochila encontrada",
    distinguishing_details: "Secreto",
    photo_key: "secret",
    exact_location: "Exacto",
    deposit_location: "Casa",
    email: "secret@example.test",
    author_first_name: "Nombre",
    brand: "Marca",
    private: { secret: true },
  };
  const result = publicPost(row);
  expect(Object.keys(result)).toEqual(PUBLIC_POST_FIELDS);
  expect(JSON.stringify(result)).not.toMatch(
    /Secreto|secret|Exacto|Casa|Nombre|Marca/,
  );
});
test("ruta de imagen rechaza traversal y entornos ajenos", () => {
  expect(() => photoPath("../secret", "test")).toThrow();
  expect(() =>
    photoPath("12345678-1234-1234-1234-123456789012", "production"),
  ).toThrow();
  expect(photoPath("12345678-1234-1234-1234-123456789012", "test")).toMatch(
    /storage[\\/]environments[\\/]test[\\/]posts/,
  );
});
