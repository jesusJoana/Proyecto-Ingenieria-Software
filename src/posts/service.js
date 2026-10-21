/** Acceso a PostgreSQL para las publicaciones de objetos. */
const POST_COLUMNS = `
  object_posts.id, object_posts.kind, object_posts.title,
  object_posts.description, object_posts.category, object_posts.color,
  object_posts.brand, object_posts.location,
  to_char(object_posts.event_date, 'YYYY-MM-DD') AS event_date,
  object_posts.photo_filename, object_posts.status,
  object_posts.created_at, object_posts.updated_at,
  users.username AS author_username, users.first_name AS author_first_name,
  users.last_name AS author_last_name,
  users.avatar_filename AS author_avatar_filename`;

export function createPostsService(pool) {
  return {
    async create(authorId, data) {
      const {
        rows: [post],
      } = await pool.query(
        `INSERT INTO object_posts
           (author_id, kind, title, description, category, color, brand,
            location, event_date, photo_filename)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
