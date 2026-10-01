/**
 * Gestión de sesiones de usuario de ReFind.
 *
 * - express-session gestiona la sesión de cada visitante.
 * - connect-pg-simple guarda las sesiones en la tabla "session" de PostgreSQL.
 * - El navegador solo guarda una cookie con el identificador de la sesión,
 *   firmado con SESSION_SECRET para que no pueda falsificarse.
 *
 * Este archivo ofrece:
 *   createSessionMiddleware -> configura las sesiones para el servidor Express.
 *   startSession            -> inicia la sesión de un usuario (tras comprobar sus credenciales).
 *   endSession              -> cierra la sesión: la borra de PostgreSQL y elimina la cookie.
 *   requireAuth             -> protege rutas que exigen haber iniciado sesión.
 */
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

// Nombre de la cookie de sesión en el navegador.
export const SESSION_COOKIE_NAME = 'refind.sid';

// Duración de la sesión sin actividad: 2 horas.
export const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Opciones de la cookie. Se reutilizan al borrarla para que el navegador la elimine.
const COOKIE_OPTIONS = {
  httpOnly: true, // El JavaScript de la página no puede leerla.
  sameSite: 'lax', // No se envía en peticiones POST desde otras webs.
  secure: false, // Solo HTTP local. Al desplegar con HTTPS, cambiar a true.
  path: '/',
};

/**
 * Crea el middleware de sesiones y su almacén en PostgreSQL.
 * @param {{ secret: string, pool: import('pg').Pool, pruneExpired?: boolean }} options
 */
export function createSessionMiddleware({ secret, pool, pruneExpired = true }) {
  const PgStore = connectPgSimple(session);
  const store = new PgStore({
    pool,
    tableName: 'session',
    // La tabla la crea la migración 002, no la librería.
    createTableIfMissing: false,
    // Borrar las sesiones caducadas cada 15 minutos (en pruebas se desactiva).
    pruneSessionInterval: pruneExpired ? 15 * 60 : false,
  });

  const middleware = session({
    name: SESSION_COOKIE_NAME,
    secret,
    store,
    // No guardar sesiones vacías ni reescribir las que no cambian.
    saveUninitialized: false,
    resave: false,
    // Cada petición del usuario conectado renueva las 2 horas.
    rolling: true,
    cookie: { ...COOKIE_OPTIONS, maxAge: SESSION_MAX_AGE_MS },
  });

  return { middleware, store };
}

/**
 * Inicia la sesión de un usuario cuyas credenciales ya se han comprobado.
 * Regenera la sesión (nuevo identificador) para evitar que alguien reutilice
 * un identificador anterior al inicio de sesión.
 * @param {import('express').Request} req
 * @param {number|string} userId
 */
export function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError);
      req.session.userId = String(userId);
      req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

/**
 * Cierra la sesión: la borra de PostgreSQL y elimina la cookie del navegador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function endSession(req, res) {
  return new Promise((resolve, reject) => {
    req.session.destroy((destroyError) => {
      if (destroyError) return reject(destroyError);
      res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
      resolve();
    });
  });
}

/**
 * Middleware para rutas privadas: solo deja pasar si hay un usuario en la sesión.
 * Si falta la identidad, responde 401 con una página de acceso restringido.
 */
export function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  res.status(401).render('error', {
    title: 'Acceso restringido',
    message: 'Debes iniciar sesión para acceder a esta página.',
  });
}
