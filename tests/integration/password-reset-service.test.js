/** Servicio de recuperación de contraseña con PostgreSQL real (refind_test). Solo borra sus propios usuarios. */
import { afterAll, describe, expect, test } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import pg from 'pg';
import { readConfig } from '../../src/config.js';
import { createPasswordResetService } from '../../src/auth/password-reset.js';

const pool = new pg.Pool({ connectionString: readConfig('test').DATABASE_URL });
const service = createPasswordResetService(pool);
const emails = [];
const oldPassword = 'Contraseña antigua 1';
const newPassword = 'Una frase nueva 42';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** Crea un usuario de prueba en refind_test y devuelve su id y su correo. */
async function createUser() {
  const email = `reset-${randomUUID()}@example.test`;
  emails.push(email);
  const hash = await argon2.hash(oldPassword, { type: argon2.argon2id });
  const {
    rows: [user],
  } = await pool.query(
    `INSERT INTO users (username, first_name, last_name, email, password_hash)
     VALUES ($3, 'Ana', 'García', $1, $2) RETURNING id`,
    [email, hash, `reset-${randomUUID().slice(0, 8)}`],
  );
  return { id: String(user.id), email };
}

const tokenRows = (userId) =>
  pool
    .query('SELECT * FROM password_reset_tokens WHERE user_id = $1 ORDER BY id', [userId])
    .then((result) => result.rows);

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
  await pool.end();
});

describe('Solicitud de recuperación', () => {
  /** Para qué sirve: generar el enlace sin guardar nunca el token en claro.
   * Qué comprueba: devuelve un token de 64 hex y el nombre; en la base solo está su SHA-256,
   * sin usar y con caducidad de 1 hora. */
  test('crea un token para un correo registrado', async () => {
    const user = await createUser();
    const result = await service.requestReset(user.email.toUpperCase());
    expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    expect(result).toMatchObject({ email: user.email, first_name: 'Ana' });
    const [row] = await tokenRows(user.id);
    expect(row.token_hash).toBe(sha256(result.token));
    expect(row.token_hash).not.toBe(result.token);
    expect(row.used_at).toBeNull();
    const minutes = (row.expires_at - row.created_at) / 60000;
    expect(minutes).toBeCloseTo(60, 5);
  });

  /** Para qué sirve: no revelar qué correos existen ni crear datos para ellos.
   * Qué comprueba: devuelve null y no inserta ninguna fila. */
  test('no hace nada con un correo no registrado', async () => {
    const before = await pool.query('SELECT count(*)::int AS n FROM password_reset_tokens');
    expect(await service.requestReset(`nadie-${randomUUID()}@example.test`)).toBeNull();
    const after = await pool.query('SELECT count(*)::int AS n FROM password_reset_tokens');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});

describe('Comprobación del enlace', () => {
  /** Para qué sirve: mostrar el formulario solo si el enlace sirve.
   * Qué comprueba: un token vigente es válido; uno inventado no. */
  test('distingue un token vigente de uno inventado', async () => {
    const user = await createUser();
    const { token } = await service.requestReset(user.email);
    expect(await service.isUsable(token)).toBe(true);
    expect(await service.isUsable('f'.repeat(64))).toBe(false);
  });

  /** Para qué sirve: que el enlace caduque a la hora.
   * Qué comprueba: un token con la caducidad pasada no es válido ni restablece la contraseña. */
  test('rechaza un token caducado', async () => {
    const user = await createUser();
    const { token } = await service.requestReset(user.email);
    await pool.query(
      `UPDATE password_reset_tokens
       SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour'
       WHERE user_id = $1`,
      [user.id],
    );
    expect(await service.isUsable(token)).toBe(false);
    expect(await service.resetPassword(token, newPassword)).toBe(false);
  });
});

describe('Restablecimiento', () => {
  /** Para qué sirve: cambiar la contraseña con un enlace válido.
   * Qué comprueba: guarda un hash Argon2id de la nueva, actualiza updated_at y marca el token como usado. */
  test('cambia la contraseña y marca el token como usado', async () => {
    const user = await createUser();
    const { token } = await service.requestReset(user.email);
    const {
      rows: [before],
    } = await pool.query('SELECT updated_at FROM users WHERE id = $1', [user.id]);
    expect(await service.resetPassword(token, newPassword)).toBe(true);
    const {
      rows: [after],
    } = await pool.query('SELECT password_hash, updated_at FROM users WHERE id = $1', [user.id]);
    expect(after.password_hash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(after.password_hash, newPassword)).toBe(true);
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
    const [row] = await tokenRows(user.id);
    expect(row.used_at).not.toBeNull();
  });

  /** Para qué sirve: que un enlace solo valga una vez.
   * Qué comprueba: el segundo uso del mismo token falla y no cambia la contraseña. */
  test('no permite usar el mismo enlace dos veces', async () => {
    const user = await createUser();
    const { token } = await service.requestReset(user.email);
    expect(await service.resetPassword(token, newPassword)).toBe(true);
    expect(await service.resetPassword(token, 'Otra frase distinta 42')).toBe(false);
    const {
      rows: [row],
    } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    expect(await argon2.verify(row.password_hash, newPassword)).toBe(true);
  });

  /** Para qué sirve: evitar que dos peticiones simultáneas usen el mismo enlace.
   * Qué comprueba: de dos restablecimientos a la vez con el mismo token, solo uno tiene éxito. */
  test('con dos usos simultáneos solo uno tiene éxito', async () => {
    const user = await createUser();
    const { token } = await service.requestReset(user.email);
    const results = await Promise.all([
      service.resetPassword(token, newPassword),
      service.resetPassword(token, 'Otra frase distinta 42'),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  /** Para qué sirve: que, tras restablecer, no queden enlaces anteriores utilizables.
   * Qué comprueba: los demás tokens pendientes del usuario quedan marcados como usados. */
  test('invalida los demás enlaces pendientes del usuario', async () => {
    const user = await createUser();
    const first = await service.requestReset(user.email);
    const second = await service.requestReset(user.email);
    expect(await service.resetPassword(second.token, newPassword)).toBe(true);
    expect(await service.isUsable(first.token)).toBe(false);
    expect((await tokenRows(user.id)).every((row) => row.used_at !== null)).toBe(true);
  });

  /** Para qué sirve: echar a quien tuviera una sesión robada.
   * Qué comprueba: borra las sesiones guardadas de ese usuario y no las de otros. */
  test('cierra las sesiones abiertas del usuario', async () => {
    const user = await createUser();
    const other = await createUser();
    const sid = (id) => `reset-${id}-${randomUUID()}`;
    const mine = sid(user.id);
    const theirs = sid(other.id);
    await pool.query(
      `INSERT INTO session (sid, sess, expire) VALUES
         ($1, $2, now() + interval '1 hour'), ($3, $4, now() + interval '1 hour')`,
      [mine, JSON.stringify({ userId: user.id }), theirs, JSON.stringify({ userId: other.id })],
    );
    const { token } = await service.requestReset(user.email);
    expect(await service.resetPassword(token, newPassword)).toBe(true);
    const { rows } = await pool.query('SELECT sid FROM session WHERE sid = ANY($1)', [
      [mine, theirs],
    ]);
    expect(rows.map((row) => row.sid)).toEqual([theirs]);
    await pool.query('DELETE FROM session WHERE sid = $1', [theirs]);
  });

  /** Para qué sirve: no dejar tokens huérfanos.
   * Qué comprueba: al borrar el usuario se borran sus tokens (ON DELETE CASCADE). */
  test('borra los tokens al borrar el usuario', async () => {
    const user = await createUser();
    await service.requestReset(user.email);
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    expect(await tokenRows(user.id)).toEqual([]);
  });
});
