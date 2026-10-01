# ReFind · Entorno de pruebas · Primer desarrollador

Este manual sirve para revisar la configuración común, comprobar las herramientas en el primer equipo y compartir los archivos con el resto de desarrolladores.

**Dónde:** terminal Windows PowerShell de VS Code, como usuario normal, en la carpeta del proyecto donde está `package.json`.

**Antes:** completar el manual del entorno base. Las dependencias de pruebas ya deben estar instaladas. Estas comprobaciones no necesitan PostgreSQL ni funcionalidades de ReFind: utilizan únicamente una respuesta HTTP y una página de prueba.

| Herramienta | Para qué se comprueba | Versión del proyecto |
| --- | --- | --- |
| Vitest | Ejecutar la prueba HTTP | 5.0.1 |
| Supertest | Enviar la petición HTTP y comprobar la respuesta | 7.3.0 |
| @vitest/coverage-v8 | Generar el informe de cobertura | 5.0.1 |
| Playwright y su Chromium | Ejecutar la prueba de navegador | Playwright 1.63.0 |
| Extensión Playwright de VS Code | Ejecutar la prueba desde el editor | 1.1.19 |

## 1. Revisar la preparación compartida

Los archivos siguientes ya están preparados en el proyecto. Abrirlos desde el explorador de VS Code para identificar su función; no volver a copiar su código desde el manual.

| Archivo | Función |
| --- | --- |
| `tests/setup/http.js` | Respuesta HTTP mínima para comprobar las herramientas. |
| `tests/setup/tools.test.js` | Prueba ejecutada por Vitest y Supertest. |
| `vitest.setup.config.js` | Selecciona esa prueba y configura el informe de cobertura. |
| `tests/setup/browser.spec.js` | Prueba que escribe y lee un campo en Chromium. |
| `playwright.setup.config.js` | Selecciona la prueba de navegador y configura su informe. |
| `package.json` | Contiene los comandos `check:tests:http`, `check:tests:browser` y `check:tests`. |

Mantener las versiones de dependencias de `package.json` y `package-lock.json`. Su comprobación corresponde a `check:env` en el manual del entorno. Si falta alguno de estos archivos, completar la preparación compartida antes de continuar.

**Estado:** archivos preparados; no se consideran validados hasta ejecutar correctamente los pasos siguientes.

## 2. Descargar el navegador de pruebas

**Dónde:** terminal Windows PowerShell de VS Code, como usuario normal, en la raíz del proyecto (donde está `package.json`).

**Para qué:** instalar el Chromium que necesitan las pruebas sin ventana visible. `npm.cmd ci --include=dev` instala Playwright, pero este navegador se descarga por separado en cada equipo.

```powershell
npx.cmd --no-install playwright install chromium --only-shell
```

Esperar a que termine sin errores. Si aparece `timed out`, seguir el [procedimiento por IPv4](Manual_pruebas_ReFind.md#descarga-por-ipv4-si-aparece-timed-out). Si termina correctamente, continuar con el apartado 3.

El navegador queda en `%LOCALAPPDATA%\ms-playwright`; no se sube a Git. Repetir la instalación cuando cambie la versión de Playwright del proyecto.

Esta instalación sirve para las pruebas actuales sin ventana visible. Si se necesita mostrar el navegador o depurarlo con ventana, instalar Chromium completo con `npx.cmd --no-install playwright install chromium`.

## 3. Comprobar Vitest, Supertest y cobertura

Este comando ejecuta una petición HTTP contra una pequeña aplicación de comprobación. Verifica que responde con estado `200` y el contenido esperado, y genera un informe de cobertura.

```powershell
npm.cmd run check:tests:http
```

**Resultado esperado:** una prueba correcta (`1 passed`), ninguna fallida y regreso al indicador de PowerShell.

Para ver el informe, abrir el Explorador de archivos en la carpeta del proyecto, entrar en **coverage → setup** y abrir **index.html** con el navegador. Debe mostrar el archivo `http.js` y sus datos de cobertura. Esto comprueba que la herramienta genera el informe.

Si falla la prueba o no se genera el informe, resolver el error antes de continuar.

## 4. Comprobar Playwright y Chromium

Este comando inicia Chromium, escribe «Mochila» en un campo de una página de comprobación y verifica el valor escrito:

```powershell
npm.cmd run check:tests:browser
```

**Resultado esperado:** una prueba correcta (`1 passed`), ninguna fallida y regreso al indicador de PowerShell. El navegador se ejecuta sin ventana visible y se cierra al terminar.

Para ver el informe, abrir **playwright-report → setup → index.html** desde la carpeta del proyecto. Debe aparecer la prueba **Chromium arranca y permite interactuar** como correcta.

## 5. Comprobar la ejecución desde VS Code

Este paso permite ejecutar la prueba de navegador desde el panel de pruebas del editor.

1. En la terminal de VS Code, consultar las extensiones:

```powershell
code --list-extensions --show-versions
```

2. Si aparece `ms-playwright.playwright@1.1.19`, continuar con el punto 3. Si falta o tiene otra versión, ejecutar:

```powershell
code --install-extension ms-playwright.playwright@1.1.19
```

Repetir la consulta y comprobar que aparece la versión **1.1.19**.

3. Cerrar y volver a abrir VS Code con la carpeta del proyecto.
4. Pulsar el icono del matraz **Testing / Pruebas**, en la barra lateral.
5. En el apartado de Playwright del panel, seleccionar la configuración **playwright.setup.config.js** si se solicita.
6. Mantener desactivada la opción **Show browser / Mostrar navegador** del panel de Playwright. Localizar **Chromium arranca y permite interactuar** y pulsar el botón de ejecución junto a la prueba.
7. Debe terminar correctamente y mostrar una marca verde.

Mantener las actualizaciones automáticas del editor y las extensiones desactivadas según el manual del entorno.

## 6. Si una comprobación falla

| Mensaje o problema | Qué hacer |
| --- | --- |
| No encuentra `package.json`, un paquete o una configuración | Confirmar que la terminal está en la raíz del proyecto y que se completó el manual del entorno. |
| La descarga indica `timed out` | Seguir el [procedimiento por IPv4](Manual_pruebas_ReFind.md#descarga-por-ipv4-si-aparece-timed-out) y repetir la comprobación. |
| Falta el ejecutable de Chromium | Repetir la descarga del apartado 2 y después la prueba de navegador. |
| No se encuentran pruebas | Comprobar que existen los archivos de `tests/setup` y las dos configuraciones en la raíz. Una ejecución sin pruebas no es válida. |
| La prueba no aparece en VS Code | Revisar que está abierta la carpeta del proyecto, la extensión tiene la versión indicada y está seleccionada la configuración de comprobación. |
| Otro error | Conservar el mensaje, resolver la causa y repetir el comando que falló. |

**El entorno de pruebas queda comprobado en este equipo cuando pasan la prueba HTTP con su informe de cobertura, la prueba de navegador y su ejecución desde VS Code.** No se necesita rellenar una ficha.

Para repetir las dos pruebas de terminal juntas:

```powershell
npm.cmd run check:tests
```

Ejecuta primero la prueba HTTP y después la de navegador. Si falla la primera, no ejecuta la segunda. Este comando no comprueba la extensión de VS Code.

## 7. Compartir la preparación

Después de comprobarla, incluir en la entrega por Git los cinco archivos de pruebas y configuración del apartado 1, `package.json`, `package-lock.json`, `.gitignore` y ambos manuales de pruebas. Conservar los demás cambios compartidos del proyecto.

No incluir `node_modules`, navegadores descargados, `coverage`, `playwright-report` ni `test-results`.

Los siguientes desarrolladores seguirán el [manual de incorporación del entorno de pruebas](Manual_pruebas_ReFind_resumido.md).

## Descarga por IPv4 si aparece `timed out`

**Dónde:** la misma terminal PowerShell, como usuario normal, en la raíz del proyecto.

**Para qué:** evitar la conexión IPv6 que bloqueó la descarga en el equipo comprobado. No cambia la configuración de red de Windows ni las versiones del proyecto.

**1. Copiar y ejecutar el bloque completo.** Crea un archivo temporal para descargar por IPv4, ejecuta el instalador y elimina el archivo al terminar. Restaura también el valor anterior de `NODE_OPTIONS`.

```powershell
$refindPreload = Join-Path $env:TEMP ('refind-playwright-ipv4-' + [guid]::NewGuid().ToString('N') + '.cjs')
$refindOldOptions = $env:NODE_OPTIONS
try {
    Set-Content -LiteralPath $refindPreload -Encoding utf8 -Value "const dns = require('node:dns'); const original = dns.promises.lookup.bind(dns.promises); dns.promises.lookup = (host, options) => { if (options?.family === 6) return Promise.reject(Object.assign(new Error('IPv4-only download'), {code:'ENOTFOUND'})); return original(host, options); };"
    $refindNodePath = $refindPreload.Replace('\', '/')
    $env:NODE_OPTIONS = (($refindOldOptions + ' --require="' + $refindNodePath + '"').Trim())
    node node_modules/playwright/cli.js install chromium --only-shell
    if ($LASTEXITCODE -ne 0) {
        throw 'La descarga ha fallado. Conservar el mensaje de error antes de continuar.'
    }
} finally {
    $env:NODE_OPTIONS = $refindOldOptions
    Remove-Item -LiteralPath $refindPreload -ErrorAction SilentlyContinue
}
```

**Resultado esperado:** termina sin errores e indica que el navegador y sus componentes se han descargado; si ya estaban instalados, puede terminar sin nuevas descargas. Para instalar también el navegador con ventana mediante este bloque, quitar únicamente `--only-shell`.

**2. Comprobar las herramientas:**

```powershell
npm.cmd run check:tests
```

**Resultado esperado:** una prueba HTTP correcta y una prueba de Chromium correcta (`1 passed` en cada ejecución). El navegador se cierra automáticamente. Después continuar con el apartado 5 para comprobar la extensión de VS Code.

**Comprobado el 01/10/2026 en este equipo:** descarga por IPv4 con `--only-shell` y ambas pruebas correctas con Node 24.21.0 y Playwright 1.63.0. Esto no da por comprobada la extensión de VS Code ni sustituye la comprobación en el equipo de cada desarrollador.
