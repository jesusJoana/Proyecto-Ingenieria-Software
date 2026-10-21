/** Amistades y mensajes privados entre usuarios. */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE friendships (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_low_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      user_high_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      requester_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      recipient_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending',
      requested_at timestamptz NOT NULL DEFAULT now(),
      responded_at timestamptz,
      CONSTRAINT friendships_distinct_users CHECK (user_low_id < user_high_id),
      CONSTRAINT friendships_pair_members CHECK (
        requester_id <> recipient_id
        AND LEAST(requester_id, recipient_id) = user_low_id
        AND GREATEST(requester_id, recipient_id) = user_high_id
      ),
      CONSTRAINT friendships_status_valid CHECK (
        status IN ('pending', 'accepted', 'rejected')
      ),
      CONSTRAINT friendships_response_valid CHECK (
        (status = 'pending' AND responded_at IS NULL)
        OR (status IN ('accepted', 'rejected') AND responded_at IS NOT NULL)
      ),
      CONSTRAINT friendships_pair_unique UNIQUE (user_low_id, user_high_id)
    );

    CREATE INDEX friendships_recipient_pending_idx
      ON friendships (recipient_id, requested_at DESC)
      WHERE status = 'pending';
    CREATE INDEX friendships_requester_pending_idx
      ON friendships (requester_id, requested_at DESC)
      WHERE status = 'pending';

    CREATE TABLE friendship_messages (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      friendship_id bigint NOT NULL REFERENCES friendships (id) ON DELETE CASCADE,
      sender_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT friendship_messages_content_valid CHECK (
        char_length(btrim(content)) BETWEEN 1 AND 2000
      )
    );

    CREATE INDEX friendship_messages_history_idx
      ON friendship_messages (friendship_id, id);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE friendship_messages;
    DROP TABLE friendships;
  `);
};
