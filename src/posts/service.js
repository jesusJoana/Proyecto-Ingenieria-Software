import { publicPost } from "./privacy.js";
import {
  PUBLIC_FIELDS,
  PRIVATE_FIELDS,
  SEARCH_DEFAULTS,
  SEARCH_LIMIT,
} from "./validation.js";
const columns = `f.id,f.author_id,f.category,f.object_type,f.university,f.campus,f.general_area,
 to_char(f.found_from,'YYYY-MM-DD') AS found_from,to_char(f.found_until,'YYYY-MM-DD') AS found_until,
 f.status,f.created_at,f.object_type || ' encontrado en ' || f.campus AS title,
 u.username AS author_username,f.campus_latitude::float8,f.campus_longitude::float8`;
const like = (value) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
export class PostError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function createPostsService(pool) {
  async function transaction(work) {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const result = await work(c);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async function lock(c, id, author) {
    const {
      rows: [row],
    } = await c.query(
      `SELECT *,to_char(found_from,'YYYY-MM-DD') AS date_from,to_char(found_until,'YYYY-MM-DD') AS date_until FROM found_objects WHERE id=$1 FOR UPDATE`,
      [id],
    );
    if (!row) throw new PostError(404, "Hallazgo no encontrado.");
    if (String(row.author_id) !== String(author))
      throw new PostError(403, "Solo el autor puede realizar esta acción.");
    return row;
  }
  async function snapshot(c, id) {
    await c.query(
      `INSERT INTO found_object_versions(object_id,version,public_data,private_data)
 SELECT f.id,COALESCE((SELECT max(version) FROM found_object_versions WHERE object_id=f.id),0)+1,
 jsonb_build_object('category',f.category,'object_type',f.object_type,'university',f.university,'campus',f.campus,'general_area',f.general_area,'found_from',f.found_from,'found_until',f.found_until,'campus_latitude',f.campus_latitude,'campus_longitude',f.campus_longitude),
 jsonb_build_object('distinguishing_details',p.distinguishing_details,'exact_location',p.exact_location,'deposit_location',p.deposit_location,'photo_key',p.photo_key)
 FROM found_objects f JOIN found_object_private p ON p.object_id=f.id WHERE f.id=$1`,
      [id],
    );
  }
  async function event(c, id, actor, action, details = {}) {
    return (
      await c.query(
        "INSERT INTO activity_events(object_id,actor_id,action,details) VALUES ($1,$2,$3,$4) RETURNING id",
        [id, actor, action, details],
      )
    ).rows[0].id;
  }
  return {
    async create(author, data) {
      return transaction(async (c) => {
        const {
          rows: [post],
        } = await c.query(
          `INSERT INTO found_objects(author_id,${PUBLIC_FIELDS.join(",")}) VALUES (${[author, ...PUBLIC_FIELDS.map((k) => data[k])].map((_, i) => "$" + (i + 1)).join(",")}) RETURNING id`,
          [author, ...PUBLIC_FIELDS.map((k) => data[k])],
        );
        await c.query(
          `INSERT INTO found_object_private(object_id,distinguishing_details,exact_location,deposit_location,photo_key) VALUES ($1,$2,$3,$4,$5)`,
          [
            post.id,
            ...PRIVATE_FIELDS.map((k) => data[k] || null),
            data.photoKey ?? null,
          ],
        );
        await snapshot(c, post.id);
        await event(c, post.id, author, "published");
        return post;
      });
    },
    async search(input = {}, limit = SEARCH_LIMIT, { located = false } = {}) {
      const f = { ...SEARCH_DEFAULTS, ...input };
      const values = [
        like(f.q),
        f.category,
        like(f.university),
        like(f.campus),
        like(f.general_area),
        f.from || null,
        f.until || null,
        located,
        limit + 1,
        (f.page - 1) * limit,
      ];
      const { rows } = await pool.query(
        `SELECT ${columns} FROM found_objects f JOIN users u ON u.id=f.author_id
 WHERE f.status IN ('available','reserved')
 AND (f.object_type ILIKE $1 OR f.university ILIKE $1 OR f.campus ILIKE $1 OR f.general_area ILIKE $1 OR f.category ILIKE $1)
 AND ($2='' OR f.category=$2) AND f.university ILIKE $3 AND f.campus ILIKE $4 AND f.general_area ILIKE $5
 AND ($6::date IS NULL OR f.found_until >= $6) AND ($7::date IS NULL OR f.found_from <= $7)
 AND (NOT $8 OR f.campus_latitude IS NOT NULL) ORDER BY f.created_at DESC,f.id DESC LIMIT $9 OFFSET $10`,
        values,
      );
      return {
        posts: rows.slice(0, limit).map(publicPost),
        hasNext: rows.length > limit,
      };
    },
    async findById(id, viewer = null) {
      const {
        rows: [row],
      } = await pool.query(
        `SELECT ${columns} FROM found_objects f JOIN users u ON u.id=f.author_id WHERE f.id=$1`,
        [id],
      );
      if (!row) return null;
      const isAuthor = String(row.author_id) === String(viewer);
      if (!isAuthor && !["available", "reserved"].includes(row.status)) {
        if (!viewer) return null;
        if (
          !(
            await pool.query(
              "SELECT 1 FROM claims WHERE object_id=$1 AND claimant_id=$2 LIMIT 1",
              [id, viewer],
            )
          ).rowCount
        )
          return null;
      }
      const result = { ...publicPost(row), isAuthor };
      if (isAuthor) {
        const {
          rows: [privateRow],
        } = await pool.query(
          "SELECT distinguishing_details,exact_location,deposit_location,photo_key FROM found_object_private WHERE object_id=$1",
          [id],
        );
        result.private = privateRow;
      }
      return result;
    },
    async listByAuthor(author) {
      const { rows } = await pool.query(
        `SELECT ${columns} FROM found_objects f JOIN users u ON u.id=f.author_id WHERE f.author_id=$1 ORDER BY f.created_at DESC,f.id DESC`,
        [author],
      );
      return rows.map(publicPost);
    },
    async update(id, author, data) {
      return transaction(async (c) => {
        const old = await lock(c, id, author);
        if (!["available", "reserved"].includes(old.status))
          throw new PostError(409, "Un hallazgo cerrado no se puede editar.");
        const oldDates = {
          ...old,
          found_from: old.date_from,
          found_until: old.date_until,
        };
        const comparable = (key, value) =>
          value == null
            ? ""
            : key.startsWith("campus_")
              ? String(Number(value))
              : String(value);
        const publicChanged = PUBLIC_FIELDS.some(
          (k) => comparable(k, oldDates[k]) !== comparable(k, data[k]),
        );
        await c.query(
          `UPDATE found_objects SET ${PUBLIC_FIELDS.map((k, i) => `${k}=$${i + 2}`).join(",")},updated_at=now() WHERE id=$1`,
          [id, ...PUBLIC_FIELDS.map((k) => data[k])],
        );
        await c.query(
          `UPDATE found_object_private SET distinguishing_details=$2,exact_location=$3,deposit_location=$4,
 photo_key=CASE WHEN $5 THEN $6::uuid ELSE photo_key END WHERE object_id=$1`,
          [
            id,
            ...PRIVATE_FIELDS.map((k) => data[k] || null),
            data.photoKey !== undefined || data.removePhoto,
            data.photoKey ?? null,
          ],
        );
        await snapshot(c, id);
        const eid = await event(c, id, author, "edited", {
          public_changed: publicChanged,
        });
        if (publicChanged)
          await c.query(
            `INSERT INTO notifications(recipient_id,event_id) SELECT DISTINCT claimant_id,$2::bigint FROM claims WHERE object_id=$1 AND status IN ('pending','waiting','accepted')`,
            [id, eid],
          );
        return { id };
      });
    },
    async withdraw(id, author, reason) {
      return transaction(async (c) => {
        const old = await lock(c, id, author);
        if (old.status !== "available")
          throw new PostError(
            409,
            "Solo se puede retirar un hallazgo disponible.",
          );
        if (
          (
            await c.query("SELECT 1 FROM claims WHERE object_id=$1 LIMIT 1", [
              id,
            ])
          ).rowCount
        )
          throw new PostError(
            409,
            "La retirada de hallazgos con reclamaciones aún no está disponible.",
          );
        await c.query(
          "UPDATE found_objects SET status='withdrawn',withdrawal_reason=$2,updated_at=now() WHERE id=$1",
          [id, reason],
        );
        await event(c, id, author, "withdrawn", { reason });
        return { id };
      });
    },
    async versions(id, author) {
      return transaction(async (c) => {
        await lock(c, id, author);
        return (
          await c.query(
            "SELECT version,public_data,private_data,created_at FROM found_object_versions WHERE object_id=$1 ORDER BY version DESC",
            [id],
          )
        ).rows;
      });
    },
    async canReadPhoto(id, author, key) {
      return Boolean(
        (
          await pool.query(
            `SELECT 1 FROM found_objects f WHERE f.id=$1 AND f.author_id=$2 AND
 (EXISTS(SELECT 1 FROM found_object_private p WHERE p.object_id=f.id AND p.photo_key=$3::uuid) OR
 EXISTS(SELECT 1 FROM found_object_versions v WHERE v.object_id=f.id AND v.private_data->>'photo_key'=$3::text))`,
            [id, author, key],
          )
        ).rowCount,
      );
    },
  };
}
