/**
 * Recuperación de contraseña (requisito 4): crear, comprobar y usar los enlaces.
 *
 * El token del enlace son 32 bytes aleatorios en hexadecimal. En la base solo
 * se guarda su SHA-256 (migración 010): basta un hash rápido porque el token
 * no se puede adivinar, y al dar siempre el mismo resultado permite buscarlo.
 */
import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { HASH_OPTIONS } from './service.js';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createPasswordResetService(pool) {
  return {
    /**
     * Si el correo está registrado, crea un enlace válido 1 hora y devuelve el
     * token en claro (para el correo) con el nombre y el correo del usuario.
     * Si no, devuelve null; la ruta muestra el mismo mensaje en los dos casos.
     */
    async requestReset(email) {
      const {
        rows: [user],
      } = await pool.query('SELECT id, first_name, email FROM users WHERE email = $1', [email]);
      if (!user) return null;
      const token = randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '1 hour')`,
        [user.id, hashToken(token)],
      );
      return { token, email: user.email, first_name: user.first_name };
    },

    /** true si el enlace existe, no se ha usado y no ha caducado. */
    async isUsable(token) {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM password_reset_tokens
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
        [hashToken(token)],
      );
      return rowCount === 1;
    },

    /**
     * Usa el enlace y guarda la nueva contraseña, todo en una transacción.
     * Devuelve false si el enlace no existe, ya se usó o ha caducado.
     */
    async resetPassword(token, newPassword) {
      // El hash de Argon2 es lento: se calcula antes de abrir la transacción.
      const passwordHash = await argon2.hash(newPassword, HASH_OPTIONS);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // 1. Marcar el token como usado solo si sigue siendo válido. Comprobar y
        //    marcar en la misma sentencia evita que dos peticiones a la vez lo usen:
        //    PostgreSQL bloquea la fila y la segunda ya no la encuentra.
        const {
          rows: [used],
        } = await client.query(
          `UPDATE password_reset_tokens SET used_at = now()
           WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
           RETURNING user_id`,
          [hashToken(token)],
        );
        if (!used) {
          await client.query('ROLLBACK');
          return false;
        }
        // 2. Guardar la nueva contraseña.
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
          [passwordHash, used.user_id],
        );
        // 3. Invalidar los demás enlaces pendientes de ese usuario.
        await client.query(
          `UPDATE password_reset_tokens SET used_at = now()
           WHERE user_id = $1 AND used_at IS NULL`,
          [used.user_id],
        );
        // 4. Cerrar sus sesiones abiertas, por si alguien se la había robado.
        await client.query("DELETE FROM session WHERE sess->>'userId' = $1", [
          String(used.user_id),
        ]);
        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
