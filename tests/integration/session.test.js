/**
 * Pruebas de la gestión de sesiones contra la base de datos refind_test.
 * Requiere haber ejecutado antes: npm.cmd run db:migrate:test
 *
 * Se monta un servidor mínimo con rutas de prueba que usan las funciones de
 * src/session.js, porque las rutas reales de inicio y cierre de sesión todavía
 * no existen.
 */
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import request from 'supertest';
import { readConfig } from '../../src/config.js';
import {
  SESSION_COOKIE_NAME,
  createSessionMiddleware,
  endSession,
  requireAuth,
  startSession,
} from '../../src/session.js';

const config = readConfig('test');
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const sessions = createSessionMiddleware({ secret: config.SESSION_SECRET, pool, pruneExpired: false });

const app = express();
app.set('view engine', 'ejs');
app.set('views', fileURLToPath(new URL('../../views', import.meta.url)));
app.use(sessions.middleware);
// Simula un visitante que ya tenía sesión antes de iniciar sesión.
app.get('/visitar', (req, res) => {
  req.session.visited = true;
  res.sendStatus(204);
});
// Simula el inicio de sesión del usuario 42 (las credenciales se comprobarán en la ruta real).
app.post('/entrar', async (req, res) => {
  await startSession(req, 42);
  res.sendStatus(204);
});
app.post('/salir', async (req, res) => {
  await endSession(req, res);
  res.sendStatus(204);
});
app.get('/privado', requireAuth, (req, res) => {
  res.json({ userId: req.session.userId });
});

// Extrae el valor "refind.sid=..." de las cabeceras de respuesta.
function sessionCookie(response) {
  return response.headers['set-cookie']?.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
}

// Cuenta las sesiones guardadas del usuario 42.
async function storedSessions() {
  const { rows } = await pool.query("SELECT count(*)::int AS total FROM session WHERE sess->>'userId' = '42'");
  return rows[0].total;
}

beforeEach(async () => {
  await pool.query('DELETE FROM session');
});

afterAll(async () => {
  await pool.query('DELETE FROM session');
  await sessions.store.close();
  await pool.end();
});

describe('Gestión de sesiones', () => {
  /**
   * Para qué sirve: Impedir el acceso a una ruta protegida sin sesión.
   * Qué comprueba: GET /privado, sin cookie de sesión, devuelve HTTP 401.
   */
  test('una ruta privada rechaza a quien no ha iniciado sesión', async () => {
    await request(app).get('/privado').expect(401);
  });

  /**
   * Para qué sirve: Comprobar la creación de una sesión mediante una ruta de prueba.
   * Qué comprueba: POST /entrar devuelve HTTP 204; la cookie incluye HttpOnly, SameSite=Lax,
   * Path=/ y Expires; PostgreSQL contiene una sesión del usuario 42. No valida credenciales ni
   * el atributo Secure.
   */
  test('al iniciar sesión se envía una cookie segura y la sesión se guarda en PostgreSQL', async () => {
    const response = await request(app).post('/entrar').expect(204);
    const cookie = sessionCookie(response);
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Expires=');
    expect(await storedSessions()).toBe(1);
  });

  /**
   * Para qué sirve: Comprobar que la sesión identifica al usuario entre peticiones.
   * Qué comprueba: Tras entrar, el cliente conserva la cookie y GET /privado devuelve HTTP 200
   * con userId igual a "42".
   */
  test('con la cookie, el servidor reconoce al usuario en las siguientes peticiones', async () => {
    const agent = request.agent(app);
    await agent.post('/entrar').expect(204);
    await agent.get('/privado').expect(200, { userId: '42' });
  });

  /**
   * Para qué sirve: Comprobar la renovación del identificador al iniciar sesión.
   * Qué comprueba: Crea una sesión de visitante y después inicia sesión; ambas respuestas
   * contienen cookie y sus identificadores son distintos.
   */
  test('al iniciar sesión cambia el identificador de la sesión anterior', async () => {
    const agent = request.agent(app);
    const before = sessionCookie(await agent.get('/visitar').expect(204));
    const after = sessionCookie(await agent.post('/entrar').expect(204));
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    expect(after.split(';')[0]).not.toBe(before.split(';')[0]);
  });

  /**
   * Para qué sirve: Comprobar que cerrar sesión retira el acceso y elimina su almacenamiento.
   * Qué comprueba: POST /salir devuelve HTTP 204, caduca la cookie y deja cero sesiones del
   * usuario 42 en PostgreSQL; el acceso posterior a /privado devuelve HTTP 401.
   */
  test('al cerrar sesión se borra de PostgreSQL y se elimina la cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/entrar').expect(204);
    expect(await storedSessions()).toBe(1);

    const response = await agent.post('/salir').expect(204);
    expect(sessionCookie(response)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await storedSessions()).toBe(0);
    await agent.get('/privado').expect(401);
  });

  /**
   * Para qué sirve: Comprobar que modificar la cookie no permite acceder a una ruta protegida.
   * Qué comprueba: Altera los últimos caracteres del valor de una cookie válida y exige HTTP
   * 401 al enviarla a /privado.
   */
  test('una cookie manipulada no da acceso', async () => {
    const response = await request(app).post('/entrar').expect(204);
    const [nameValue] = sessionCookie(response).split(';');
    const tampered = nameValue.slice(0, -2) + (nameValue.endsWith('AA') ? 'BB' : 'AA');
    await request(app).get('/privado').set('Cookie', tampered).expect(401);
  });
});
