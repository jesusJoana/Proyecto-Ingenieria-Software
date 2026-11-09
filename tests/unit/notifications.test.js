import { test, expect } from "vitest";
import { recipients, ACTION_LABELS } from "../../src/activity/service.js";
test("avisos de reclamación solo al otro participante sin duplicados", () => {
  const claim = { author_id: "1", claimant_id: "2" };
  expect(recipients(claim, 1)).toEqual(["2"]);
  expect(recipients(claim, 2)).toEqual(["1"]);
});
test("avisos de espera y entrega a otro no identifican al reclamante elegido", () => {
  expect(ACTION_LABELS.waiting).toBe("Reclamación en espera");
  expect(ACTION_LABELS.closed_delivered).toBe(
    "Cerrada por entrega a otra persona",
  );
});
