import { z } from "zod";
import { today, isValidPostId } from "../posts/validation.js";
export { isValidPostId as isValidClaimId };
export const ACTIVE_STATUSES = ["pending", "waiting", "accepted"];
export const CLAIM_STATUSES = {
  pending: "Pendiente",
  waiting: "En espera",
  accepted: "Aceptada",
  completed: "Completada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  closed_withdrawn: "Cerrada por retirada",
  closed_delivered: "Cerrada por entrega a otra persona",
};
const text = (min, max) =>
  z
    .string()
    .trim()
    .min(min, `Indica al menos ${min} caracteres.`)
    .max(max, `Admite hasta ${max} caracteres.`);
function realDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < "0001-01-01") return false;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
export function createClaimSchema(now = () => new Date()) {
  return z
    .object({
      description: text(10, 2000),
      distinguishing_details: text(10, 2000),
      lost_location: text(2, 250),
      date_unknown: z.literal("1").optional(),
      lost_from: z.string().optional().default(""),
      lost_until: z.string().optional().default(""),
      additional_information: z
        .union([z.literal(""), text(10, 2000)])
        .optional()
        .default(""),
    })
    .superRefine((d, c) => {
      if (d.date_unknown) return;
      for (const [key, v] of [
        ["lost_from", d.lost_from],
        ["lost_until", d.lost_until || d.lost_from],
      ])
        if (!realDate(v) || v > today(now()))
          c.addIssue({
            code: "custom",
            path: [key],
            message: "Indica una fecha válida que no sea futura.",
          });
      if (d.lost_until && d.lost_until < d.lost_from)
        c.addIssue({
          code: "custom",
          path: ["lost_until"],
          message: "El final no puede ser anterior al inicio.",
        });
    })
    .transform((d) => ({
      ...d,
      date_unknown: d.date_unknown === "1",
      lost_from: d.date_unknown ? null : d.lost_from,
      lost_until: d.date_unknown ? null : d.lost_until || d.lost_from,
    }));
}
export const claimSchema = createClaimSchema();
export const messageSchema = z.object({ body: text(1, 2000) });
export function claimFormValues(body = {}) {
  return Object.fromEntries(
    [
      "description",
      "distinguishing_details",
      "lost_location",
      "date_unknown",
      "lost_from",
      "lost_until",
      "additional_information",
    ].map((k) => [
      k,
      typeof body[k] === "string" ? body[k].slice(0, 2100) : "",
    ]),
  );
}
export function participant(claim, user) {
  return [claim.author_id, claim.claimant_id].some(
    (id) => String(id) === String(user),
  );
}
export const canWrite = (claim) => ACTIVE_STATUSES.includes(claim.status);
