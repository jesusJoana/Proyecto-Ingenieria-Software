import { test, expect } from "vitest";
import {
  createClaimSchema,
  messageSchema,
  claimFormValues,
} from "../../src/claims/validation.js";
import { validClaim } from "../helpers/claim-fixtures.js";
const schema = createClaimSchema(() => new Date("2026-11-09T12:00:00Z"));
test("fecha desconocida normaliza fechas y descarta campos manipulados", () => {
  const v = schema.parse({
    ...validClaim(),
    author_id: "8",
    claimant_id: "9",
    status: "accepted",
    previous_claim_id: "1",
    lost_from: "2028-12-01",
  });
  expect(v.lost_from).toBeNull();
  expect(v.date_unknown).toBe(true);
  for (const k of ["author_id", "claimant_id", "status", "previous_claim_id"])
    expect(v).not.toHaveProperty(k);
});
for (const [field, min, max] of [
  ["description", 10, 2000],
  ["distinguishing_details", 10, 2000],
  ["lost_location", 2, 250],
  ["additional_information", 10, 2000],
])
  for (const [length, ok] of [
    [min - 1, false],
    [min, true],
    [max, true],
    [max + 1, false],
  ])
    test(`${field} longitud ${length}`, () =>
      expect(
        schema.safeParse(validClaim({ [field]: "x".repeat(length) })).success,
      ).toBe(ok));
for (const [from, until, ok] of [
  ["2026-11-09", "", true],
  ["2026-11-01", "2026-11-09", true],
  ["2026-11-10", "", false],
  ["2026-02-30", "", false],
  ["2026-11-08", "2026-11-01", false],
  ["", "", false],
])
  test(`fecha ${from}/${until}`, () =>
    expect(
      schema.safeParse(
        validClaim({
          date_unknown: undefined,
          lost_from: from,
          lost_until: until,
        }),
      ).success,
    ).toBe(ok));
for (const [body, ok] of [
  [" ", false],
  ["a", true],
  ["x".repeat(2000), true],
  ["x".repeat(2001), false],
])
  test(`mensaje ${body.length}`, () =>
    expect(messageSchema.safeParse({ body }).success).toBe(ok));
test("conserva solo entradas de texto del formulario", () => {
  expect(
    claimFormValues({ description: ["injection"], lost_location: "Sala" })
      .description,
  ).toBe("");
  expect(
    claimFormValues({ description: "x".repeat(3000) }).description,
  ).toHaveLength(2100);
});
