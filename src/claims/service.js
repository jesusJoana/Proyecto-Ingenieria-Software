import { participant, canWrite, ACTIVE_STATUSES } from "./validation.js";
export class ClaimError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function assertParticipant(claim, user) {
  if (!claim || !participant(claim, user))
    throw new ClaimError(404, "Reclamación no encontrada.");
}
export function assertWritable(claim) {
  if (!canWrite(claim))
    throw new ClaimError(
      409,
      "La conversación está cerrada y solo permite consulta.",
    );
}
const selection = `c.id,c.object_id,c.author_id,c.claimant_id,c.description,c.distinguishing_details,c.lost_location,c.date_unknown,to_char(c.lost_from,'YYYY-MM-DD') AS lost_from,to_char(c.lost_until,'YYYY-MM-DD') AS lost_until,c.additional_information,c.previous_claim_id,c.status,c.created_at,c.decision_reason,f.object_type || ' encontrado en ' || f.campus AS title,au.username AS author_username,cu.username AS claimant_username`;
const joins =
  "FROM claims c JOIN found_objects f ON f.id=c.object_id JOIN users au ON au.id=c.author_id JOIN users cu ON cu.id=c.claimant_id";
export function createClaimsService(pool) {
  async function transaction(work) {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const r = await work(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      if (e.code === "23505")
        throw new ClaimError(
          409,
          "Ya existe una reclamación activa para este objeto.",
        );
      throw e;
    } finally {
      c.release();
    }
  }
  async function context(db, objectId, user, lock = false) {
    const {
      rows: [object],
    } = await db.query(
      `SELECT id,author_id,status,object_type || ' encontrado en ' || campus AS title FROM found_objects WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
      [objectId],
    );
    if (!object) throw new ClaimError(404, "Hallazgo no encontrado.");
    if (String(object.author_id) === String(user))
      throw new ClaimError(403, "No puedes reclamar tu propio hallazgo.");
    const {
      rows: [previous],
    } = await db.query(
      "SELECT id,status FROM claims WHERE object_id=$1 AND claimant_id=$2 ORDER BY id DESC LIMIT 1",
      [objectId, user],
    );
    if (previous && ACTIVE_STATUSES.includes(previous.status))
      return { object, active: previous, previous: null };
    if (object.status !== "available")
      throw new ClaimError(
        409,
        "Solo se pueden reclamar hallazgos disponibles.",
      );
    if (previous && !["rejected", "cancelled"].includes(previous.status))
      throw new ClaimError(
        409,
        "No se puede abrir otra reclamación para este objeto.",
      );
    return { object, active: null, previous: previous ?? null };
  }
  async function get(id, user, db = pool, lock = false) {
    const {
      rows: [claim],
    } = await db.query(
      `SELECT ${selection} ${joins} WHERE c.id=$1 AND ($2=c.author_id OR $2=c.claimant_id) ${lock ? "FOR UPDATE OF c" : ""}`,
      [id, user],
    );
    assertParticipant(claim, user);
    return claim;
  }
  async function addFiles(c, table, column, id, files) {
    for (const f of files)
      await c.query(
        `INSERT INTO ${table}(${column},storage_key,original_name,mime_type,byte_size) VALUES($1,$2,$3,$4,$5)`,
        [id, f.storage_key, f.original_name, f.mime_type, f.byte_size],
      );
  }
  return {
    context: (id, user) => context(pool, id, user),
    get,
    async create(objectId, user, data, files = []) {
      return transaction(async (c) => {
        const info = await context(c, objectId, user, true);
        if (info.active)
          throw new ClaimError(
            409,
            "Ya tienes una reclamación activa; continúa en su conversación.",
          );
        if (
          info.previous &&
          (!data.additional_information ||
            data.additional_information.trim().length < 10)
        )
          throw new ClaimError(
            422,
            "Explica la información adicional que aportas (10–2000 caracteres).",
          );
        const {
          rows: [claim],
        } = await c.query(
          `INSERT INTO claims(object_id,author_id,claimant_id,description,distinguishing_details,lost_location,date_unknown,lost_from,lost_until,additional_information,previous_claim_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
          [
            objectId,
            info.object.author_id,
            user,
            data.description,
            data.distinguishing_details,
            data.lost_location,
            data.date_unknown,
            data.lost_from,
            data.lost_until,
            data.additional_information || null,
            info.previous?.id ?? null,
          ],
        );
        await addFiles(c, "claim_evidence", "claim_id", claim.id, files);
        const {
          rows: [event],
        } = await c.query(
          "INSERT INTO activity_events(object_id,claim_id,actor_id,action) VALUES($1,$2,$3,'claimed') RETURNING id",
          [objectId, claim.id, user],
        );
        await c.query(
          "INSERT INTO notifications(recipient_id,event_id) VALUES($1,$2)",
          [info.object.author_id, event.id],
        );
        return claim;
      });
    },
    async list(user, page = 1) {
      const { rows } = await pool.query(
        `SELECT c.id,c.object_id,c.status,c.created_at,f.object_type || ' encontrado en ' || f.campus AS title,CASE WHEN c.author_id=$1 THEN u.username ELSE a.username END AS other_username FROM claims c JOIN found_objects f ON f.id=c.object_id JOIN users a ON a.id=c.author_id JOIN users u ON u.id=c.claimant_id WHERE c.author_id=$1 OR c.claimant_id=$1 ORDER BY c.created_at DESC,c.id DESC LIMIT 21 OFFSET $2`,
        [user, (page - 1) * 20],
      );
      return { claims: rows.slice(0, 20), hasNext: rows.length > 20 };
    },
    async evidence(id, user) {
      await get(id, user);
      return (
        await pool.query(
          "SELECT storage_key,original_name,mime_type,byte_size FROM claim_evidence WHERE claim_id=$1 ORDER BY id",
          [id],
        )
      ).rows;
    },
    async messages(id, user, { after = null, before = null } = {}) {
      const claim = await get(id, user);
      const { rows } = await pool.query(
        `SELECT m.id,m.body,m.created_at,u.username AS sender_username FROM claim_messages m JOIN users u ON u.id=m.sender_id WHERE m.claim_id=$1 AND ($2::bigint IS NULL OR m.id>$2) AND ($3::bigint IS NULL OR m.id<$3) ORDER BY m.id ${after ? "ASC" : "DESC"} LIMIT 51`,
        [id, after, before],
      );
      const more = rows.length > 50,
        items = rows.slice(0, 50);
      if (!after) items.reverse();
      const files = items.length
        ? (
            await pool.query(
              "SELECT message_id,storage_key,original_name,mime_type,byte_size FROM claim_message_files WHERE message_id=ANY($1::bigint[]) ORDER BY id",
              [items.map((m) => m.id)],
            )
          ).rows
        : [];
      for (const m of items)
        m.files = files
          .filter((f) => f.message_id === m.id)
          .map(({ message_id, ...f }) => f);
      return {
        messages: items,
        more,
        status: claim.status,
        writable: canWrite(claim),
      };
    },
    async send(id, user, body, files = []) {
      return transaction(async (c) => {
        const claim = await get(id, user, c, true);
        assertWritable(claim);
        const {
          rows: [message],
        } = await c.query(
          "INSERT INTO claim_messages(claim_id,sender_id,body) VALUES($1,$2,$3) RETURNING id",
          [id, user, body],
        );
        await addFiles(
          c,
          "claim_message_files",
          "message_id",
          message.id,
          files,
        );
        return message;
      });
    },
    async file(id, user, key) {
      await get(id, user);
      return (
        (
          await pool.query(
            `SELECT storage_key,original_name,mime_type,byte_size FROM claim_evidence WHERE claim_id=$1 AND storage_key=$2 UNION ALL SELECT f.storage_key,f.original_name,f.mime_type,f.byte_size FROM claim_message_files f JOIN claim_messages m ON m.id=f.message_id WHERE m.claim_id=$1 AND f.storage_key=$2`,
            [id, key],
          )
        ).rows[0] ?? null
      );
    },
  };
}
