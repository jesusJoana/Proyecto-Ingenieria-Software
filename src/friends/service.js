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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const {
          rows: [friendship],
        } = await client.query(
          `SELECT id FROM friendships
           WHERE user_low_id = $1 AND user_high_id = $2 AND status = 'accepted'
           FOR UPDATE`,
          [lowId, highId],
        );
        if (!friendship) {
          await client.query("COMMIT");
          return { removed: false, internalNames: [] };
        }
        const { rows: attachments } = await client.query(
          `SELECT attachments.internal_name
           FROM friendship_message_attachments attachments
           JOIN friendship_messages messages ON messages.id = attachments.message_id
           WHERE messages.friendship_id = $1`,
          [friendship.id],
        );
        await client.query("DELETE FROM friendships WHERE id = $1", [friendship.id]);
        await client.query("COMMIT");
        return {
          removed: true,
          internalNames: attachments.map(({ internal_name }) => internal_name),
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
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
        `SELECT messages.id, messages.sender_id, messages.content, messages.created_at,
                COALESCE((
                  SELECT json_agg(json_build_object(
                    'id', attachments.id,
                    'original_name', attachments.original_name,
                    'mime_type', attachments.mime_type,
                    'size_bytes', attachments.size_bytes,
                    'attachment_type', attachments.attachment_type
                  ) ORDER BY attachments.id)
                  FROM friendship_message_attachments attachments
                  WHERE attachments.message_id = messages.id
                ), '[]'::json) AS attachments
         FROM friendship_messages messages
         WHERE messages.friendship_id = $1 AND messages.id > $2
         ORDER BY messages.created_at DESC, messages.id DESC
         LIMIT 100`,
        [friendshipId, afterId],
      );
      return rows.reverse();
    },

    async sendMessage(friendshipId, userId, content, attachments = []) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const {
          rows: [message],
        } = await client.query(
          `INSERT INTO friendship_messages (friendship_id, sender_id, content)
           SELECT friendships.id, $2, $3
           FROM friendships
           WHERE friendships.id = $1 AND friendships.status = 'accepted'
             AND (friendships.user_low_id = $2 OR friendships.user_high_id = $2)
           RETURNING id, sender_id, content, created_at`,
          [friendshipId, userId, content],
        );
        if (!message) {
          await client.query("ROLLBACK");
          return null;
        }
        const insertedAttachments = [];
        for (const attachment of attachments) {
          const {
            rows: [savedAttachment],
          } = await client.query(
            `INSERT INTO friendship_message_attachments
               (message_id, original_name, internal_name, mime_type, size_bytes, attachment_type)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, original_name, mime_type, size_bytes, attachment_type`,
            [
              message.id,
              attachment.originalName,
              attachment.internalName,
              attachment.mime,
              attachment.size,
              attachment.kind,
            ],
          );
          insertedAttachments.push(savedAttachment);
        }
        await client.query("COMMIT");
        return { ...message, attachments: insertedAttachments };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async getAttachmentForUser(attachmentId, userId) {
      const {
        rows: [attachment],
      } = await pool.query(
        `SELECT attachments.id, attachments.original_name, attachments.internal_name,
                attachments.mime_type, attachments.size_bytes, attachments.attachment_type
         FROM friendship_message_attachments attachments
         JOIN friendship_messages messages ON messages.id = attachments.message_id
         JOIN friendships ON friendships.id = messages.friendship_id
         WHERE attachments.id = $1 AND friendships.status = 'accepted'
           AND (friendships.user_low_id = $2 OR friendships.user_high_id = $2)`,
        [attachmentId, userId],
      );
      return attachment ?? null;
    },
  };
}
