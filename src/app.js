/**
 * Aplicación Express de ReFind.
 *
 * createApp(config) monta el servidor, pero no lo arranca: lo arranca
 * src/server.js. Así las pruebas pueden usar la misma aplicación sin abrir
 * un puerto.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';
import { createSessionMiddleware } from './session.js';

// Carpeta raíz del proyecto, para localizar vistas y recursos.
const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * @param {ReturnType<import('./config.js').readConfig>} config
 */
export function createApp(config) {
  // Conexiones a PostgreSQL compartidas por toda la aplicación.
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

  // Sesiones guardadas en la tabla "session".
  const sessions = createSessionMiddleware({
    secret: config.SESSION_SECRET,
    pool,
    pruneExpired: config.APP_ENV !== 'test',
  });

  const app = express();
  app.disable('x-powered-by'); // No revelar que el servidor usa Express.

  // Vistas EJS en la carpeta views/.
  app.set('view engine', 'ejs');
  app.set('views', path.join(root, 'views'));

  // Leer los datos de los formularios HTML (limitados a 32 KB).
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));

  // Recursos estáticos: Bootstrap desde node_modules y los propios en public/.
  app.use('/vendor/bootstrap', express.static(path.join(root, 'node_modules', 'bootstrap', 'dist')));
  app.use(express.static(path.join(root, 'public')));

  // Sesiones de usuario.
  app.use(sessions.middleware);

  // Dejar disponible en todas las vistas si hay un usuario conectado.
  app.use((req, res, next) => {
    res.locals.userId = req.session.userId ?? null;
    next();
  });

  // Página de inicio.
  app.get('/', (req, res) => {
    res.render('index', { title: 'ReFind' });
  });

  // Comprobación de funcionamiento: responde ok si PostgreSQL contesta.
  app.get('/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  // Cualquier otra dirección: página no encontrada.
  app.use((req, res) => {
    res.status(404).render('error', {
      title: 'Página no encontrada',
      message: 'La página que buscas no existe.',
    });
  });

  // Errores inesperados: se registran en la terminal del servidor y el usuario
  // ve un mensaje genérico, sin detalles internos (requisito 16).
  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(500).render('error', {
      title: 'Error inesperado',
      message: 'Ha ocurrido un error. Inténtalo de nuevo más tarde.',
    });
  });

  return {
    app,
    pool,
    // Cierra las conexiones y temporizadores al apagar el servidor o terminar las pruebas.
    async close() {
      await sessions.store.close();
      await pool.end();
    },
  };
}
