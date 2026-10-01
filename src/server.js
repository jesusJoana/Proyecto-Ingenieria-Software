/**
 * Arranca el servidor de ReFind.
 *
 * Uso (mediante los scripts de package.json):
 *   npm.cmd run dev        -> desarrollo, puerto 3000, se reinicia al guardar cambios
 *   npm.cmd run start:e2e  -> entorno E2E, puerto 3001
 */
import { readConfig } from './config.js';
import { createApp } from './app.js';

const mode = process.argv[2] ?? 'development';
const config = readConfig(mode);
const { app, close } = createApp(config);

// Escuchar solo en el propio equipo (127.0.0.1), en el puerto del .env.
const server = app.listen(config.PORT, '127.0.0.1', (error) => {
  if (error) {
    console.error(`No se pudo arrancar en el puerto ${config.PORT}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ReFind (${mode}) en http://127.0.0.1:${config.PORT}`);
});

// Apagado ordenado con Ctrl+C: dejar de aceptar peticiones y cerrar conexiones.
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await close();
    console.log('ReFind detenido.');
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
