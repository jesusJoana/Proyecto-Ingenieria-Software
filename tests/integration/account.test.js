/** Cambio de contraseña real con Express, Argon2 y refind_test. Solo borra sus propios usuarios. */
import { afterAll, describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
const { app, pool, close } = createApp(readConfig('test'));
const emails = [];
const tokens = [];
const oldPassword = 'Contraseña actual 1';
const newPassword = 'Una frase nueva 42';

/** Crea un usuario en refind_test e inicia su sesión. Devuelve el agente, su id y el token CSRF. */
async function loggedInUser() {
  const email = `account-${randomUUID()}@example.test`;
  emails.push(email);
  const hash = await argon2.hash(oldPassword, { type: argon2.argon2id });
  const {
    rows: [user],
  } = await pool.query(
    `INSERT INTO users (username, first_name, last_name, email, password_hash)
     VALUES ($3, 'Ana', 'García', $1, $2) RETURNING id`,
    [email, hash, `cuenta-${randomUUID().slice(0, 8)}`],
  );
  const agent = request.agent(app);
  const loginCsrf = (await agent.get('/iniciar-sesion')).text.match(
    /name="_csrf" value="([a-f0-9]+)"/,
  )[1];
  tokens.push(loginCsrf);
  await agent
    .post('/iniciar-sesion')
    .type('form')
    .send({ email, password: oldPassword, _csrf: loginCsrf })
    .expect(303);
  const page = await agent.get('/cambiar-contrasena').expect(200);
  const csrf = page.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
  tokens.push(csrf);
  return { agent, id: String(user.id), email, csrf };
}
async function storedHash(id) {
  const { rows } = await pool.query(
    'SELECT password_hash, updated_at FROM users WHERE id = $1',
    [id],
  );
  return rows[0];
}
afterAll(async () => {
  await pool.query(
    "DELETE FROM session WHERE sess->>'userId' IN (SELECT id::text FROM users WHERE email = ANY($1::citext[]))",
    [emails],
  );
  await pool.query(
    "DELETE FROM session WHERE sess->>'csrfToken' = ANY($1::text[])",
    [tokens],
  );
  await pool.query('DELETE FROM users WHERE email = ANY($1::citext[])', [
    emails,
  ]);
  await close();
});

describe('Cambio de contraseña', () => {
  /** Para qué sirve: impedir el acceso a la página sin sesión iniciada.
   * Qué comprueba: GET y POST sin sesión no muestran ni procesan el formulario. */
  test('sin sesión redirige al acceso', async () => {
    await request(app)
      .get('/cambiar-contrasena')
      .expect(303)
      .expect('Location', '/iniciar-sesion');
    await request(app).post('/cambiar-contrasena').type('form').send({}).expect(403);
  });

  /** Para qué sirve: comprobar el cambio completo con una cuenta real.
   * Qué comprueba: guarda un hash Argon2id de la nueva contraseña, actualiza updated_at,
   * muestra la confirmación, mantiene la sesión y permite entrar solo con la nueva. */
  test('cambia la contraseña con la actual correcta', async () => {
    const { agent, id, email, csrf } = await loggedInUser();
    const before = await storedHash(id);

    await agent
      .post('/cambiar-contrasena')
      .type('form')
      .send({
        current_password: oldPassword,
        new_password: newPassword,
        confirm_password: newPassword,
        _csrf: csrf,
      })
      .expect(303)
      .expect('Location', '/cambiar-contrasena?cambio=ok');

    const after = await storedHash(id);
    expect(after.password_hash).toMatch(/^\$argon2id\$/);
    expect(after.password_hash).not.toBe(before.password_hash);
    expect(await argon2.verify(after.password_hash, newPassword)).toBe(true);
    expect(await argon2.verify(after.password_hash, oldPassword)).toBe(false);
    expect(after.updated_at.getTime()).toBeGreaterThanOrEqual(
      before.updated_at.getTime(),
    );

    const confirmation = await agent
      .get('/cambiar-contrasena?cambio=ok')
      .expect(200);
    expect(confirmation.text).toContain('Tu contraseña se ha cambiado');
    expect((await agent.get('/').expect(200)).text).toContain('Mi cuenta');

    // Un acceso nuevo funciona con la nueva contraseña y no con la antigua.
    const other = request.agent(app);
    const loginCsrf = (await other.get('/iniciar-sesion')).text.match(
      /name="_csrf" value="([a-f0-9]+)"/,
    )[1];
    tokens.push(loginCsrf);
    await other
      .post('/iniciar-sesion')
      .type('form')
      .send({ email, password: oldPassword, _csrf: loginCsrf })
      .expect(401);
    await other
      .post('/iniciar-sesion')
      .type('form')
      .send({ email, password: newPassword, _csrf: loginCsrf })
      .expect(303);
  });

  /** Para qué sirve: impedir el cambio sin conocer la contraseña actual.
   * Qué comprueba: responde 422 con el error en el campo y no modifica el hash. */
  test('rechaza una contraseña actual incorrecta', async () => {
    const { agent, id, csrf } = await loggedInUser();
    const before = await storedHash(id);
    const response = await agent
      .post('/cambiar-contrasena')
      .type('form')
      .send({
        current_password: 'No es la actual 99',
        new_password: newPassword,
        confirm_password: newPassword,
        _csrf: csrf,
      })
      .expect(422);
    expect(response.text).toContain('La contraseña actual no es correcta.');
    expect((await storedHash(id)).password_hash).toBe(before.password_hash);
  });

  /** Para qué sirve: aplicar las reglas del registro a la nueva contraseña.
   * Qué comprueba: una contraseña corta o una confirmación distinta responden 422
   * sin modificar el hash ni devolver las contraseñas en la página. */
  test.each([
    ['corta', { new_password: 'corta', confirm_password: 'corta' }],
    ['sin coincidir', { new_password: newPassword, confirm_password: 'Otra frase distinta 42' }],
  ])('rechaza una nueva contraseña %s', async (name, change) => {
    const { agent, id, csrf } = await loggedInUser();
    const before = await storedHash(id);
    const response = await agent
      .post('/cambiar-contrasena')
      .type('form')
      .send({ current_password: oldPassword, ...change, _csrf: csrf })
      .expect(422);
    expect(response.text).not.toContain(oldPassword);
    expect(response.text).not.toContain(change.new_password);
    expect((await storedHash(id)).password_hash).toBe(before.password_hash);
  });

  /** Para qué sirve: impedir que otra web envíe el formulario en nombre del usuario.
   * Qué comprueba: sin token CSRF válido responde 403 y no modifica el hash. */
  test('rechaza el envío sin token CSRF', async () => {
    const { agent, id } = await loggedInUser();
    const before = await storedHash(id);
    await agent
      .post('/cambiar-contrasena')
      .type('form')
      .send({
        current_password: oldPassword,
        new_password: newPassword,
        confirm_password: newPassword,
      })
      .expect(403);
    expect((await storedHash(id)).password_hash).toBe(before.password_hash);
  });
});
