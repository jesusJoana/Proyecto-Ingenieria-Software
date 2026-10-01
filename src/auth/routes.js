/** Rutas de registro, inicio y cierre de sesión. Formularios HTML con respuestas accesibles. */
import { Router } from 'express';
import {
  registrationSchema,
  loginSchema,
  formValues,
  fieldErrors,
} from './validation.js';
import { createAuthService } from './service.js';
import { csrfToken, verifyCsrf, createAuthLimiter } from './security.js';
import { startSession, endSession } from '../session.js';

export function createAuthRouter(pool) {
  const router = Router();
  const service = createAuthService(pool);
  const limit = createAuthLimiter();
  const onlyGuest = (req, res, next) =>
    req.session.userId ? res.redirect(303, '/') : next();
  function render(req, res, mode, status = 200, errors = {}) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).render('auth', {
      title: mode === 'register' ? 'Crear una cuenta' : 'Iniciar sesión',
      mode,
      values: formValues(req.body),
      errors,
      csrf: csrfToken(req),
      registered: mode === 'login' && req.query.registro === 'ok',
    });
  }
  router.get('/registro', onlyGuest, (req, res) =>
    render(req, res, 'register'),
  );
  router.get('/iniciar-sesion', onlyGuest, (req, res) =>
    render(req, res, 'login'),
  );
  router.post('/registro', verifyCsrf, onlyGuest, limit, async (req, res) => {
    const result = registrationSchema.safeParse(req.body);
    if (!result.success)
      return render(req, res, 'register', 422, fieldErrors(result.error));
    try {
      await service.register(result.data);
      res.redirect(303, '/iniciar-sesion?registro=ok');
    } catch (error) {
      if (error.code === 'EMAIL_EXISTS')
        return render(req, res, 'register', 409, { email: error.message });
      throw error;
    }
  });
  router.post(
    '/iniciar-sesion',
    verifyCsrf,
    onlyGuest,
    limit,
    async (req, res) => {
      const result = loginSchema.safeParse(req.body);
      if (!result.success)
        return render(req, res, 'login', 422, fieldErrors(result.error));
      const user = await service.authenticate(result.data);
      if (!user)
        return render(req, res, 'login', 401, {
          form: 'Correo o contraseña incorrectos.',
        });
      await startSession(req, user.id);
      res.redirect(303, '/');
    },
  );
  router.post('/cerrar-sesion', verifyCsrf, async (req, res) => {
    await endSession(req, res);
    res.redirect(303, '/iniciar-sesion');
  });
  return router;
}
