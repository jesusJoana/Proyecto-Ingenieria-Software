/**
 * Comprobación local del entorno base: npm.cmd run check:env.
 * Requiere las dependencias instaladas. No instala paquetes ni inicia servicios.
 * Cada bloque muestra OK o ERROR; salida 0 si todos pasan y 1 si alguno falla.
 * La lectura inicial de los manifiestos también debe funcionar para continuar.
 * No acredita la configuración del editor ni una instalación limpia reproducible.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Resolver los archivos respecto al proyecto, independientemente del directorio actual.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson(join(root, 'package.json'));
const lock = await readJson(join(root, 'package-lock.json'));
let failures = 0;
/** Ejecuta una comprobación y acumula fallos para poder revisar las restantes. */
async function check(name, action) {
  try {
    await action();
    console.log(`OK: ${name}`);
  } catch (error) {
    failures++;
    console.error(`ERROR: ${name}: ${error.message}`);
  }
}
/** Convierte una condición incumplida en un fallo de la comprobación actual. */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1. El Node en ejecución debe coincidir exactamente con package.json.
await check('Node', () => {
  assert(process.versions.node === manifest.engines.node,
    `se requiere ${manifest.engines.node}; actual ${process.versions.node}`);
});
// 2. npm comunica su versión al ejecutar este script mediante npm run.
await check('npm', () => {
  const expected = manifest.packageManager.replace('npm@', '');
  const actual = process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/)?.[1];
  assert(actual === expected, `ejecutar con npm ${expected}; actual ${actual ?? 'no identificado'}`);
});
// 3. La versión compartida en .node-version debe coincidir con el manifiesto.
await check('.node-version', async () => {
  assert((await readFile(join(root, '.node-version'), 'utf8')).trim() === manifest.engines.node,
    'no coincide con package.json');
});
// 4. Comparar cada dependencia directa instalada con el manifiesto y el lockfile.
// Además, importar las de ejecución para detectar errores de carga. Las herramientas
// de desarrollo se verifican aquí por versión; su ejecución tiene pruebas separadas.
for (const group of ['dependencies', 'devDependencies']) {
  for (const [name, version] of Object.entries(manifest[group] ?? {})) {
    await check(`${name} ${version}`, async () => {
      const installed = await readJson(join(root, 'node_modules', name, 'package.json'));
      assert(installed.version === version, `instalado ${installed.version}`);
      assert(lock.packages['']?.[group]?.[name] === version &&
        lock.packages[`node_modules/${name}`]?.version === version, 'lockfile incoherente');
      if (group === 'dependencies' && name !== 'bootstrap') await import(name);
    });
  }
}
// 5. Verificar que los recursos CSS y JavaScript locales existen y no están vacíos.
await check('recursos Bootstrap', async () => {
  const directory = dirname(require.resolve('bootstrap/package.json'));
  for (const resource of ['dist/css/bootstrap.min.css', 'dist/js/bootstrap.bundle.min.js']) {
    assert((await readFile(join(directory, resource))).length > 0, `${resource} vacío`);
  }
});
// 6. Generar un hash en memoria: aceptar la clave original y rechazar otra.
// La clave es ficticia y no se guarda ningún usuario ni contraseña.
await check('Argon2: contraseña correcta e incorrecta', async () => {
  const { default: argon2 } = await import('argon2');
  const hash = await argon2.hash('comprobacion-local-refind', { type: argon2.argon2id });
  assert(await argon2.verify(hash, 'comprobacion-local-refind'), 'verificación correcta fallida');
  assert(!(await argon2.verify(hash, 'otra-clave')), 'contraseña incorrecta aceptada');
});
console.log(`\nEntorno base: ${failures ? `${failures} comprobaciones fallidas` : 'comprobaciones correctas'}.`);
console.log('No valida PostgreSQL, VS Code, instalación limpia ni herramientas de pruebas.');
// Permitir que la terminal o una automatización detecten el resultado global.
process.exitCode = failures ? 1 : 0;
