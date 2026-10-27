/**
 * Rutas de recuperación de contraseña (requisito 4):
 *   GET/POST /recuperar-contrasena           -> pedir el enlace con el correo
 *   GET/POST /restablecer-contrasena/:token  -> elegir la nueva contraseña
 * Solo para quien no ha iniciado sesión (quien la tiene usa /cambiar-contrasena).
 */
import { Router } from 'express';
import { csrfToken, verifyCsrf, createAuthLimiter } from './security.js';
import {
  fieldErrors,
  isValidResetToken,
  passwordResetSchema,
  resetRequestSchema,
} from './validation.js';
import { createPasswordResetService } from './password-reset.js';

export function createPasswordResetRouter(pool, mailer) {
  const router = Router();
  const resets = createPasswordResetService(pool);
  const limit = createAuthLimiter();
  const onlyGuest = (req, res, next) =>
    req.session.userId ? res.redirect(303, '/') : next();

  function renderRequest(req, res, { status = 200, errors = {}, email = '', sent = false } = {}) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).render('password-forgot', {
      title: 'Recuperar contraseña',
      errors,
      email,
      sent,
      csrf: csrfToken(req),
    });
  }

  function renderReset(req, res, { status = 200, errors = {}, valid = true } = {}) {
    res.set('Cache-Control', 'no-store');
    // El token va en la dirección: que el navegador no lo envíe como Referer a otras webs.
    res.set('Referrer-Policy', 'no-referrer');
    return res.status(status).render('password-reset', {
      title: 'Elige una nueva contraseña',
      errors,
      valid,
      token: req.params.token,
      csrf: csrfToken(req),
    });
  }

  router.get('/recuperar-contrasena', onlyGuest, (req, res) => renderRequest(req, res));

  router.post('/recuperar-contrasena', verifyCsrf, onlyGuest, limit, async (req, res) => {
    // 1. Comprobar el formato del correo. Este error no revela si la cuenta existe.
    const result = resetRequestSchema.safeParse(req.body);
    if (!result.success)
      return renderRequest(req, res, {
        status: 422,
        errors: fieldErrors(result.error),
        email: typeof req.body.email === 'string' ? req.body.email.slice(0, 254) : '',
      });
    // 2. Si el correo está registrado, crear el enlace y enviarlo. No se espera al envío:
    //    así la respuesta tarda lo mismo exista o no la cuenta, y un fallo del servidor
    //    de correo no revela nada (se anota en la terminal).
    const reset = await resets.requestReset(result.data.email);
    if (reset)
      Promise.resolve()
        .then(() =>
          mailer.sendPasswordReset({
            to: reset.email,
            firstName: reset.first_name,
            link: `${mailer.appUrl}/restablecer-contrasena/${reset.token}`,
          }),
        )
        .catch((error) => console.error(`No se pudo enviar el correo de recuperación: ${error.message}`));
    // 3. El mismo mensaje en los dos casos.
    return renderRequest(req, res, { sent: true });
  });

  router.get('/restablecer-contrasena/:token', onlyGuest, async (req, res) => {
    const usable = isValidResetToken(req.params.token) && (await resets.isUsable(req.params.token));
    return usable ? renderReset(req, res) : renderReset(req, res, { status: 400, valid: false });
  });

  router.post('/restablecer-contrasena/:token', verifyCsrf, onlyGuest, limit, async (req, res) => {
    const { token } = req.params;
    // 1. Un enlace con formato incorrecto no llega a la base de datos.
    if (!isValidResetToken(token)) return renderReset(req, res, { status: 400, valid: false });
    // 2. Validar la nueva contraseña (12-128 y confirmación). Si falla, el enlace sigue sirviendo.
    const result = passwordResetSchema.safeParse(req.body);
    if (!result.success)
      return renderReset(req, res, { status: 422, errors: fieldErrors(result.error) });
    // 3. Usar el enlace y guardar la contraseña. false si ya se usó o ha caducado.
    const changed = await resets.resetPassword(token, result.data.password);
    if (!changed) return renderReset(req, res, { status: 400, valid: false });
    return res.redirect(303, '/iniciar-sesion?restablecida=ok');
  });

  return router;
}
