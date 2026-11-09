import { test, expect } from "vitest";
import { assertParticipant, assertWritable } from "../../src/claims/service.js";
for (const id of ["1", "2"])
  test(`participante ${id}`, () =>
    expect(() =>
      assertParticipant({ author_id: "1", claimant_id: "2" }, id),
    ).not.toThrow());
test("tercero y reclamación inexistente no revelan existencia", () => {
  for (const c of [null, { author_id: "1", claimant_id: "2" }])
    expect(() => assertParticipant(c, "3")).toThrow(
      "Reclamación no encontrada",
    );
});
for (const status of ["pending", "waiting", "accepted"])
  test(`escritura ${status}`, () =>
    expect(() => assertWritable({ status })).not.toThrow());
for (const status of [
  "rejected",
  "cancelled",
  "completed",
  "closed_withdrawn",
  "closed_delivered",
])
  test(`lectura ${status}`, () =>
    expect(() => assertWritable({ status })).toThrow("solo permite consulta"));
