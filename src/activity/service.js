export const ACTION_LABELS = {
  published: "Hallazgo publicado",
  edited: "Hallazgo actualizado",
  withdrawn: "Hallazgo retirado",
  claimed: "Reclamación enviada",
  message: "Nuevo mensaje privado",
  accepted: "Reclamación aceptada",
  rejected: "Reclamación rechazada",
  cancelled: "Reclamación cancelada",
  waiting: "Reclamación en espera",
  resumed: "Reclamación pendiente de nuevo",
  author_confirmed: "Entrega confirmada",
  claimant_confirmed: "Recepción confirmada",
  completed: "Devolución completada",
  closed_delivered: "Cerrada por entrega a otra persona",
  closed_withdrawn: "Cerrada por retirada del objeto",
  incident: "Incidencia registrada",
  agreement: "Acuerdo de anulación registrado",
  annulled: "Confirmación anulada por acuerdo de ambos",
};
export function recipients(claim, actor) {
  return [...new Set([claim.author_id, claim.claimant_id].map(String))].filter(
    (id) => id !== String(actor),
  );
}
export async function recordActivity(
  db,
  { objectId, claimId = null, actor, action, details = {}, notify = [] },
) {
  const {
    rows: [event],
  } = await db.query(
    "INSERT INTO activity_events(object_id,claim_id,actor_id,action,details) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [objectId, claimId, actor, action, details],
  );
  for (const id of [...new Set(notify.map(String))])
    await db.query(
      "INSERT INTO notifications(recipient_id,event_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [id, event.id],
    );
  return event.id;
}
// Project only safe fields; an event attached to another claim never appears in a claimant's history.
const fields = `e.id,e.object_id,e.claim_id,e.action,e.created_at,
 CASE WHEN e.claim_id IS NOT NULL OR e.action='withdrawn' THEN e.details->>'reason' ELSE NULL END AS reason,
 f.object_type || ' encontrado en ' || f.campus AS title`;
export function createActivityService(pool) {
  return {
    async history(user, page = 1) {
      return (
        await pool.query(
          `SELECT ${fields} FROM activity_events e JOIN found_objects f ON f.id=e.object_id
        LEFT JOIN claims c ON c.id=e.claim_id WHERE f.author_id=$1 OR c.claimant_id=$1 OR
        (e.claim_id IS NULL AND e.action IN ('published','withdrawn','edited') AND EXISTS(SELECT 1 FROM claims mine WHERE mine.object_id=f.id AND mine.claimant_id=$1)
        AND (e.action<>'edited' OR e.details->>'public_changed'='true')) ORDER BY e.id DESC LIMIT 21 OFFSET $2`,
          [user, (page - 1) * 20],
        )
      ).rows;
    },
    async notifications(user, page = 1) {
      return (
        await pool.query(
          `SELECT ${fields},n.id AS notification_id,n.read_at FROM notifications n
        JOIN activity_events e ON e.id=n.event_id JOIN found_objects f ON f.id=e.object_id
        WHERE n.recipient_id=$1 ORDER BY n.id DESC LIMIT 21 OFFSET $2`,
          [user, (page - 1) * 20],
        )
      ).rows;
    },
    async read(id, user) {
      return (
        (
          await pool.query(
            "UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND recipient_id=$2 RETURNING id",
            [id, user],
          )
        ).rowCount > 0
      );
    },
    async summary(user) {
      return (
        await pool.query(
          `SELECT
        (SELECT count(*)::int FROM found_objects WHERE author_id=$1) AS publications,
        (SELECT count(*)::int FROM claims WHERE (author_id=$1 OR claimant_id=$1) AND status IN ('pending','waiting','accepted')) AS active,
        (SELECT count(*)::int FROM claims WHERE (author_id=$1 OR claimant_id=$1) AND status='completed') AS completed`,
          [user],
        )
      ).rows[0];
    },
  };
}
