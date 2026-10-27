/**
 * Recuperación de contraseña de principio a fin con Express, Argon2 y refind_test.
 * El correo se sustituye por uno falso que guarda los mensajes en memoria. Solo borra sus propios usuarios.
 */
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';

const sent = [];
const mailer = {
  appUrl: 'http://localhost:3002',
  async sendPasswordReset(message) {
    sent.push(message);
  },
};
const { app, pool, close } = createApp(readConfig('test'), { mailer });
const emails = [];
const oldPassword = 'Contraseña antigua 1';
const newPassword = 'Una frase nueva 42';
const csrfOf = (html) => html.match(/name="_csrf" value="([a-f0-9]+)"/)[1];

async function createUser() {
  const email = `reset-http-${randomUUID()}@example.test`;
  emails.push(email);
  const hash = await argon2.hash(oldPassword, { type: argon2.argon2id });
  await pool.query(
    `INSERT INTO users (username, first_name, last_name, email, password_hash)
     VALUES ($3, 'Ana', 'García', $1, $2)`,
    [email, hash, `reset-${randomUUID().slice(0, 8)}`],
  );
  return email;
}

/** Pide el enlace para un correo y devuelve la respuesta. */
async function requestLink(agent, email) {
  const csrf = csrfOf((await agent.get('/recuperar-contrasena').expect(200)).text);
  return agent.post('/recuperar-contrasena').type('form').send({ email, _csrf: csrf });
}

/** Pide el enlace para un usuario nuevo y devuelve su correo y la ruta del enlace. */
async function userWithLink() {
  const email = await createUser();
  await requestLink(request.agent(app), email).then((res) => expect(res.status).toBe(200));
  const { link } = sent.at(-1);
  return { email, path: new URL(link).pathname };
}

beforeEach(() => {
  sent.length = 0;
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
  await close();
});

describe('Solicitar el enlace', () => {
  /** Para qué sirve: que el usuario encuentre la recuperación desde el acceso.
   * Qué comprueba: la página de inicio de sesión enlaza a /recuperar-contrasena. */
  test('el acceso enlaza a «¿Has olvidado tu contraseña?»', async () => {
    const res = await request(app).get('/iniciar-sesion').expect(200);
    expect(res.text).toContain('href="/recuperar-contrasena"');
    expect(res.text).toContain('¿Has olvidado tu contraseña?');
  });

  /** Para qué sirve: pedir solo el correo, con protección CSRF.
   * Qué comprueba: el formulario tiene el campo de correo y el token CSRF. */
  test('muestra el formulario de correo', async () => {
    const res = await request(app).get('/recuperar-contrasena').expect(200);
    expect(res.text).toMatch(/name="email"/);
    expect(res.text).toMatch(/name="_csrf" value="[a-f0-9]{64}"/);
  });

  /** Para qué sirve: rechazar peticiones falsificadas desde otras webs.
   * Qué comprueba: sin token CSRF responde 403 y no envía nada. */
  test('sin CSRF responde 403', async () => {
    await request(app)
      .post('/recuperar-contrasena')
      .type('form')
      .send({ email: 'ana@example.test' })
      .expect(403);
    expect(sent).toHaveLength(0);
  });

  /** Para qué sirve: enviar el enlace a quien tiene cuenta.
   * Qué comprueba: envía un correo al usuario con un enlace basado en APP_URL y un token de 64 hex. */
  test('envía el enlace a un correo registrado', async () => {
    const email = await createUser();
    const res = await requestLink(request.agent(app), email.toUpperCase());
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: email, firstName: 'Ana' });
    expect(sent[0].link).toMatch(
      /^http:\/\/localhost:3002\/restablecer-contrasena\/[a-f0-9]{64}$/,
    );
  });

  /** Para qué sirve: no revelar qué correos están registrados (enumeración de usuarios).
   * Qué comprueba: un correo registrado y otro inexistente reciben la misma página; al inexistente no se envía nada. */
  test('responde igual exista o no el correo', async () => {
    const email = await createUser();
    const known = await requestLink(request.agent(app), email);
    const unknown = await requestLink(request.agent(app), `nadie-${randomUUID()}@example.test`);
    expect(sent).toHaveLength(1);
    const notice = 'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.';
    for (const res of [known, unknown]) {
      expect(res.status).toBe(200);
      expect(res.text).toContain(notice);
    }
    const strip = (html) => html.replace(/name="_csrf" value="[a-f0-9]+"/, '');
    expect(strip(known.text)).toBe(strip(unknown.text));
  });

  /** Para qué sirve: avisar de errores de formato sin consultar la base.
   * Qué comprueba: un correo mal escrito da 422, conserva lo escrito y no envía nada. */
  test('rechaza un correo con formato incorrecto', async () => {
    const res = await requestLink(request.agent(app), 'sin-arroba');
    expect(res.status).toBe(422);
    expect(res.text).toContain('Introduce un correo electrónico válido.');
    expect(res.text).toContain('value="sin-arroba"');
    expect(sent).toHaveLength(0);
  });
});

describe('Abrir el enlace', () => {
  /** Para qué sirve: dejar elegir la nueva contraseña con un enlace válido, sin filtrar el token.
   * Qué comprueba: muestra el formulario, no se guarda en caché y no envía el enlace como Referer. */
  test('un enlace válido muestra el formulario', async () => {
    const { path } = await userWithLink();
    const res = await request(app).get(path).expect(200);
    expect(res.text).toMatch(/name="password"/);
    expect(res.text).toMatch(/name="confirm_password"/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  /** Para qué sirve: explicar qué hacer si el enlace no sirve.
   * Qué comprueba: un token con formato incorrecto o inexistente da 400 y ofrece pedir otro. */
  test.each([['/restablecer-contrasena/no-es-un-token'], [`/restablecer-contrasena/${'f'.repeat(64)}`]])(
    '%s muestra un error y ofrece un enlace nuevo',
    async (path) => {
      const res = await request(app).get(path).expect(400);
      expect(res.text).toContain('El enlace no es válido o ha caducado');
      expect(res.text).toContain('href="/recuperar-contrasena"');
      expect(res.text).not.toMatch(/name="password"/);
    },
  );
});

describe('Restablecer la contraseña', () => {
  /** Para qué sirve: aplicar las reglas de contraseña del registro.
   * Qué comprueba: una confirmación distinta da 422, mantiene el formulario y el enlace sigue sirviendo. */
  test('valida la nueva contraseña', async () => {
    const { path } = await userWithLink();
    const agent = request.agent(app);
    const csrf = csrfOf((await agent.get(path)).text);
    const res = await agent
      .post(path)
      .type('form')
      .send({ password: newPassword, confirm_password: 'Otra frase 42 distinta', _csrf: csrf });
    expect(res.status).toBe(422);
    expect(res.text).toContain('Las contraseñas no coinciden.');
    await agent.get(path).expect(200);
  });

  /** Para qué sirve: completar el ciclo y volver al acceso.
   * Qué comprueba: redirige al acceso con aviso, la nueva contraseña entra, la antigua no, y el enlace ya no sirve. */
  test('cambia la contraseña y permite entrar con la nueva', async () => {
    const { email, path } = await userWithLink();
    const agent = request.agent(app);
    const csrf = csrfOf((await agent.get(path)).text);
    const res = await agent
      .post(path)
      .type('form')
      .send({ password: newPassword, confirm_password: newPassword, _csrf: csrf })
      .expect(303);
    expect(res.headers.location).toBe('/iniciar-sesion?restablecida=ok');
    const login = await agent.get(res.headers.location).expect(200);
    expect(login.text).toContain('Tu contraseña se ha restablecido. Ya puedes iniciar sesión.');

    const loginCsrf = csrfOf(login.text);
    await agent
      .post('/iniciar-sesion')
      .type('form')
      .send({ email, password: oldPassword, _csrf: loginCsrf })
      .expect(401);
    await agent
      .post('/iniciar-sesion')
      .type('form')
      .send({ email, password: newPassword, _csrf: loginCsrf })
      .expect(303);
    await request(app).get(path).expect(400);
  });

  /** Para qué sirve: impedir reutilizar un enlace o enviar el formulario sin CSRF.
   * Qué comprueba: sin CSRF responde 403; tras usarlo, un segundo envío da 400 y no cambia la contraseña. */
  test('no se puede reutilizar el enlace', async () => {
    const { email, path } = await userWithLink();
    const agent = request.agent(app);
    const csrf = csrfOf((await agent.get(path)).text);
    const body = { password: newPassword, confirm_password: newPassword };
    await agent.post(path).type('form').send(body).expect(403);
    await agent.post(path).type('form').send({ ...body, _csrf: csrf }).expect(303);
    const again = await agent
      .post(path)
      .type('form')
      .send({ password: 'Otra frase 42 distinta', confirm_password: 'Otra frase 42 distinta', _csrf: csrf })
      .expect(400);
    expect(again.text).toContain('El enlace no es válido o ha caducado');
    const {
      rows: [user],
    } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
    expect(await argon2.verify(user.password_hash, newPassword)).toBe(true);
  });
});
