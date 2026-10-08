/** Valoración inicial de usuario de uno a cinco estrellas. */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE user_ratings (
      reviewer_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      rated_user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      stars smallint NOT NULL,
      CONSTRAINT user_ratings_pkey PRIMARY KEY (reviewer_id, rated_user_id),
      CONSTRAINT user_ratings_check CHECK (reviewer_id <> rated_user_id),
      CONSTRAINT user_ratings_stars_check CHECK (stars BETWEEN 1 AND 5)
    );
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE user_ratings;');
};