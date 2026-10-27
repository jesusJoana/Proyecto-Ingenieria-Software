/**
 * Migración 010: tokens de recuperación de contraseña (requisito 4).
 *
 * Cada fila es un enlace de "¿Has olvidado tu contraseña?":
 *   token_hash -> SHA-256 del token del enlace. El token en claro solo viaja en
 *                 el correo; si alguien leyera esta tabla, no podría usarlo.
 *   expires_at -> el enlace vale 1 hora.
 *   used_at    -> NULL mientras no se ha usado. Un enlace solo vale una vez.
 * Al borrar un usuario se borran sus tokens (ON DELETE CASCADE).
 */

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE password_reset_tokens (
      id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      token_hash text   NOT NULL,
      expires_at timestamptz NOT NULL,
      used_at    timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),

      CONSTRAINT password_reset_tokens_hash_unique UNIQUE (token_hash),
      CONSTRAINT password_reset_tokens_hash_format CHECK (token_hash ~ '^[a-f0-9]{64}$'),
      CONSTRAINT password_reset_tokens_expiry_valid CHECK (expires_at > created_at),
      CONSTRAINT password_reset_tokens_used_valid CHECK (used_at IS NULL OR used_at >= created_at)
    );

    -- Para invalidar rápido los enlaces pendientes de un usuario.
    CREATE INDEX password_reset_tokens_user_pending_idx
      ON password_reset_tokens (user_id)
      WHERE used_at IS NULL;
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE password_reset_tokens;');
};
