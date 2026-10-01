/** Protección de formularios aislada: sesiones, respuestas y reloj simulados. */
import { expect, test, vi } from 'vitest';
import {
  csrfToken,
  verifyCsrf,
  createAuthLimiter,
} from '../../src/auth/security.js';
const response = () => ({
  status: vi.fn().mockReturnThis(),
  render: vi.fn(),
  set: vi.fn(),
});

/** Para qué sirve: vincular el formulario a una sesión concreta.
 * Qué comprueba: token aleatorio de 64 caracteres, estable por sesión y distinto entre sesiones. */
test('genera y reutiliza el token de cada sesión', () => {
  const req = { session: {} };
  const token = csrfToken(req);
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(csrfToken(req)).toBe(token);
  expect(csrfToken({ session: {} })).not.toBe(token);
});

/** Para qué sirve: permitir únicamente formularios con el token de su sesión.
 * Qué comprueba: el token válido llama a next sin generar un rechazo. */
test('acepta el token correcto', () => {
  const req = { session: {} };
  req.body = { _csrf: csrfToken(req) };
  const res = response();
  const next = vi.fn();
  verifyCsrf(req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(res.status).not.toHaveBeenCalled();
});

/** Para qué sirve: rechazar tokens ausentes, múltiples o pertenecientes a otro formulario.
 * Qué comprueba: cada entrada inválida obtiene 403 y nunca continúa al controlador. */
test.each([undefined, '', 'falso', 'a'.repeat(64), ['a', 'b']])(
  'rechaza el token inválido (%j)',
  (token) => {
    const res = response();
    const next = vi.fn();
    verifyCsrf(
      { session: { csrfToken: 'b'.repeat(64) }, body: { _csrf: token } },
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  },
);

/** Para qué sirve: limitar envíos repetidos sin bloquear indefinidamente.
 * Qué comprueba: bloquea al superar el límite, informa de la espera y permite tras caducar. */
test('limita intentos por IP y restablece el contador tras la ventana', () => {
  let time = 0;
  const limit = createAuthLimiter({
    limit: 2,
    windowMs: 1000,
    now: () => time,
  });
  const next = vi.fn();
  const res = response();
  limit({ ip: '127.0.0.1' }, res, next);
  limit({ ip: '127.0.0.1' }, res, next);
  limit({ ip: '127.0.0.1' }, res, next);
  expect(next).toHaveBeenCalledTimes(2);
  expect(res.status).toHaveBeenCalledWith(429);
  expect(res.set).toHaveBeenCalledWith('Retry-After', '1');
  limit({ ip: '127.0.0.2' }, res, next);
  expect(next).toHaveBeenCalledTimes(3);
  time = 1001;
  limit({ ip: '127.0.0.1' }, res, next);
  expect(next).toHaveBeenCalledTimes(4);
});
