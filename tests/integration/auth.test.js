/** Registro y acceso reales con Express, Argon2 y refind_test. Solo borra sus propios usuarios. */
import { afterAll, describe, expect, test, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';
const { app, pool, close } = createApp(readConfig('test'));
const emails = [];
const users = [];
const tokens = [];
const payload = () => {
  const email = `auth-${randomUUID()}@example.test`;
  emails.push(email);
  return {
    first_name: 'Ana',
    last_name: 'García',
    email,
    organization: 'Universidad',
    password: 'Una frase segura 42',
    confirm_password: 'Una frase segura 42',
  };
};
async function token(agent, path) {
  const response = await agent.get(path).expect(200);
  const match = response.text.match(/name="_csrf" value="([a-f0-9]+)"/);
  expect(match).not.toBeNull();
  tokens.push(match[1]);
  return match[1];
}
afterAll(async () => {
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE email = ANY($1::citext[])',
    [emails],
  );
  users.push(...rows.map((row) => String(row.id)));
  await pool.query(
    "DELETE FROM session WHERE sess->>'userId' = ANY($1::text[])",
    [users],
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

describe('Formularios reales', () => {
  /** Para qué sirve: guardar una cuenta según la tabla users.
   * Qué comprueba: registro válido, valores persistidos, hash Argon2id verificable y redirección. */
  test('registra una cuenta con hash y sin iniciar sesión automáticamente', async () => {
    const agent = request.agent(app);
    const data = payload();
    const csrf = await token(agent, '/registro');
    await agent
      .post('/registro')
      .type('form')
      .send({ ...data, _csrf: csrf })
      .expect(303)
      .expect('Location', '/iniciar-sesion?registro=ok');
    const {
      rows: [user],
    } = await pool.query('SELECT * FROM users WHERE email=$1', [data.email]);
    expect(user.first_name).toBe('Ana');
    expect(user.last_name).toBe('García');
    expect(user.organization).toBe('Universidad');
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(user.password_hash, data.password)).toBe(true);
    expect((await agent.get('/')).text).not.toContain('Cerrar sesión');
  });

  /** Para qué sirve: evitar cuentas duplicadas sin distinguir mayúsculas.
   * Qué comprueba: devuelve 409 y mantiene una única fila tras el segundo intento. */
  test('rechaza un correo ya registrado', async () => {
    const agent = request.agent(app);
    const data = payload();
    const csrf = await token(agent, '/registro');
    await agent
      .post('/registro')
      .type('form')
      .send({ ...data, _csrf: csrf })
      .expect(303);
    const response = await agent
      .post('/registro')
      .type('form')
      .send({ ...data, email: data.email.toUpperCase(), _csrf: csrf })
      .expect(409);
    expect(response.text).toContain('Ya existe una cuenta con este correo');
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS total FROM users WHERE email=$1',
          [data.email],
        )
      ).rows[0].total,
    ).toBe(1);
    expect(response.text).not.toContain(data.password);
  });

  /** Para qué sirve: validar en servidor sin devolver contraseñas al formulario.
   * Qué comprueba: un nombre vacío devuelve 422, no crea cuenta y no refleja la contraseña. */
  test('rechaza datos inválidos sin guardar ni exponer la contraseña', async () => {
    const agent = request.agent(app);
    const data = payload();
    const csrf = await token(agent, '/registro');
    const response = await agent
      .post('/registro')
      .type('form')
      .send({ ...data, first_name: ' ', _csrf: csrf })
      .expect(422);
    expect(response.text).not.toContain(data.password);
    expect(
      (await pool.query('SELECT id FROM users WHERE email=$1', [data.email]))
        .rows,
    ).toHaveLength(0);
  });

  /** Para qué sirve: impedir envíos sin autorización del formulario de esta sesión.
   * Qué comprueba: registro, acceso y salida rechazan un token CSRF ausente o inventado. */
  test.each(['/registro', '/iniciar-sesion', '/cerrar-sesion'])(
    'rechaza POST sin token válido a %s',
    async (path) => {
      await request(app)
        .post(path)
        .type('form')
        .send({ _csrf: 'falso' })
        .expect(403);
      await request(app).post(path).type('form').send({}).expect(403);
    },
  );

  /** Para qué sirve: comprobar el ciclo completo con una cuenta real.
   * Qué comprueba: rechaza contraseña errónea; la correcta crea sesión, regenera cookie,
   * persiste el usuario, evita volver al registro y cierra la sesión con redirección al acceso. */
  test('inicia y cierra sesión con credenciales reales', async () => {
    const agent = request.agent(app);
    const data = payload();
    const csrf = await token(agent, '/registro');
    await agent
      .post('/registro')
      .type('form')
      .send({ ...data, _csrf: csrf })
      .expect(303);
    const loginPage = await agent.get('/iniciar-sesion');
    const loginCsrf = loginPage.text.match(
      /name="_csrf" value="([a-f0-9]+)"/,
    )[1];
    const invalid = await agent
      .post('/iniciar-sesion')
      .type('form')
      .send({ email: data.email, password: 'incorrecta', _csrf: loginCsrf })
      .expect(401);
    expect(invalid.text).toContain('Correo o contraseña incorrectos');
    const response = await agent
      .post('/iniciar-sesion')
      .type('form')
      .send({
        email: data.email.toUpperCase(),
        password: data.password,
        _csrf: loginCsrf,
      })
      .expect(303)
      .expect('Location', '/');
    expect(response.headers['set-cookie'].join(';')).toContain('HttpOnly');
    const {
      rows: [user],
    } = await pool.query('SELECT id FROM users WHERE email=$1', [data.email]);
    expect(
      (
        await pool.query("SELECT sid FROM session WHERE sess->>'userId'=$1", [
          String(user.id),
        ])
      ).rows,
    ).toHaveLength(1);
    const home = await agent.get('/').expect(200);
    expect(home.text).toContain('Cerrar sesión');
    await agent.get('/registro').expect(303).expect('Location', '/');
    const logoutToken = home.text.match(/name="_csrf" value="([a-f0-9]+)"/)[1];
    await agent
      .post('/cerrar-sesion')
      .type('form')
      .send({ _csrf: logoutToken })
      .expect(303)
      .expect('Location', '/iniciar-sesion');
    expect(
      (
        await pool.query("SELECT sid FROM session WHERE sess->>'userId'=$1", [
          String(user.id),
        ])
      ).rows,
    ).toHaveLength(0);
    expect((await agent.get('/')).text).not.toContain('Cerrar sesión');
  });

  /** Para qué sirve: no revelar si un correo existe al fallar el inicio.
   * Qué comprueba: una cuenta inexistente obtiene el mismo mensaje genérico y estado 401. */
  test('rechaza una cuenta inexistente con mensaje genérico', async () => {
    const agent = request.agent(app);
    const csrf = await token(agent, '/iniciar-sesion');
    const response = await agent
      .post('/iniciar-sesion')
      .type('form')
      .send({
        email: payload().email,
        password: 'Una frase segura 42',
        _csrf: csrf,
      })
      .expect(401);
    expect(response.text).toContain('Correo o contraseña incorrectos');
  });

  /** Para qué sirve: comprobar el registro sin organización y frente a solicitudes simultáneas.
   * Qué comprueba: dos sesiones intentan el mismo correo; solo una crea cuenta y la otra recibe 409. */
  test('resuelve registros concurrentes y admite organización vacía', async () => {
    const data = { ...payload(), organization: '' };
    const first = request.agent(app);
    const second = request.agent(app);
    const a = await token(first, '/registro');
    const b = await token(second, '/registro');
    const responses = await Promise.all([
      first
        .post('/registro')
        .type('form')
        .send({ ...data, _csrf: a }),
      second
        .post('/registro')
        .type('form')
        .send({ ...data, _csrf: b }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([303, 409]);
    const { rows } = await pool.query(
      'SELECT organization FROM users WHERE email=$1',
      [data.email],
    );
    expect(rows).toEqual([{ organization: null }]);
  });

  /** Para qué sirve: evitar ejecutar HTML aportado por el usuario al devolver un formulario.
   * Qué comprueba: escapa el nombre malicioso y no lo guarda cuando el resto es inválido. */
  test('escapa los datos reflejados en un error de validación', async () => {
    const agent = request.agent(app);
    const data = payload();
    const csrf = await token(agent, '/registro');
    const response = await agent
      .post('/registro')
      .type('form')
      .send({
        ...data,
        first_name: '<script>alert(1)</script>',
        email: 'no',
        _csrf: csrf,
      })
      .expect(422);
    expect(response.text).not.toContain('<script>alert(1)</script>');
    expect(response.text).toContain('&lt;script&gt;');
  });

  /** Para qué sirve: impedir que una visita GET cierre una sesión y que tokens ajenos autoricen POST.
   * Qué comprueba: GET /cerrar-sesion devuelve 404 y el token de otra sesión obtiene 403. */
  test('rechaza el cierre por GET y el token de otro visitante', async () => {
    await request(app).get('/cerrar-sesion').expect(404);
    const first = request.agent(app);
    const second = request.agent(app);
    const csrf = await token(first, '/registro');
    await token(second, '/registro');
    await second
      .post('/registro')
      .type('form')
      .send({ ...payload(), _csrf: csrf })
      .expect(403);
  });

  /** Para qué sirve: devolver errores de acceso incompleto desde el servidor.
   * Qué comprueba: campos vacíos producen 422 y no se presenta una sesión iniciada. */
  test('rechaza credenciales vacías en el servidor', async () => {
    const agent = request.agent(app);
    const csrf = await token(agent, '/iniciar-sesion');
    await agent
      .post('/iniciar-sesion')
      .type('form')
      .send({ email: '', password: '', _csrf: csrf })
      .expect(422);
    expect((await agent.get('/')).text).not.toContain('Cerrar sesión');
  });

  /** Para qué sirve: no filtrar datos internos cuando falla PostgreSQL al registrar.
   * Qué comprueba: un fallo simulado produce 500 genérico, sin contraseña ni mensaje interno. */
  test('maneja un fallo de almacenamiento sin exponer sus detalles', async () => {
    const agent = request.agent(app);
    const data = payload();
    const csrf = await token(agent, '/registro');
    const query = vi
      .spyOn(pool, 'query')
      .mockRejectedValueOnce(new Error('detalle-interno-ficticio'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await agent
        .post('/registro')
        .type('form')
        .send({ ...data, _csrf: csrf })
        .expect(500);
      expect(response.text).toContain('Error inesperado');
      expect(response.text).not.toContain('detalle-interno-ficticio');
      expect(response.text).not.toContain(data.password);
    } finally {
      query.mockRestore();
      log.mockRestore();
    }
  });
});
