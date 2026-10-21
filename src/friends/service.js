function friendError(code, message) {
  return Object.assign(new Error(message), { code });
}

function pairFor(firstId, secondId) {
  return BigInt(firstId) < BigInt(secondId)
    ? [firstId, secondId]
    : [secondId, firstId];
}

export function createFriendsService(pool) {
  return {
    async search(userId, term) {
      const { rows } = await pool.query(
        `SELECT users.id, users.username, users.first_name, users.last_name,
                users.avatar_filename, friendships.status AS relationship_status,
                friendships.requester_id
         FROM users
         LEFT JOIN friendships
           ON friendships.user_low_id = LEAST(users.id, $1::bigint)
          AND friendships.user_high_id = GREATEST(users.id, $1::bigint)
         WHERE users.id <> $1
           AND (users.username::text ILIKE $2 OR users.email::text ILIKE $2)
         ORDER BY users.username
         LIMIT 20`,
        [userId, `%${term.replace(/[\\%_]/g, "\\$&")}%`],
      );
      return rows;
    },

    async list(userId) {
      const [friends, received, sent] = await Promise.all([
        pool.query(
          `SELECT friendships.id AS friendship_id, users.id, users.username,
                  users.first_name, users.last_name, users.avatar_filename
           FROM friendships
           JOIN users ON users.id = CASE
             WHEN friendships.user_low_id = $1 THEN friendships.user_high_id
             ELSE friendships.user_low_id END
           WHERE (friendships.user_low_id = $1 OR friendships.user_high_id = $1)
             AND friendships.status = 'accepted'
           ORDER BY users.username`,
          [userId],
        ),
        pool.query(
          `SELECT friendships.id, friendships.requested_at, users.id AS user_id,
                  users.username, users.first_name, users.last_name,
                  users.avatar_filename
           FROM friendships JOIN users ON users.id = friendships.requester_id
           WHERE friendships.recipient_id = $1 AND friendships.status = 'pending'
           ORDER BY friendships.requested_at DESC`,
          [userId],
        ),
        pool.query(
          `SELECT friendships.id, friendships.requested_at, users.id AS user_id,
                  users.username, users.first_name, users.last_name,
                  users.avatar_filename
           FROM friendships JOIN users ON users.id = friendships.recipient_id
           WHERE friendships.requester_id = $1 AND friendships.status = 'pending'
           ORDER BY friendships.requested_at DESC`,
          [userId],
        ),
      ]);
      return {
        friends: friends.rows,
        received: received.rows,
        sent: sent.rows,
      };
    },

    async sendRequest(userId, targetId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const {
          rows: [target],
        } = await client.query("SELECT id FROM users WHERE id = $1", [
          targetId,
        ]);
        if (!target)
          throw friendError(
            "FRIEND_TARGET_NOT_FOUND",
            "No se encontró esa cuenta.",
          );
        if (String(target.id) === String(userId))
          throw friendError(
            "FRIEND_SELF_REQUEST",
            "No puedes enviarte una solicitud a ti.",
          );

        const [lowId, highId] = pairFor(userId, target.id);
        await client.query(
          `SELECT id FROM users WHERE id = ANY($1::bigint[])
           ORDER BY id FOR UPDATE`,
          [[lowId, highId]],
        );
        const {
          rows: [existing],
        } = await client.query(
          `SELECT id, requester_id, recipient_id, status
           FROM friendships
           WHERE user_low_id = $1 AND user_high_id = $2
           FOR UPDATE`,
          [lowId, highId],
        );

        if (existing?.status === "accepted") {
          await client.query("COMMIT");
          return "friends";
        }
        if (existing?.status === "pending") {
          await client.query("COMMIT");
          return String(existing.requester_id) === String(userId)
            ? "pending"
            : "incoming-pending";
        }
        if (existing) {
          await client.query(
            `UPDATE friendships
             SET requester_id = $2, recipient_id = $3, status = 'pending',
                 requested_at = now(), responded_at = NULL
             WHERE id = $1`,
            [existing.id, userId, target.id],
          );
        } else {
          await client.query(
            `INSERT INTO friendships
               (user_low_id, user_high_id, requester_id, recipient_id)
             VALUES ($1, $2, $3, $4)`,
            [lowId, highId, userId, target.id],
          );
        }
        await client.query("COMMIT");
        return "sent";
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async respond(requestId, userId, status) {
      const {
        rows: [friendship],
      } = await pool.query(
        `UPDATE friendships SET status = $3, responded_at = now()
         WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
         RETURNING id`,
        [requestId, userId, status],
      );
      return Boolean(friendship);
    },

    async cancel(requestId, userId) {
      const { rowCount } = await pool.query(
        `DELETE FROM friendships
         WHERE id = $1 AND requester_id = $2 AND status = 'pending'`,
        [requestId, userId],
      );
      return rowCount > 0;
    },

    async remove(userId, friendId) {
      const [lowId, highId] = pairFor(userId, friendId);
      const { rowCount } = await pool.query(
        `DELETE FROM friendships
         WHERE user_low_id = $1 AND user_high_id = $2 AND status = 'accepted'`,
        [lowId, highId],
      );
      return rowCount > 0;
    },

    async getConversation(userId, friendId) {
      const [lowId, highId] = pairFor(userId, friendId);
      const {
        rows: [conversation],
      } = await pool.query(
        `SELECT friendships.id AS friendship_id, users.id AS user_id,
                users.username, users.first_name, users.last_name,
                users.avatar_filename
         FROM friendships
         JOIN users ON users.id = CASE
           WHEN friendships.user_low_id = $3 THEN friendships.user_high_id
           ELSE friendships.user_low_id END
         WHERE friendships.user_low_id = $1 AND friendships.user_high_id = $2
           AND friendships.status = 'accepted'`,
        [lowId, highId, userId],
      );
      return conversation ?? null;
    },

    async getMessages(friendshipId, afterId = "0") {
      const { rows } = await pool.query(
        `SELECT id, sender_id, content, created_at
         FROM friendship_messages
         WHERE friendship_id = $1 AND id > $2
         ORDER BY created_at DESC, id DESC
         LIMIT 100`,
        [friendshipId, afterId],
      );
      return rows.reverse();
    },

    async sendMessage(friendshipId, userId, content) {
      const {
        rows: [message],
      } = await pool.query(
        `INSERT INTO friendship_messages (friendship_id, sender_id, content)
         SELECT friendships.id, $2, $3
         FROM friendships
         WHERE friendships.id = $1 AND friendships.status = 'accepted'
           AND (friendships.user_low_id = $2 OR friendships.user_high_id = $2)
         RETURNING id, sender_id, content, created_at`,
        [friendshipId, userId, content],
      );
      return message ?? null;
    },
  };
}
