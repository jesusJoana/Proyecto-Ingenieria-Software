/** Migración 003: datos públicos y editables del perfil de usuario. */
export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN username citext,
      ADD COLUMN age smallint,
      ADD COLUMN description text,
      ADD COLUMN locality text,
      ADD COLUMN avatar_filename text;

    UPDATE users
    SET username = 'usuario' || id;

    ALTER TABLE users
      ALTER COLUMN username SET NOT NULL,
      ADD CONSTRAINT users_username_unique UNIQUE (username),
      ADD CONSTRAINT users_username_valid CHECK (
        username::text ~ '^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$'
      ),
      ADD CONSTRAINT users_age_valid CHECK (age IS NULL OR age BETWEEN 13 AND 120),
      ADD CONSTRAINT users_description_valid CHECK (
        description IS NULL OR char_length(description) <= 500
      ),
      ADD CONSTRAINT users_locality_valid CHECK (
        locality IS NULL OR char_length(locality) <= 100
      ),
      ADD CONSTRAINT users_avatar_filename_valid CHECK (
        avatar_filename IS NULL OR avatar_filename ~ '^[a-f0-9-]{36}\\.webp$'
      );
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      DROP CONSTRAINT users_avatar_filename_valid,
      DROP CONSTRAINT users_locality_valid,
      DROP CONSTRAINT users_description_valid,
      DROP CONSTRAINT users_age_valid,
      DROP CONSTRAINT users_username_valid,
      DROP CONSTRAINT users_username_unique,
      DROP COLUMN avatar_filename,
      DROP COLUMN locality,
      DROP COLUMN description,
      DROP COLUMN age,
      DROP COLUMN username;
  `);
};
