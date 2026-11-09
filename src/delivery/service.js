import { ClaimError, assertParticipant } from "../claims/service.js";
import { validateAction } from "./rules.js";
import { recordActivity, recipients } from "../activity/service.js";
export function createDeliveryService(pool) {
  async function details(id, user) {
    const {
      rows: [claim],
    } = await pool.query(
      "SELECT * FROM claims WHERE id=$1 AND (author_id=$2 OR claimant_id=$2)",
      [id, user],
    );
    assertParticipant(claim, user);
    const { rows: incidents } = await pool.query(
      "SELECT id,reason,created_at,author_agreed_at,claimant_agreed_at,resolved_at FROM claim_incidents WHERE claim_id=$1 ORDER BY id DESC",
      [id],
    );
    return {
      claim,
      incidents,
      cycle: incidents.find((i) => i.resolved_at)?.id ?? "0",
    };
  }
  return {
    details,
    async act(
      id,
      user,
      action,
      { reason = "", incidentId = null, cycle = "0" } = {},
    ) {
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        // Read identity without locking first. All mutations lock object before claims.
        const {
          rows: [identity],
        } = await db.query(
          "SELECT object_id,author_id,claimant_id FROM claims WHERE id=$1",
          [id],
        );
        assertParticipant(identity, user);
        const {
          rows: [object],
        } = await db.query(
          "SELECT id,status FROM found_objects WHERE id=$1 FOR UPDATE",
          [identity.object_id],
        );
        const { rows: claims } = await db.query(
          "SELECT * FROM claims WHERE object_id=$1 ORDER BY id FOR UPDATE",
          [object.id],
        );
        const claim = claims.find((c) => String(c.id) === String(id));
        const { author } = validateAction(claim, user, action, reason);
        reason = reason.trim();
        const event = (c, a, d = {}) =>
          recordActivity(db, {
            objectId: object.id,
            claimId: c.id,
            actor: user,
            action: a,
            details: d,
            notify: recipients(c, user),
          });
        const change = async (c, status, a, why = null) => {
          await db.query(
            "UPDATE claims SET status=$2,decision_reason=$3,updated_at=now() WHERE id=$1",
            [c.id, status, why],
          );
          await event(c, a, why ? { reason: why } : {});
        };
        if (action === "accept" && claim.status === "pending") {
          if (object.status !== "available")
            throw new ClaimError(409, "El objeto ya no está disponible.");
          await change(claim, "accepted", "accepted");
          await db.query(
            "UPDATE found_objects SET status='reserved',updated_at=now() WHERE id=$1",
            [object.id],
          );
          for (const c of claims.filter(
            (c) => c.id !== claim.id && c.status === "pending",
          ))
            await change(c, "waiting", "waiting");
        } else if (action === "reject" && claim.status === "pending") {
          await change(claim, "rejected", "rejected", reason);
        } else if (action === "cancel" && claim.status !== "cancelled") {
          await change(claim, "cancelled", "cancelled", reason);
          if (claim.status === "accepted") {
            await db.query(
              "UPDATE found_objects SET status='available',updated_at=now() WHERE id=$1",
              [object.id],
            );
            for (const c of claims.filter((c) => c.status === "waiting"))
              await change(c, "pending", "resumed");
          }
        } else if (action === "confirm" && claim.status !== "completed") {
          const {
            rows: [last],
          } = await db.query(
            "SELECT id FROM claim_incidents WHERE claim_id=$1 AND resolved_at IS NOT NULL ORDER BY id DESC LIMIT 1",
            [id],
          );
          if (String(last?.id ?? "0") !== String(cycle))
            throw new ClaimError(
              409,
              "La confirmación anterior fue anulada. Recarga la página antes de confirmar de nuevo.",
            );
          const column = author
            ? "author_confirmed_at"
            : "claimant_confirmed_at";
          if (!claim[column]) {
            const complete = author
              ? claim.claimant_confirmed_at
              : claim.author_confirmed_at;
            await db.query(
              `UPDATE claims SET ${column}=now(),status=$2,updated_at=now() WHERE id=$1`,
              [id, complete ? "completed" : "accepted"],
            );
            await event(
              claim,
              author ? "author_confirmed" : "claimant_confirmed",
            );
            if (complete) {
              await db.query(
                "UPDATE found_objects SET status='returned',updated_at=now() WHERE id=$1",
                [object.id],
              );
              await event(claim, "completed");
              for (const c of claims.filter((c) =>
                ["pending", "waiting"].includes(c.status),
              ))
                await change(c, "closed_delivered", "closed_delivered");
            }
          }
        } else if (action === "incident") {
          const {
            rows: [existing],
          } = await db.query(
            "SELECT id FROM claim_incidents WHERE claim_id=$1 AND resolved_at IS NULL",
            [id],
          );
          if (!existing) {
            await db.query(
              "INSERT INTO claim_incidents(claim_id,opened_by,reason) VALUES($1,$2,$3)",
              [id, user, reason],
            );
            await db.query("UPDATE claims SET updated_at=now() WHERE id=$1", [
              id,
            ]);
            await event(claim, "incident", { reason });
          }
        } else if (action === "agree") {
          const {
            rows: [incident],
          } = await db.query(
            "SELECT * FROM claim_incidents WHERE id=$1 AND claim_id=$2 FOR UPDATE",
            [incidentId, id],
          );
          if (!incident) throw new ClaimError(404, "Incidencia no encontrada.");
          if (!incident.resolved_at) {
            const column = author ? "author_agreed_at" : "claimant_agreed_at";
            if (!incident[column]) {
              const complete = author
                ? incident.claimant_agreed_at
                : incident.author_agreed_at;
              await db.query(
                `UPDATE claim_incidents SET ${column}=now(),resolved_at=CASE WHEN $2 THEN now() ELSE NULL END WHERE id=$1`,
                [incident.id, Boolean(complete)],
              );
              await event(claim, "agreement");
              await db.query("UPDATE claims SET updated_at=now() WHERE id=$1", [
                id,
              ]);
              if (complete) {
                await db.query(
                  "UPDATE claims SET author_confirmed_at=NULL,claimant_confirmed_at=NULL,updated_at=now() WHERE id=$1",
                  [id],
                );
                await event(claim, "annulled");
              }
            }
          }
        }
        await db.query("COMMIT");
      } catch (e) {
        await db.query("ROLLBACK");
        throw e;
      } finally {
        db.release();
      }
    },
  };
}
