function exchangeError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function createExchangeService(pool) {
  return {
    async create(initiatorId, recipientUsername, description) {
      const {
        rows: [exchange],
      } = await pool.query(
        `INSERT INTO object_exchanges
           (giver_id, receiver_id, object_description, status)
         SELECT $1, users.id, $3, 'pending'
         FROM users
         WHERE username = $2 AND users.id <> $1
         RETURNING id`,
        [initiatorId, recipientUsername, description],
      );
      if (!exchange)
        throw exchangeError(
          'EXCHANGE_TARGET_INVALID',
          'No se puede proponer un intercambio a esa cuenta.',
        );
      return exchange;
    },

    async accept(exchangeId, userId) {
      const {
        rows: [exchange],
      } = await pool.query(
        `UPDATE object_exchanges
         SET status = 'accepted'
         WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
         RETURNING id, status`,
        [exchangeId, userId],
      );
      return exchange ?? null;
    },

    async confirm(exchangeId, userId) {
      const {
        rows: [exchange],
      } = await pool.query(
        `UPDATE object_exchanges
         SET giver_confirmed_at = CASE
               WHEN giver_id = $2 THEN COALESCE(giver_confirmed_at, now())
               ELSE giver_confirmed_at
             END,
             receiver_confirmed_at = CASE
               WHEN receiver_id = $2 THEN COALESCE(receiver_confirmed_at, now())
               ELSE receiver_confirmed_at
             END,
             status = CASE
               WHEN (giver_confirmed_at IS NOT NULL OR giver_id = $2)
                AND (receiver_confirmed_at IS NOT NULL OR receiver_id = $2)
               THEN 'completed'
               ELSE status
             END,
             completed_at = CASE
               WHEN (giver_confirmed_at IS NOT NULL OR giver_id = $2)
                AND (receiver_confirmed_at IS NOT NULL OR receiver_id = $2)
               THEN COALESCE(completed_at, now())
               ELSE completed_at
             END
         WHERE id = $1 AND status = 'accepted'
           AND (giver_id = $2 OR receiver_id = $2)
         RETURNING id, status, giver_confirmed_at,
                   receiver_confirmed_at, completed_at`,
        [exchangeId, userId],
      );
      return exchange ?? null;
    },

    async review(exchangeId, reviewerId, { rating, comment }) {
      try {
        const {
          rows: [review],
        } = await pool.query(
          `INSERT INTO user_ratings
             (exchange_id, reviewer_id, rated_user_id, stars, comment)
           SELECT id, $2,
                  CASE WHEN giver_id = $2 THEN receiver_id ELSE giver_id END,
                  $3, $4
           FROM object_exchanges
           WHERE id = $1 AND status = 'completed'
             AND (giver_id = $2 OR receiver_id = $2)
           RETURNING exchange_id, reviewer_id, rated_user_id,
                     stars AS rating, comment, created_at`,
          [exchangeId, reviewerId, rating, comment],
        );
        if (!review)
          throw exchangeError(
            'REVIEW_NOT_ALLOWED',
            'Solo los participantes pueden valorar un intercambio completado.',
          );
        return review;
      } catch (error) {
        if (error.code === '23505')
          throw exchangeError(
            'REVIEW_EXISTS',
            'Ya has valorado este intercambio.',
          );
        throw error;
      }
    },

    async getForUser(userId) {
      const { rows } = await pool.query(
        `SELECT e.id, e.object_description AS description, e.status, e.created_at,
                e.giver_confirmed_at, e.receiver_confirmed_at,
                e.receiver_id = $1 AS is_recipient,
                CASE WHEN e.giver_id = $1
                  THEN e.giver_confirmed_at ELSE e.receiver_confirmed_at
                END AS my_confirmed_at,
                CASE WHEN e.giver_id = $1
                  THEN e.receiver_confirmed_at ELSE e.giver_confirmed_at
                END AS other_confirmed_at,
                other.id AS other_user_id, other.username AS other_username,
                other.first_name AS other_first_name,
                other.avatar_filename AS other_avatar_filename,
                EXISTS (
                  SELECT 1 FROM user_ratings r
                  WHERE r.reviewer_id = $1
                    AND r.rated_user_id = other.id
                    AND r.exchange_id IS NOT NULL
                ) AS reviewed_by_me
         FROM object_exchanges e
         JOIN users other ON other.id = CASE
           WHEN e.giver_id = $1 THEN e.receiver_id ELSE e.giver_id END
         WHERE e.giver_id = $1 OR e.receiver_id = $1
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT 50`,
        [userId],
      );
      return rows;
    },

    async getRatingSummary(userId) {
      const [summaryResult, reviewsResult] = await Promise.all([
        pool.query(
            `SELECT COALESCE(round(avg(stars)::numeric, 1), 0) AS average_rating,
                  count(*)::int AS review_count
             FROM user_ratings
             WHERE rated_user_id = $1 AND exchange_id IS NOT NULL AND comment IS NOT NULL`,
          [userId],
        ),
        pool.query(
          `SELECT r.stars AS rating, r.comment, r.created_at,
                  reviewer.username, reviewer.first_name, reviewer.last_name,
                  reviewer.avatar_filename
           FROM user_ratings r
           JOIN users reviewer ON reviewer.id = r.reviewer_id
           WHERE r.rated_user_id = $1
             AND r.exchange_id IS NOT NULL AND r.comment IS NOT NULL
           ORDER BY r.created_at DESC, r.reviewer_id DESC
           LIMIT 100`,
          [userId],
        ),
      ]);
      const summary = summaryResult.rows[0];
      return {
        averageRating: Number(summary.average_rating),
        reviewCount: Number(summary.review_count),
        reviews: reviewsResult.rows,
      };
    },
  };
}