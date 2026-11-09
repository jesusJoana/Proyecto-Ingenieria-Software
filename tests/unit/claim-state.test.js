import { test, expect } from "vitest";
import { validateAction } from "../../src/delivery/rules.js";
const base = {
  author_id: "1",
  claimant_id: "2",
  author_confirmed_at: null,
  claimant_confirmed_at: null,
};
const matrix = {
  pending: { accept: ["1"], reject: ["1"], cancel: ["2"] },
  waiting: { cancel: ["2"] },
  accepted: { accept: ["1"], cancel: ["1", "2"], confirm: ["1", "2"] },
  completed: { confirm: ["1", "2"] },
  rejected: { reject: ["1"] },
  cancelled: { cancel: ["2"] },
  closed_delivered: {},
  closed_withdrawn: {},
};
for (const [status, actions] of Object.entries(matrix))
  for (const action of [
    "accept",
    "reject",
    "cancel",
    "confirm",
    "incident",
    "agree",
  ])
    test(`${status}: permisos de ${action}`, () => {
      for (const actor of ["1", "2", "3"]) {
        const run = () =>
          validateAction({ ...base, status }, actor, action, "Motivo válido");
        if (actions[action]?.includes(actor)) expect(run).not.toThrow();
        else expect(run).toThrow();
      }
    });
test.each(["author_confirmed_at", "claimant_confirmed_at"])(
  "confirmación parcial %s impide cancelar y permite incidencia/acuerdo",
  (column) => {
    const c = { ...base, status: "accepted", [column]: new Date() };
    for (const actor of ["1", "2"]) {
      expect(() => validateAction(c, actor, "cancel", "motivo")).toThrow(
        /confirmación/,
      );
      for (const a of ["incident", "agree", "confirm"])
        expect(() => validateAction(c, actor, a, "motivo")).not.toThrow();
    }
  },
);
test.each(["", " ", "x".repeat(1001), ["motivo"]])(
  "rechaza motivo inválido %j",
  (reason) =>
    expect(() =>
      validateAction({ ...base, status: "pending" }, "1", "reject", reason),
    ).toThrow(),
);
test.each([1, 1000])("acepta motivo de %i caracteres", (length) =>
  expect(() =>
    validateAction(
      { ...base, status: "pending" },
      "1",
      "reject",
      "x".repeat(length),
    ),
  ).not.toThrow(),
);
