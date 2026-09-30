# ReFind · Entorno de pruebas · Siguientes desarrolladores

Este manual sirve para preparar las herramientas locales y ejecutar las comprobaciones que el primer desarrollador ha compartido por Git.

**Dónde:** terminal Windows PowerShell de VS Code, como usuario normal, en la carpeta del proyecto donde está `package.json`.

**Antes:** completar el manual del entorno base. Las dependencias de pruebas ya deben estar instaladas. Estas comprobaciones no necesitan PostgreSQL ni funcionalidades de ReFind: utilizan únicamente una respuesta HTTP y una página de prueba.

| Herramienta | Para qué se comprueba | Versión del proyecto |
| --- | --- | --- |
| Vitest | Ejecutar la prueba HTTP | 5.0.1 |
| Supertest | Enviar la petición HTTP y comprobar la respuesta | 7.3.0 |
| @vitest/coverage-v8 | Generar el informe de cobertura | 5.0.1 |
| Playwright y su Chromium | Ejecutar la prueba de navegador | Playwright 1.63.0 |
| Extensión Playwright de VS Code | Ejecutar la prueba desde el editor | 1.1.19 |

## 1. Abrir el proyecto preparado

Completar primero el [manual del entorno para los siguientes desarrolladores](Manual_entorno_ReFind_resumido.md) hasta su comprobación del entorno base.

Las dependencias se instalaron con `npm.cmd ci --include=dev`. Los archivos de `tests/setup`, `vitest.setup.config.js`, `playwright.setup.config.js` y los comandos de `package.json` vienen del repositorio. No hay que crearlos ni modificarlos para seguir esta guía.

Continuar con la descarga del navegador.

## 2. Descargar el navegador de pruebas

Playwright necesita su propia versión de Chromium. Instalarla en este equipo:

```powershell
npx.cmd --no-install playwright install chromium
```

Esperar a que termine sin errores. Este navegador se descarga en el equipo de cada desarrollador; no se comparte por Git.

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
6. Localizar **Chromium arranca y permite interactuar** y pulsar el botón de ejecución junto a la prueba.
7. Debe terminar correctamente y mostrar una marca verde.

Mantener las actualizaciones automáticas del editor y las extensiones desactivadas según el manual del entorno.

## 6. Si una comprobación falla

| Mensaje o problema | Qué hacer |
| --- | --- |
| No encuentra `package.json`, un paquete o una configuración | Confirmar que la terminal está en la raíz del proyecto y que se completó el manual del entorno. |
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
