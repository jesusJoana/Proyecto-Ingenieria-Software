/**
 * Pruebas unitarias de las funciones de sesión y autorización.
 * req, res y los callbacks se simulan: no hay HTTP, usuarios reales ni PostgreSQL.
 * Complementan la integración comprobando errores y el orden de las operaciones.
 * Ejecutar: npm run test:unit
 */
import { describe, expect, test, vi } from 'vitest';
import {
  startSession,
  endSession,
  requireAuth,
  SESSION_COOKIE_NAME,
} from '../../src/session.js';

describe('Inicio de sesión', () => {
  /**
   * Para qué sirve: conservar la identidad en la sesión nueva, no en la anterior.
   * Qué comprueba: regenera primero, guarda el identificador como texto y espera al guardado.
   */
  test('guarda el usuario en la sesión regenerada y espera a que termine', async () => {
    let finishSaving;
    const newSession = {
      save: vi.fn((callback) => {
        finishSaving = callback;
      }),
    };
    const oldSession = {
      userId: 'anterior',
      regenerate: vi.fn((callback) => {
        req.session = newSession;
        callback();
      }),
    };
    const req = { session: oldSession };
    let completed = false;
    const result = startSession(req, 42).then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(oldSession.regenerate).toHaveBeenCalledTimes(1);
    expect(oldSession.userId).toBe('anterior');
    expect(newSession.userId).toBe('42');
    expect(newSession.save).toHaveBeenCalledTimes(1);
    expect(completed).toBe(false);
    finishSaving();
    await result;
    expect(completed).toBe(true);
  });

  /**
   * Para qué sirve: no continuar el inicio si falla la regeneración de la sesión.
   * Qué comprueba: rechaza con el error original, no cambia el usuario ni intenta guardar.
   */
  test('propaga el fallo al regenerar sin guardar la sesión', async () => {
    const error = new Error('Fallo simulado al regenerar');
    const req = {
      session: {
        userId: 'anterior',
        regenerate: vi.fn((callback) => callback(error)),
        save: vi.fn(),
      },
    };
    await expect(startSession(req, 42)).rejects.toBe(error);
    expect(req.session.userId).toBe('anterior');
    expect(req.session.save).not.toHaveBeenCalled();
  });

  /**
   * Para qué sirve: evitar informar de un inicio correcto si no se ha guardado la sesión.
   * Qué comprueba: un fallo del callback save rechaza la promesa con el mismo error.
   */
  test('propaga el fallo al guardar', async () => {
    const error = new Error('Fallo simulado al guardar');
    const req = {
      session: {
        regenerate: (callback) => callback(),
        save: (callback) => callback(error),
      },
    };
    await expect(startSession(req, 42)).rejects.toBe(error);
  });
});

describe('Cierre de sesión', () => {
  /**
   * Para qué sirve: borrar la cookie solo después de confirmar la destrucción de la sesión.
   * Qué comprueba: espera al callback y después borra refind.sid con el ámbito previsto.
   */
  test('espera a destruir la sesión antes de borrar la cookie', async () => {
    let finishDestroying;
    const req = {
      session: {
        destroy: vi.fn((callback) => {
          finishDestroying = callback;
        }),
      },
    };
    const res = { clearCookie: vi.fn() };
    let completed = false;
    const result = endSession(req, res).then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(req.session.destroy).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(completed).toBe(false);
    finishDestroying();
    await result;
    expect(res.clearCookie).toHaveBeenCalledExactlyOnceWith(
      SESSION_COOKIE_NAME,
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      },
    );
    expect(completed).toBe(true);
  });

  /**
   * Para qué sirve: no dar por completado el cierre si falla la destrucción de la sesión.
   * Qué comprueba: propaga el error original y no envía la orden de borrar la cookie.
   */
  test('propaga el fallo al destruir sin borrar la cookie', async () => {
    const error = new Error('Fallo simulado al destruir');
    const req = { session: { destroy: (callback) => callback(error) } };
    const res = { clearCookie: vi.fn() };
    await expect(endSession(req, res)).rejects.toBe(error);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});

describe('Protección de rutas', () => {
  /**
   * Para qué sirve: permitir continuar a una petición que ya tiene identidad en la sesión.
   * Qué comprueba: llama una vez a next y no genera una respuesta de rechazo.
   */
  test('deja continuar si la sesión contiene un usuario', () => {
    const req = { session: { userId: '42' } };
    const res = { status: vi.fn(), render: vi.fn() };
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.render).not.toHaveBeenCalled();
  });

  /**
   * Para qué sirve: rechazar peticiones sin identidad, incluso si no existe req.session.
   * Qué comprueba: devuelve 401 y la vista de acceso restringido sin llamar a next.
   */
  test.each([undefined, {}, { userId: null }, { userId: '' }])(
    'rechaza la sesión sin usuario (%j)',
    (session) => {
      const res = { status: vi.fn().mockReturnThis(), render: vi.fn() };
      const next = vi.fn();
      requireAuth({ session }, res, next);
      expect(res.status).toHaveBeenCalledExactlyOnceWith(401);
      expect(res.render).toHaveBeenCalledExactlyOnceWith('error', {
        title: 'Acceso restringido',
        message: 'Debes iniciar sesión para acceder a esta página.',
      });
      expect(next).not.toHaveBeenCalled();
    },
  );
});
