import { describe, expect, test } from "vitest";
import {
  createPostSchema,
  createEditPostSchema,
  parseSearch,
  postFormValues,
  isValidPostId,
  today,
  withdrawalSchema,
} from "../../src/posts/validation.js";
import { validFound } from "../helpers/found-fixtures.js";
const schema = createPostSchema(() => new Date(2026, 10, 9)),
  valid = validFound({ found_from: "2026-11-01" });
test("admite hallazgo, título/autor/estado no proceden del formulario", () => {
  const result = schema.parse({
    ...valid,
    title: "Falso",
    author_id: "88",
    status: "returned",
  });
  expect(result).not.toHaveProperty("title");
  expect(result).not.toHaveProperty("author_id");
  expect(result).not.toHaveProperty("status");
  expect(result).toMatchObject({
    found_until: "2026-11-01",
    campus_latitude: 40.41,
    campus_longitude: -3.71,
  });
});
test.each([
  { kind: "lost" },
  { category: "unknown" },
  { object_type: "a" },
  { object_type: "x".repeat(61) },
  { university: "" },
  { campus: "" },
  { general_area: "" },
  { distinguishing_details: "corto" },
  { distinguishing_details: "x".repeat(2001) },
  { exact_location: "x".repeat(251) },
  { deposit_location: "x".repeat(251) },
  { found_from: "2026-02-30" },
  { found_from: "2026-11-10" },
  { found_until: "2026-10-31" },
  { found_from: "0000-01-01" },
  { campus_latitude: "86" },
  { campus_longitude: "181" },
  { campus_latitude: "" },
  { campus_longitude: "NaN" },
])("rechaza entradas inválidas: %o", (change) =>
  expect(schema.safeParse({ ...valid, ...change }).success).toBe(false),
);
test("no exige fotografía, depósito, lugar exacto ni mapa", () => {
  expect(
    schema.parse({
      ...valid,
      exact_location: "",
      deposit_location: "",
      campus_latitude: "",
      campus_longitude: "",
    }),
  ).toMatchObject({ campus_latitude: null, campus_longitude: null });
});
test("admite fronteras y ceros", () =>
  expect(
    schema.parse({
      ...valid,
      object_type: "ab",
      distinguishing_details: "x".repeat(2000),
      exact_location: "x".repeat(250),
      campus_latitude: "0",
      campus_longitude: "0",
    }),
  ).toMatchObject({ campus_latitude: 0, campus_longitude: 0 }));
test("edición conserva foto por defecto y admite quitarla", () => {
  const edit = createEditPostSchema(() => new Date(2026, 10, 9));
  expect(edit.parse(valid).removePhoto).toBe(false);
  expect(edit.parse({ ...valid, remove_photo: "1" }).removePhoto).toBe(true);
});
test("retirada exige motivo y confirmación", () => {
  expect(
    withdrawalSchema.safeParse({ reason: "Motivo", confirm: "1" }).success,
  ).toBe(true);
  expect(withdrawalSchema.safeParse({ reason: "Motivo" }).success).toBe(false);
  expect(
    withdrawalSchema.safeParse({ reason: " ", confirm: "1" }).success,
  ).toBe(false);
});
test("filtra únicamente campos públicos con paginación", () => {
  expect(
    parseSearch({
      q: " mochila ",
      category: "keys",
      page: "2",
      brand: "Privada",
    }),
  ).toMatchObject({
    invalid: false,
    filters: { q: "mochila", category: "keys", page: 2 },
  });
  expect(parseSearch().filters.page).toBe(1);
});
test.each([
  { page: "0" },
  { page: "-1" },
  { page: ["2"] },
  { page: "9999999" },
  { from: "2026-02-30" },
  { from: "2026-11-09", until: "2026-11-01" },
  { q: "x".repeat(101) },
  { category: "unknown" },
])("descarta filtros inválidos: %o", (query) =>
  expect(parseSearch(query).invalid).toBe(true),
);
test("conserva solo campos conocidos y textuales", () => {
  const result = postFormValues({
    object_type: "Mochila",
    author_id: "99",
    deposit_location: { secret: "x" },
  });
  expect(result.object_type).toBe("Mochila");
  expect(result.deposit_location).toBe("");
  expect(result).not.toHaveProperty("author_id");
});
test.each(["0", "-1", "abc", "1.2", "9223372036854775808", "1 OR 1=1"])(
  "rechaza id %s",
  (id) => expect(isValidPostId(id)).toBe(false),
);
test("ids válidos y formato de fecha", () => {
  expect(isValidPostId("9223372036854775807")).toBe(true);
  expect(today(new Date(2026, 0, 2))).toBe("2026-01-02");
});
