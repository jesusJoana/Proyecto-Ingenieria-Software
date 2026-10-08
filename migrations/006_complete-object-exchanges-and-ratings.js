/** Completa los intercambios y las valoraciones ya existentes en el esquema. */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE object_exchanges
      ADD COLUMN status text NOT NULL DEFAULT 'pending',
      ADD COLUMN giver_confirmed_at timestamptz,
      ADD COLUMN receiver_confirmed_at timestamptz,
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

    UPDATE object_exchanges
    SET status = 'completed',
        giver_confirmed_at = completed_at,
        receiver_confirmed_at = completed_at
    WHERE completed_at IS NOT NULL;

    UPDATE object_exchanges
    SET status = 'accepted'
    WHERE completed_at IS NULL;

    ALTER TABLE object_exchanges
      ADD CONSTRAINT object_exchanges_status_valid CHECK (
        status IN ('pending', 'accepted', 'completed')
      ),
      ADD CONSTRAINT object_exchanges_completed_at_valid CHECK (
        (status = 'completed') = (completed_at IS NOT NULL)
      ),
      ADD CONSTRAINT object_exchanges_completed_confirmations_valid CHECK (
        status <> 'completed'
        OR (giver_confirmed_at IS NOT NULL AND receiver_confirmed_at IS NOT NULL)
      );

    CREATE INDEX object_exchanges_giver_created_idx
      ON object_exchanges (giver_id, created_at DESC);
    CREATE INDEX object_exchanges_receiver_created_idx
      ON object_exchanges (receiver_id, created_at DESC);

    ALTER TABLE user_ratings
      ADD COLUMN exchange_id bigint REFERENCES object_exchanges (id) ON DELETE CASCADE,
      ADD COLUMN comment text,
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
      ADD CONSTRAINT user_ratings_exchange_comment_valid CHECK (
        exchange_id IS NULL OR (
          comment IS NOT NULL AND char_length(btrim(comment)) BETWEEN 1 AND 1000
        )
      );

    CREATE INDEX user_ratings_rated_created_idx
      ON user_ratings (rated_user_id, created_at DESC);

    CREATE FUNCTION refind_validate_user_rating() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE exchange_row object_exchanges%ROWTYPE;
    BEGIN
      IF NEW.exchange_id IS NULL OR NEW.comment IS NULL
         OR char_length(btrim(NEW.comment)) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'A rating needs a completed exchange and a comment'
          USING ERRCODE = '23514';
      END IF;

      SELECT * INTO exchange_row
      FROM object_exchanges
      WHERE id = NEW.exchange_id
      FOR SHARE;

      IF NOT FOUND OR exchange_row.status <> 'completed' THEN
        RAISE EXCEPTION 'Rating requires a completed exchange'
          USING ERRCODE = '23514';
      END IF;

      IF NOT (
        (NEW.reviewer_id = exchange_row.giver_id AND NEW.rated_user_id = exchange_row.receiver_id)
        OR
        (NEW.reviewer_id = exchange_row.receiver_id AND NEW.rated_user_id = exchange_row.giver_id)
      ) THEN
        RAISE EXCEPTION 'Rating users must be participants in the exchange'
          USING ERRCODE = '23514';
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER user_ratings_require_completed_exchange
      BEFORE INSERT ON user_ratings
      FOR EACH ROW EXECUTE FUNCTION refind_validate_user_rating();

    CREATE FUNCTION refind_prevent_user_rating_update() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'User ratings cannot be edited'
        USING ERRCODE = '55000';
    END;
    $$;

    CREATE TRIGGER user_ratings_are_immutable
      BEFORE UPDATE ON user_ratings
      FOR EACH ROW EXECUTE FUNCTION refind_prevent_user_rating_update();
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER user_ratings_are_immutable ON user_ratings;
    DROP TRIGGER user_ratings_require_completed_exchange ON user_ratings;
    DROP FUNCTION refind_prevent_user_rating_update();
    DROP FUNCTION refind_validate_user_rating();
    DROP INDEX user_ratings_rated_created_idx;
    DROP INDEX object_exchanges_receiver_created_idx;
    DROP INDEX object_exchanges_giver_created_idx;

    ALTER TABLE user_ratings
      DROP CONSTRAINT user_ratings_exchange_comment_valid,
      DROP COLUMN created_at,
      DROP COLUMN comment,
      DROP COLUMN exchange_id;

    ALTER TABLE object_exchanges
      DROP CONSTRAINT object_exchanges_completed_confirmations_valid,
      DROP CONSTRAINT object_exchanges_completed_at_valid,
      DROP CONSTRAINT object_exchanges_status_valid,
      DROP COLUMN created_at,
      DROP COLUMN receiver_confirmed_at,
      DROP COLUMN giver_confirmed_at,
      DROP COLUMN status;
  `);
};