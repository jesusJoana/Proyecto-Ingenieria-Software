/**
 * Configuración de ReFind.
 *
 * Lee el archivo .env del entorno indicado (development, test o e2e),
 * comprueba que los datos son válidos y que apuntan a la base de datos y al
 * rol de ese entorno, y devuelve la configuración ya validada.
 *
 * Si algo no es correcto, lanza un error que indica qué revisar, sin mostrar
 * nunca contraseñas ni secretos.
 */
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { z } from 'zod';

// Entornos permitidos y el sufijo de su base de datos y su rol.
const ENVIRONMENTS = { development: 'dev', test: 'test', e2e: 'e2e' };

// Datos que debe contener cada .env y reglas que deben cumplir.
const schema = z.object({
  APP_ENV: z.enum(['development', 'test', 'e2e']),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(64),
  PORT: z.coerce.number().int().min(1024).max(65535),
});

/**
 * Devuelve la configuración del entorno indicado.
 * @param {'development' | 'test' | 'e2e'} mode
 */
export function readConfig(mode) {
  // 1. Solo se admiten los tres entornos de ReFind.
  if (!Object.hasOwn(ENVIRONMENTS, mode)) {
    throw new Error(`Entorno no permitido: "${mode}". Usar development, test o e2e.`);
  }

  // 2. Leer el archivo .env de ese entorno, en la raíz del proyecto.
  let text;
  try {
    text = readFileSync(new URL(`../.env.${mode}`, import.meta.url), 'utf8');
  } catch {
    throw new Error(`No se encuentra .env.${mode} en la raíz del proyecto.`);
  }

  // 3. Comprobar que están todos los datos y tienen el formato correcto.
  //    Solo se muestran los nombres de los campos incorrectos, nunca sus valores.
  const result = schema.safeParse(parseEnv(text));
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Revisar .env.${mode}: faltan o son incorrectos ${fields.join(', ')}.`);
  }
  const config = result.data;

  // 4. APP_ENV debe coincidir con el archivo, para no mezclar entornos.
  if (config.APP_ENV !== mode) {
    throw new Error(`Revisar .env.${mode}: APP_ENV debe ser "${mode}".`);
  }

  // 5. La conexión debe ir al PostgreSQL local, a la base y al rol de este entorno.
  //    Así es imposible que, por ejemplo, las pruebas borren datos de desarrollo.
  const suffix = ENVIRONMENTS[mode];
  let target;
  try {
    target = new URL(config.DATABASE_URL);
  } catch {
    throw new Error(`Revisar .env.${mode}: DATABASE_URL no es una dirección válida.`);
  }
  if (
    target.protocol !== 'postgresql:' ||
    target.hostname !== '127.0.0.1' ||
    target.pathname !== `/refind_${suffix}` ||
    decodeURIComponent(target.username) !== `refind_${suffix}_user` ||
    !target.password
  ) {
    throw new Error(
      `Revisar .env.${mode}: DATABASE_URL debe conectar a refind_${suffix} en 127.0.0.1 ` +
        `con el rol refind_${suffix}_user y su contraseña.`,
    );
  }

  // 6. Devolver la configuración sin permitir que se modifique después.
  return Object.freeze(config);
}
