# Manual 3 · Entorno de pruebas de ReFind

Versión 1.0 · 25 de septiembre de 2026

## 1. Alcance, requisitos y estado

Este manual prepara Vitest **5.0.1**, Supertest **7.3.0**, `@vitest/coverage-v8` **5.0.1**, Playwright **1.63.0**, su Chromium y la extensión Playwright **1.1.19**. Los paquetes npm forman parte del manifiesto común y ya se instalan mediante el [manual base](Manual_entorno_ReFind.md); no volver a añadirlos paquete a paquete después de clonar.

**Estado:** paquetes npm instalados y versiones comprobadas en el equipo de Jesús; configuración y validación del entorno de pruebas pendientes. Este manual puede dejarse pendiente mientras se completa el entorno base.

Trabajar en Windows PowerShell integrado, como usuario normal, desde la raíz del repositorio. Usar Node **24.21.0** y npm **11.19.0**. Quien prepara los archivos comunes los comparte una vez; quien clona los conserva y ejecuta únicamente las instalaciones locales y comprobaciones.

Las comprobaciones de herramientas de los apartados 2–4 no requieren PostgreSQL ni una aplicación ReFind. Las pruebas de integración con datos y los recorridos de la aplicación del anexo A sí requieren el [manual de base de datos](Manual_base_datos_ReFind.md). Actions se configura cuando esas pruebas estén implementadas y validadas, según el anexo B.

## 2. Comprobación de paquetes y descarga de Chromium

Con las dependencias instaladas mediante el manual base, consultar:

```powershell
npm.cmd ls vitest @vitest/coverage-v8 supertest @playwright/test --depth=0
npx.cmd --no-install vitest --version
npx.cmd --no-install playwright --version
npx.cmd --no-install playwright install --list
```

Las versiones deben coincidir con 1. Si los paquetes faltan o difieren, recuperar el manifiesto y lockfile comunes y seguir 5.2 del manual base; no instalar revisiones nuevas por cuenta propia.

Si falta el Chromium de Playwright 1.63.0, ejecutar:

```powershell
npx.cmd --no-install playwright install chromium
npx.cmd --no-install playwright install --list
```

No usar administrador. Esta descarga es local a cada equipo y no requiere PostgreSQL. Confirmar que aparece el Chromium asociado a la versión del ejecutor. Referencia: [navegadores de Playwright](https://playwright.dev/docs/browsers).

## 3. Configuración y validación aislada de herramientas

El responsable prepara una vez los archivos de este apartado y los comparte; quien clona no los recrea. Son comprobaciones de instalación, no funcionalidades de ReFind. No necesitan `src/app.js`, variables de conexión ni base de datos. Crear las carpetas indicadas manualmente cuando se aborde este bloque.

### 3.1. Vitest, Supertest y cobertura

Crear `tests/setup/http.js`:

```javascript
import express from 'express';

export function createCheckApp() {
  const app = express();
  app.get('/check', (req, res) => res.json({ ok: true }));
  return app;
}
```

Crear `tests/setup/tools.test.js`:

```javascript
import { test, expect } from 'vitest';
import request from 'supertest';
import { createCheckApp } from './http.js';

test('el ejecutor y las peticiones HTTP funcionan', async () => {
  const response = await request(createCheckApp()).get('/check').expect(200);
  expect(response.body).toEqual({ ok: true });
});
```

Crear `vitest.setup.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/setup/tools.test.js'],
    coverage: {
      provider: 'v8',
      include: ['tests/setup/http.js'],
      exclude: [],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage/setup',
    },
  },
});
```

Ejecutar:

```powershell
npx.cmd --no-install vitest run --config vitest.setup.config.js --coverage
```

Resultado: una prueba correcta, proceso finalizado y `coverage/setup/index.html` generado con cobertura de `http.js`. El servidor de comprobación usa un puerto temporal durante la petición y se cierra al terminar; no es el servidor de ReFind. Una ejecución sin pruebas no valida la herramienta.

### 3.2. Playwright y Chromium sin aplicación

Crear `playwright.setup.config.js`:

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/setup',
  testMatch: 'browser.spec.js',
  workers: 1,
  use: { browserName: 'chromium' },
  outputDir: 'test-results/setup',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/setup', open: 'never' }]],
});
```

Crear `tests/setup/browser.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test('Chromium arranca y permite interactuar', async ({ page }) => {
  await page.setContent('<label>Objeto <input></label>');
  await page.getByRole('textbox', { name: 'Objeto' }).fill('Mochila');
  await expect(page.getByRole('textbox', { name: 'Objeto' })).toHaveValue('Mochila');
});
```

Ejecutar:

```powershell
npx.cmd --no-install playwright test --config playwright.setup.config.js
```

Resultado: una prueba correcta y navegador cerrado al finalizar. Abrir `playwright-report/setup/index.html`. No se utiliza PostgreSQL ni un servidor web; esta comprobación no acredita las pantallas del producto.

## 4. Extensión Playwright de VS Code

Consultar `code --list-extensions --show-versions`. Debe aparecer `ms-playwright.playwright@1.1.19`. Si falta o difiere, seleccionar esa revisión desde **Install Another Version...** de la extensión publicada por Microsoft, o ejecutar manualmente:

```powershell
code --install-extension ms-playwright.playwright@1.1.19
```

Mantener desactivada su actualización automática según el manual base. Reiniciar VS Code, abrir el panel Pruebas, seleccionar `playwright.setup.config.js` y ejecutar la prueba `Chromium arranca y permite interactuar`. Debe pasar también desde el editor. Referencia: [extensión Playwright](https://github.com/microsoft/playwright-vscode/releases/tag/v1.1.19).

## 5. Registro de validación del entorno de pruebas

Desarrollador, fecha, commit y resultados: por registrar. Cada compañero descarga su navegador y realiza estas comprobaciones en su equipo.

| Comprobación | Resultado esperado | Estado comunicado por Jesús |
| --- | --- | --- |
| Paquetes npm | Versiones exactas de 1 | Instalados y versiones comprobadas |
| Configuración aislada | Archivos de 3 disponibles en el repositorio | Pendiente |
| Vitest y Supertest | Una prueba de instalación correcta | Pendiente |
| Cobertura | Informe HTML de `http.js` | Pendiente |
| Chromium | Descarga de la revisión asociada a Playwright | Pendiente |
| Playwright | Una prueba de instalación correcta y proceso cerrado | Pendiente |
| Extensión | 1.1.19 y misma prueba correcta desde VS Code | Pendiente |
| Pruebas de aplicación con datos | Base de datos y aplicación preparadas, casos funcionales correctos | Pendiente de desarrollo; no bloquea validar las herramientas |
| GitHub Actions | Workflow de aplicación ejecutado correctamente | Pendiente de pruebas locales del producto |

La instalación de herramientas de pruebas queda validada con 2–4 correctos. Las pruebas de aplicación y Actions tienen sus propios resultados posteriores y no se dan por ejecutados al cerrar esta instalación. Puede validarse este bloque con PostgreSQL todavía pendiente.

## 6. Paso a las pruebas del software desarrollado

Conservar las comprobaciones de `tests/setup/` separadas de los casos de la aplicación. Para utilizar el anexo A, preparar primero sus archivos de aplicación y las bases del manual 2. No mezclar desarrollo, integración y E2E: usar `refind_dev`, `refind_test` y `refind_e2e` respectivamente. Quien clona recibe las configuraciones y casos existentes; no los vuelve a generar.

El anexo B configura Actions para las pruebas de aplicación. Una comprobación aislada de herramientas correcta no autoriza a dar por correcta la integración remota ni la funcionalidad de ReFind.
## Anexo A. Pruebas de aplicación: requieren los ejemplos de desarrollo

Estos ejemplos requieren los archivos de aplicación del anexo A del [manual base](Manual_entorno_ReFind.md) y la configuración y migraciones del anexo A del [manual de base de datos](Manual_base_datos_ReFind.md). No son requisitos para comprobar por separado la instalación de Vitest y Chromium. Se conservan sin afirmar que estén implementados o validados.

### A.1. Vitest, Supertest, Argon2, Sharp, Multer y Nodemailer

Crear `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
```

Crear `tests/unit/environment.test.js`:

```javascript
import { expect, test } from 'vitest';
import argon2 from 'argon2';
import { readConfig } from '../../src/config.js';

test('Argon2 genera y verifica contraseñas', async () => {
  const hash = await argon2.hash('clave-local-de-comprobacion', { type: argon2.argon2id });
  expect(hash).not.toBe('clave-local-de-comprobacion');
  expect(await argon2.verify(hash, 'clave-local-de-comprobacion')).toBe(true);
  expect(await argon2.verify(hash, 'incorrecta')).toBe(false);
});

test('la configuración rechaza entornos no definidos', () => {
  expect(() => readConfig('production')).toThrow('Entorno no permitido');
});
```

Crear `tests/integration/environment.test.js`:

```javascript
import { afterAll, expect, test } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { readConfig } from '../../src/config.js';
import { createRuntime } from '../../src/app.js';

const runtime = createRuntime(readConfig('test'));
afterAll(async () => { await runtime.close(); });

test('Express conecta con la base de integración', async () => {
  await request(runtime.app).get('/health').expect(200, { status: 'ok' });
  const { rows } = await runtime.pool.query('SELECT current_database() AS db');
  expect(rows[0].db).toBe('refind_test');
});

test('EJS y los recursos locales están disponibles', async () => {
  const response = await request(runtime.app).get('/').expect(200);
  expect(response.text).toContain('<h1>ReFind</h1>');
  for (const url of ['/vendor/bootstrap/css/bootstrap.min.css',
    '/vendor/bootstrap/js/bootstrap.bundle.min.js', '/css/refind.css']) {
    await request(runtime.app).get(url).expect(200);
  }
});

test('la sesión se conserva en PostgreSQL y entre peticiones', async () => {
  const agent = request.agent(runtime.app);
  const first = await agent.get('/__check/session').expect(200, { count: 1 });
  expect(first.headers['set-cookie'][0]).toContain('HttpOnly');
  expect(first.headers['set-cookie'][0]).toContain('SameSite=Lax');
  await agent.get('/__check/session').expect(200, { count: 2 });
  const { rows } = await runtime.pool.query(
    "SELECT sid FROM session WHERE (sess->>'checkCount')::integer = 2",
  );
  expect(rows.length).toBeGreaterThan(0);
});

test('Multer recibe una foto y Sharp la convierte; rechaza contenido inválido', async () => {
  const buffer = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#ffffff' },
  }).png().toBuffer();
  const response = await request(runtime.app).post('/__check/photo')
    .attach('photo', buffer, 'objeto.png').expect(200);
  expect(response.headers['content-type']).toContain('image/webp');
  const metadata = await sharp(response.body).metadata();
  expect(metadata.format).toBe('webp');
  await request(runtime.app).post('/__check/photo')
    .attach('photo', Buffer.from('no es una imagen'), 'objeto.png').expect(400);
  await request(runtime.app).post('/__check/photo')
    .attach('photo', Buffer.alloc(5 * 1024 * 1024 + 1), 'grande.png').expect(400);
});

test('Nodemailer prepara correo local sin envío externo', async () => {
  const result = await runtime.mail.sendMail({
    from: 'refind@example.invalid', to: 'usuario@example.invalid',
    subject: 'Comprobación ReFind', text: 'Correo de desarrollo',
  });
  const message = JSON.parse(result.message);
  expect(message.subject).toBe('Comprobación ReFind');
  expect(message.text).toBe('Correo de desarrollo');
});
```

Ejecutar después de migrar `refind_test`:

```powershell
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:coverage
```

**Resultado esperado:** dos pruebas unitarias y cinco de integración correctas, sin una ejecución vacía ni conexiones que mantengan el proceso abierto. Debe generarse `coverage/index.html`; abrirlo y comprobar que incluye el código de `src` configurado. La cobertura no tiene un umbral inicial de aceptación funcional. Referencia: [cobertura en Vitest](https://vitest.dev/guide/coverage).

### A.2. Playwright sobre la aplicación

Utilizar el ejecutor y Chromium ya instalados y comprobados en 2–4. Este ejemplo requiere la aplicación y su base E2E; no sustituye la comprobación aislada de instalación.

Crear `playwright.config.js`:

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3001', browserName: 'chromium' },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'node src/server.js e2e',
    url: 'http://127.0.0.1:3001/health',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
```

Crear `tests/e2e/environment.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

for (const width of [375, 768, 1280]) {
  test(`ReFind y Bootstrap en ${width}px`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ReFind' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver estado' }).click();
    await expect(page.locator('#estado')).toBeVisible();
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
```

Ejecutar:

```powershell
npm.cmd run db:check:e2e
npm.cmd run test:e2e
```

**Resultado esperado:** tres pruebas correctas; Playwright arranca y cierra su servidor en el puerto 3001. No debe reutilizar el de desarrollo en 3000. Abrir `playwright-report/index.html` para revisar resultados. Referencia: [webServer de Playwright](https://playwright.dev/docs/test-webserver).

## Anexo B. GitHub Actions: después de validar las pruebas locales

Aplicar este anexo cuando existan y funcionen los archivos y scripts del anexo A. Su workflow presupone la aplicación, migraciones y pruebas de esos ejemplos; no utilizarlo todavía para la validación aislada de herramientas. La integración continua forma parte de la configuración compartida. Se prepara una vez en el repositorio y todos los compañeros consultan su resultado. No requiere Docker, WSL ni un runner instalados en Windows; PostgreSQL se ejecuta únicamente en el runner remoto de GitHub.

En GitHub, comprobar que la pestaña **Actions** está disponible y que la política del repositorio permite los workflows. Crear `.github/workflows/ci.yml` desde el editor:

```yaml
name: Comprobaciones ReFind
on:
  push:
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-24.04
    services:
      postgres:
        image: postgres:17.11
        env:
          POSTGRES_PASSWORD: refind-ci-temporal
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: npm
      - run: npm install --global npm@11.19.0
      - run: npm ci
      - name: Preparar bases y variables efímeras
        shell: bash
        run: |
          node --input-type=module <<'JS'
          import pg from 'pg';
          import { writeFileSync } from 'node:fs';
          import { randomBytes } from 'node:crypto';
          const client = new pg.Client({
            host: '127.0.0.1', user: 'postgres', database: 'postgres',
            password: 'refind-ci-temporal', port: 5432,
          });
          try {
            await client.connect();
            for (const [mode, port] of [['test', 3002], ['e2e', 3001]]) {
              const role = `refind_${mode}_user`;
              const db = `refind_${mode}`;
              await client.query(`CREATE ROLE ${role} LOGIN PASSWORD 'refind-ci-local' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
              await client.query(`CREATE DATABASE ${db} OWNER ${role}`);
              await client.query(`REVOKE CONNECT, TEMPORARY ON DATABASE ${db} FROM PUBLIC`);
              await client.query(`GRANT CONNECT, TEMPORARY ON DATABASE ${db} TO ${role}`);
              writeFileSync(`.env.${mode}`, [
                `APP_ENV=${mode}`,
                `DATABASE_URL=postgresql://${role}:refind-ci-local@127.0.0.1:5432/${db}`,
                `SESSION_SECRET=${randomBytes(32).toString('hex')}`,
                `PORT=${port}`,
              ].join('\n'));
            }
          } finally {
            await client.end();
          }
          JS
      - run: npm run db:migrate:test
      - run: npm run db:migrate:e2e
      - run: npm run db:check:test
      - run: npm run db:check:e2e
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test:coverage
      - run: npx --no-install playwright install --with-deps chromium
      - run: npm run test:e2e
```

Las contraseñas del workflow son valores públicos exclusivos del servicio efímero de CI; no reutilizarlas en instalaciones locales o de despliegue. El runner utiliza Bash únicamente dentro del workflow; no ejecutar ese bloque en PowerShell. Referencia: [PostgreSQL en GitHub Actions](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).

**Comprobación:** cuando la configuración se comparta en GitHub, abrir Actions y comprobar una ejecución correcta asociada al commit. En una rama de comprobación, cambiar temporalmente una expectativa de prueba, verificar que Actions falla y revertir ese cambio en la misma rama; comprobar de nuevo el éxito. No incorporar el fallo a la rama compartida. Registrar el enlace a la ejecución correcta. La publicación de los archivos y ejecución remota se realizan manualmente por el equipo.
