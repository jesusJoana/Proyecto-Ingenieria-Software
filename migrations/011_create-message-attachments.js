/** Adjuntos privados asociados a mensajes del chat. */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE friendship_messages
      DROP CONSTRAINT friendship_messages_content_valid;
    ALTER TABLE friendship_messages
      ADD CONSTRAINT friendship_messages_content_valid CHECK (
        char_length(btrim(content)) BETWEEN 0 AND 2000
      );

    CREATE TABLE friendship_message_attachments (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      message_id bigint NOT NULL REFERENCES friendship_messages (id) ON DELETE CASCADE,
      original_name text NOT NULL,
      internal_name uuid NOT NULL UNIQUE,
      mime_type text NOT NULL,
      size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
      attachment_type text NOT NULL CHECK (attachment_type IN ('photo', 'file')),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX friendship_message_attachments_message_idx
      ON friendship_message_attachments (message_id, id);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TABLE friendship_message_attachments;
    DELETE FROM friendship_messages WHERE char_length(btrim(content)) = 0;
    ALTER TABLE friendship_messages
      ADD CONSTRAINT friendship_messages_content_valid CHECK (
        char_length(btrim(content)) BETWEEN 1 AND 2000
      );
  `);
};