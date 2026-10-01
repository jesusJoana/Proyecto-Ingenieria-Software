/**
 * Migración 001: tabla de usuarios.
 *
 * Crea la tabla "users" con las reglas acordadas en la documentación de la
 * base de datos: correo único sin distinguir mayúsculas, nombre y apellidos
 * no vacíos y contraseña guardada siempre como hash Argon2id.
 */

// Se ejecuta al aplicar la migración (npm run db:migrate).
export const up = (pgm) => {
  pgm.sql(String.raw`
    CREATE EXTENSION IF NOT EXISTS citext;

    CREATE TABLE users (
      id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      first_name    text   NOT NULL,
      last_name     text   NOT NULL,
      email         citext NOT NULL,
      password_hash text   NOT NULL,
      organization  text,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now(),

      CONSTRAINT users_email_unique       UNIQUE (email),
      CONSTRAINT users_email_format       CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(email) <= 254),
      CONSTRAINT users_first_name_valid   CHECK (btrim(first_name) <> '' AND char_length(first_name) <= 100),
      CONSTRAINT users_last_name_valid    CHECK (btrim(last_name) <> '' AND char_length(last_name) <= 150),
      CONSTRAINT users_password_is_argon2 CHECK (password_hash LIKE '$argon2id$%')
    );
  `);
};

// Deshace la migración. No se usa en el trabajo normal.
export const down = (pgm) => {
  pgm.sql('DROP TABLE users;');
};
