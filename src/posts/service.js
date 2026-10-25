/** Acceso a PostgreSQL para las publicaciones de objetos. */
const POST_COLUMNS = `
  object_posts.id, object_posts.kind, object_posts.title,
  object_posts.description, object_posts.category, object_posts.color,
  object_posts.brand, object_posts.location,
  object_posts.university, object_posts.campus, object_posts.city, object_posts.country,
  object_posts.campus_address, object_posts.location_mode, object_posts.latitude,
  object_posts.longitude, object_posts.deposit_location,
  to_char(object_posts.event_date, 'YYYY-MM-DD') AS event_date,
  object_posts.photo_filename, object_posts.status,
  object_posts.created_at, object_posts.updated_at,
  users.username AS author_username, users.first_name AS author_first_name,
  users.last_name AS author_last_name,
  users.avatar_filename AS author_avatar_filename`;

export function createPostsService(pool) {
  return {
    async updateLocation(id, authorId, data) {
      const {
        rows: [post],
      } = await pool.query(
        `UPDATE object_posts SET
        university=$3, campus=$4, city=$5, country=$6, campus_address=$7,
        location_mode=$8, latitude=$9, longitude=$10, location=$11,
        deposit_location=$12, updated_at=now()
        WHERE id=$1 AND author_id=$2 RETURNING id`,
        [
          id,
          authorId,
          data.university,
          data.campus,
          data.city,
          data.country,
          data.campus_address,
          data.location_mode,
          data.latitude,
          data.longitude,
          data.location,
          data.deposit_location,
        ],
      );
      return post ?? null;
    },
    async create(authorId, data) {
      const {
        rows: [post],
      } = await pool.query(
        `INSERT INTO object_posts
           (author_id, kind, title, description, category, color, brand,
            location, event_date, photo_filename, university, campus, city, country,
            campus_address, location_mode, latitude, longitude, deposit_location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING id`,
        [
          authorId,
          data.kind,
          data.title,
          data.description,
          data.category,
          data.color,
          data.brand,
          data.location,
          data.event_date,
          data.photoFilename ?? null,
          data.university,
          data.campus,
          data.city,
          data.country,
          data.campus_address,
          data.location_mode,
          data.latitude,
          data.longitude,
          data.deposit_location,
        ],
      );
      return post;
    },

    async listRecent(limit = 50) {
      const { rows } = await pool.query(
        `SELECT ${POST_COLUMNS}
         FROM object_posts JOIN users ON users.id = object_posts.author_id
         ORDER BY object_posts.created_at DESC, object_posts.id DESC
         LIMIT $1`,
        [limit],
      );
      return rows;
    },

    async listLocated({ university = '', campus = '', kind = '' } = {}) {
      const { rows } = await pool.query(
        `SELECT ${POST_COLUMNS}
        FROM object_posts JOIN users ON users.id = object_posts.author_id
        WHERE object_posts.status = 'active' AND object_posts.latitude IS NOT NULL
          AND ($1 = '' OR object_posts.university ILIKE '%' || $1 || '%')
          AND ($2 = '' OR object_posts.kind = $2)
          AND ($3 = '' OR object_posts.campus ILIKE '%' || $3 || '%')
        ORDER BY object_posts.created_at DESC, object_posts.id DESC LIMIT 200`,
        [university, kind, campus],
      );
      return rows;
    },

    async listByAuthor(authorId) {
      const { rows } = await pool.query(
        `SELECT ${POST_COLUMNS}
         FROM object_posts JOIN users ON users.id = object_posts.author_id
         WHERE object_posts.author_id = $1
         ORDER BY object_posts.created_at DESC, object_posts.id DESC`,
        [authorId],
      );
      return rows;
    },

    async findById(id) {
      const {
        rows: [post],
      } = await pool.query(
        `SELECT ${POST_COLUMNS}, object_posts.author_id
         FROM object_posts JOIN users ON users.id = object_posts.author_id
         WHERE object_posts.id = $1`,
        [id],
      );
      return post ?? null;
    },
  };
}
