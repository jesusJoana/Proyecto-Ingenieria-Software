import { expect, test, vi } from "vitest";
import { postSchema } from "../../src/posts/validation.js";
import { createReverseGeocoder } from "../../src/posts/geocoding.js";
import { validFound } from "../helpers/found-fixtures.js";

test("conserva coordenadas precisas privadas y genera solo referencia pública redondeada", () => {
  const result = postSchema.parse(
    validFound({
      campus_latitude: "",
      campus_longitude: "",
      found_latitude: "40.4134567",
      found_longitude: "-3.7123456",
      found_accuracy: "27.5",
      custody_latitude: "0",
      custody_longitude: "0",
      custody_accuracy: "0",
    }),
  );
  expect(result).toMatchObject({
    found_latitude: 40.4134567,
    found_longitude: -3.7123456,
    found_accuracy: 27.5,
    campus_latitude: 40.41,
    campus_longitude: -3.71,
    custody_latitude: 0,
    custody_longitude: 0,
    custody_accuracy: 0,
  });
});

test.each([
  { found_latitude: "40" },
  { custody_longitude: "2" },
  { found_accuracy: "10" },
  { found_latitude: "91", found_longitude: "2" },
  { custody_latitude: "2", custody_longitude: "181" },
  { found_latitude: "40", found_longitude: "2", found_accuracy: "-1" },
  { found_latitude: "Infinity", found_longitude: "2" },
])("rechaza posiciones privadas inválidas: %o", (fields) => {
  expect(postSchema.safeParse(validFound(fields)).success).toBe(false);
});

test("la dirección es opcional y el proveedor se consulta solo cuando está configurado", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ display_name: "Biblioteca central" }),
    });
  expect(
    await createReverseGeocoder(undefined, { fetcher })(40, -3),
  ).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  const lookup = createReverseGeocoder(
    "https://geocoder.example.test/reverse",
    { fetcher, now: () => 10000 },
  );
  expect(await lookup(40, -3)).toBe("Biblioteca central");
  expect(fetcher.mock.calls[0][0].searchParams.get("lat")).toBe("40");
  expect(await lookup(40, -3)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test.each([
  async () => {
    throw new Error("offline");
  },
  async () => ({ ok: false }),
  async () => ({ ok: true, json: async () => ({}) }),
])("un fallo de dirección no bloquea el hallazgo", async (fetcher) => {
  expect(
    await createReverseGeocoder("https://geocoder.example.test/reverse", {
      fetcher,
    })(40, -3),
  ).toBeNull();
});
