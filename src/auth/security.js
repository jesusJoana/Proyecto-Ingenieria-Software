/** Protección de formularios locales: token por sesión y límite de envíos por IP. */
import { randomBytes, timingSafeEqual } from 'node:crypto';

export function csrfToken(req) {
  req.session.csrfToken ??= randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

export function verifyCsrf(req, res, next) {
  const received = req.body?._csrf;
  const expected = req.session?.csrfToken;
  if (
    typeof received !== 'string' ||
    typeof expected !== 'string' ||
    !/^[a-f0-9]{64}$/.test(received) ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  ) {
    return res.status(403).render('error', {
      title: 'Formulario caducado',
      message: 'Vuelve a abrir el formulario e inténtalo de nuevo.',
    });
  }
  next();
}

/** Límite local, sin servicios adicionales. Se reinicia al detener el proceso. */
export function createAuthLimiter({
  limit = 30,
  windowMs = 15 * 60 * 1000,
  now = Date.now,
} = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, entry] of attempts)
      if (entry.until <= time) attempts.delete(key);
    const key = req.ip;
    let entry = attempts.get(key);
    if (!entry && attempts.size >= 10000) {
      return res
        .status(429)
        .render('error', {
          title: 'Demasiados intentos',
          message: 'Espera unos minutos antes de intentarlo de nuevo.',
        });
    }
    if (!entry) {
      entry = { count: 0, until: time + windowMs };
      attempts.set(key, entry);
    }
    if (++entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.until - time) / 1000)));
      return res
        .status(429)
        .render('error', {
          title: 'Demasiados intentos',
          message: 'Espera unos minutos antes de intentarlo de nuevo.',
        });
    }
    next();
  };
}
