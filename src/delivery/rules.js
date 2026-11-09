import { ClaimError } from "../claims/service.js";
export const ACTIONS = [
  "accept",
  "reject",
  "cancel",
  "confirm",
  "incident",
  "agree",
];
export function validateAction(claim, user, action, reason = "") {
  const author = String(claim.author_id) === String(user),
    claimant = String(claim.claimant_id) === String(user);
  if (!author && !claimant)
    throw new ClaimError(404, "Reclamación no encontrada.");
  if (!ACTIONS.includes(action)) throw new ClaimError(400, "Acción no válida.");
  if (typeof reason !== "string")
    throw new ClaimError(422, "Motivo no válido.");
  if (
    ["reject", "cancel", "incident"].includes(action) &&
    (typeof reason !== "string" ||
      !reason.trim() ||
      reason.trim().length > 1000)
  )
    throw new ClaimError(422, "Indica un motivo de 1 a 1000 caracteres.");
  if (["accept", "reject"].includes(action) && !author)
    throw new ClaimError(
      403,
      "Solo el autor puede decidir sobre la reclamación.",
    );
  const partial = Boolean(
    claim.author_confirmed_at || claim.claimant_confirmed_at,
  );
  const allowed =
    action === "accept"
      ? ["pending", "accepted"].includes(claim.status)
      : action === "reject"
        ? ["pending", "rejected"].includes(claim.status)
        : action === "cancel"
          ? (claim.status === "accepted" && !partial) ||
            (claimant &&
              ["pending", "waiting", "cancelled"].includes(claim.status))
          : action === "confirm"
            ? ["accepted", "completed"].includes(claim.status)
            : claim.status === "accepted" && partial;
  if (!allowed)
    throw new ClaimError(
      409,
      partial && action === "cancel"
        ? "Hay una confirmación. Debéis acordar su anulación antes de cancelar."
        : "La acción no es compatible con el estado actual.",
    );
  return { author, claimant };
}
