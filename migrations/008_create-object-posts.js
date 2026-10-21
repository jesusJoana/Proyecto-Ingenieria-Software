/** Publicaciones de objetos perdidos y encontrados. */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE object_posts (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      author_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      kind text NOT NULL,
      title text NOT NULL,
      description text NOT NULL,
      category text NOT NULL,
      color text,
      brand text,
      location text NOT NULL,
      event_date date NOT NULL,
      photo_filename text,
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT object_posts_kind_valid CHECK (kind IN ('lost', 'found')),
      CONSTRAINT object_posts_category_valid CHECK (
        category IN (
          'electronics', 'documents', 'keys', 'clothing',
          'accessories', 'pets', 'other'
        )
      ),
      CONSTRAINT object_posts_status_valid CHECK (
        status IN ('active', 'reserved', 'resolved')
      ),
      CONSTRAINT object_posts_title_valid CHECK (
        char_length(btrim(title)) BETWEEN 3 AND 100
      ),
      CONSTRAINT object_posts_description_valid CHECK (
        char_length(btrim(description)) BETWEEN 10 AND 2000
      ),
      CONSTRAINT object_posts_location_valid CHECK (
        char_length(btrim(location)) BETWEEN 2 AND 150
      ),
      CONSTRAINT object_posts_color_valid CHECK (
        color IS NULL OR char_length(btrim(color)) BETWEEN 1 AND 40
      ),
      CONSTRAINT object_posts_brand_valid CHECK (
        brand IS NULL OR char_length(btrim(brand)) BETWEEN 1 AND 60
      ),
      CONSTRAINT object_posts_photo_filename_valid CHECK (
        photo_filename IS NULL
        OR photo_filename ~ '^[0-9a-f-]{36}\\.webp$'
      ),
      CONSTRAINT object_posts_event_date_valid CHECK (event_date >= DATE '2000-01-01')
    );

    CREATE INDEX object_posts_recent_idx
      ON object_posts (created_at DESC, id DESC);
    CREATE INDEX object_posts_author_created_idx
      ON object_posts (author_id, created_at DESC);
    CREATE INDEX object_posts_filters_idx
      ON object_posts (status, kind, category);
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE object_posts;');
};
