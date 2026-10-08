/** Registro base de intercambios entre quien entrega y quien recibe un objeto. */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE object_exchanges (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      giver_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      receiver_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      object_description text NOT NULL,
      completed_at timestamptz,
      CONSTRAINT object_exchanges_check CHECK (giver_id <> receiver_id),
      CONSTRAINT object_exchanges_object_description_check CHECK (
        btrim(object_description) <> ''
      )
    );
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE object_exchanges;');
};