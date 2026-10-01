/**
 * Migración 002: tabla de sesiones.
 *
 * express-session guarda aquí, mediante connect-pg-simple, la sesión de cada
 * usuario conectado. La estructura la exige connect-pg-simple:
 *   sid    -> identificador de la sesión (el que viaja en la cookie)
 *   sess   -> datos de la sesión, por ejemplo el id del usuario
 *   expire -> cuándo caduca; el índice permite borrar rápido las caducadas
 */

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE session (
      sid    varchar NOT NULL PRIMARY KEY,
      sess   json NOT NULL,
      expire timestamp(6) NOT NULL
    );

    CREATE INDEX session_expire_idx ON session (expire);
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE session;');
};
