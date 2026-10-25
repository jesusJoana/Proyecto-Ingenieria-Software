/** Datos universitarios y punto confirmado por el autor; sin inventar ubicaciones antiguas. */
export const up = (pgm) =>
  pgm.sql(`
  ALTER TABLE object_posts
    ADD COLUMN university text,
    ADD COLUMN campus text,
    ADD COLUMN city text,
    ADD COLUMN country text,
    ADD COLUMN campus_address text,
    ADD COLUMN location_mode text,
    ADD COLUMN latitude double precision,
    ADD COLUMN longitude double precision,
    ADD COLUMN deposit_location text,
    ADD CONSTRAINT object_posts_coordinates_valid CHECK (
      (latitude IS NULL AND longitude IS NULL AND location_mode IS NULL) OR
      (latitude IS NOT NULL AND longitude IS NOT NULL AND location_mode IS NOT NULL
       AND latitude BETWEEN -85 AND 85 AND longitude BETWEEN -180 AND 180
       AND location_mode IN ('campus', 'exact'))
    ),
    ADD CONSTRAINT object_posts_university_valid CHECK (
      university IS NULL OR (
        char_length(btrim(university)) BETWEEN 2 AND 180
        AND campus IS NOT NULL AND char_length(btrim(campus)) BETWEEN 2 AND 180
        AND city IS NOT NULL AND char_length(btrim(city)) BETWEEN 2 AND 100
        AND country IS NOT NULL AND char_length(btrim(country)) BETWEEN 2 AND 100
        AND campus_address IS NOT NULL AND char_length(btrim(campus_address)) BETWEEN 2 AND 250
      )
    ),
    ADD CONSTRAINT object_posts_deposit_valid CHECK (
      deposit_location IS NULL OR (kind = 'found' AND char_length(btrim(deposit_location)) BETWEEN 2 AND 250)
    );
  CREATE INDEX object_posts_university_campus_idx ON object_posts (university, campus, status);
`);
export const down = (pgm) =>
  pgm.sql(`
  DROP INDEX object_posts_university_campus_idx;
  ALTER TABLE object_posts
    DROP CONSTRAINT object_posts_coordinates_valid,
    DROP CONSTRAINT object_posts_university_valid,
    DROP CONSTRAINT object_posts_deposit_valid,
    DROP COLUMN university, DROP COLUMN campus, DROP COLUMN city, DROP COLUMN country,
    DROP COLUMN campus_address, DROP COLUMN location_mode, DROP COLUMN latitude,
    DROP COLUMN longitude, DROP COLUMN deposit_location;
`);
