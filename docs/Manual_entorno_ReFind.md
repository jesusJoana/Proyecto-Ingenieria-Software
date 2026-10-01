# Manual 1 · Entorno base · Primer desarrollador

Versión 3.0 · 25 de septiembre de 2026

**Destinatario:** desarrollador que prepara y comparte la configuración inicial del proyecto. Los siguientes desarrolladores utilizan el [manual de incorporación](Manual_entorno_ReFind_resumido.md).

## 1. Alcance y recorrido

La preparación del entorno de ReFind se divide en tres manuales. Cada uno tiene sus requisitos, instalación, configuración y validación; completar uno no acredita los otros.

| Manual | Contenido | Dependencias para validarlo |
| --- | --- | --- |
| [1. Entorno base](Manual_entorno_ReFind.md) | PowerShell, Git, VS Code, Node/npm, paquetes compartidos y herramientas de análisis/formato | Windows 11 x64, Internet y permisos para instalar |
| [2. Base de datos](Manual_base_datos_ReFind.md) | PostgreSQL, pgAdmin, bases, roles, conexiones y persistencia | Entorno base para las consultas desde Node; las consultas SQL no requieren aplicación |
| [3. Entorno de pruebas](Manual_pruebas_ReFind.md) | Vitest, Supertest, cobertura, Playwright, Chromium y extensión de VS Code | Entorno base; PostgreSQL solo para integración con datos y pruebas de aplicación que lo utilicen |

Para instalar el navegador en cada equipo, seguir el [apartado 2 del manual de pruebas](Manual_pruebas_ReFind.md#2-descargar-el-navegador-de-pruebas). Incluye la alternativa por IPv4 si la descarga indica `timed out`. La comprobación conjunta es `npm.cmd run check:tests`, desde la raíz del proyecto.

Cada desarrollador debe ejecutar las comprobaciones en su equipo. El 01/10/2026 se comprobó en este equipo la instalación del navegador por IPv4 y la ejecución correcta de `check:tests` (HTTP y Chromium). La comprobación de la extensión de VS Code sigue pendiente; se describe en el manual de pruebas.

Este manual permite preparar y validar el entorno base sin iniciar PostgreSQL, arrancar ReFind ni ejecutar suites de pruebas. Los ejemplos de aplicación se conservan en el anexo A y no son pasos de instalación. El despliegue para usuarios finales sigue pendiente en el apartado 10.

**Estado de los archivos:** `package.json` y `package-lock.json` ya declaran las 21 dependencias y `.node-version` fija Node. Los scripts de comprobación del entorno y de las herramientas de pruebas ya están preparados. `check:tests` pasó en este equipo el 01/10/2026; los demás desarrolladores deben ejecutarlo en sus equipos. Los scripts de calidad aún no están configurados. Los bloques de configuración documentados no se consideran creados o probados salvo evidencia registrada. Esta edición solo cambia documentación; no ejecuta sus instrucciones.

**Dónde trabajar:** Windows PowerShell 5.1 externo para instaladores y preparación inicial; desde el apartado 5, terminal integrada de VS Code como usuario normal y en la raíz del repositorio. Tras cambiar el PATH, cerrar y reabrir terminal y editor. Copiar solo el contenido de los bloques, sin sus delimitadores. Los bloques JSON, JavaScript, CSS, HTML y YAML se guardan en los archivos indicados, no se ejecutan en PowerShell.

### 1.1. Instalación desde cero y preparación compartida

Se parte de Windows 11 x64 funcionando, conexión a Internet, navegador y permisos de instalación. No es necesario disponer previamente de Git, Node, npm, VS Code ni del proyecto. Abrir **Windows PowerShell** desde Inicio.

Seguir los apartados 3 y 4 para preparar herramientas y repositorio. Preparar las dependencias comunes en 5.1 y la configuración de calidad en 6. Validar en 8 y compartir los archivos según 9. Los archivos ya existentes se revisan y conservan; no se recrean.

El apartado 5.2 sirve para comprobar que la instalación compartida se puede reproducir. El recorrido de los siguientes desarrolladores está en su manual independiente.

## 2. Versiones comunes

Inventario compartido de los tres manuales. Las filas de PostgreSQL, pgAdmin, Chromium y la extensión Playwright se aplican al preparar sus respectivos bloques; no obligan a instalarlos para validar el entorno base. Los 21 paquetes npm se conservan en un único manifiesto reproducible.

Las siguientes son las versiones fijadas para todos los integrantes del equipo. Se exige coincidencia exacta en las herramientas y dependencias indicadas, aunque el equipo tenga instalada una versión más reciente. No sustituirlas por `latest` ni actualizar el archivo de bloqueo de manera individual. Si una descarga no está disponible o declara incompatibilidad, registrar el error y resolver la discrepancia en el manual y los archivos compartidos antes de continuar; no forzar la instalación.

| Elemento | Versión del entorno |
| --- | --- |
| Windows | Windows 11 x64 |
| PowerShell | Windows PowerShell 5.1, edición Desktop, incluido en Windows 11 |
| Git para Windows | 2.55.0.windows.5, exacta |
| Visual Studio Code | 1.139.0, exacta |
| Node.js | 24.21.0 LTS, exacta |
| npm | 11.19.0, exacta |
| PostgreSQL, servidor y cliente | 17.11, Windows x64 |
| pgAdmin 4 | 9.17, exacta; incluido en la instalación de PostgreSQL de ReFind |
| Chromium | Chrome Headless Shell, revisión descargada por Playwright 1.63.0 para las pruebas sin ventana |
| Extensión ESLint | 3.0.34, exacta |
| Extensión Prettier | 12.4.0, exacta |
| Extensión Playwright | 1.1.19, exacta |

| Dependencias de ejecución | Versión exacta |
| --- | --- |
| express | 5.2.1 |
| pg | 8.23.0 |
| ejs | 6.0.1 |
| bootstrap | 5.3.8 |
| zod | 4.6.5 |
| argon2 | 0.45.1 |
| express-session | 1.19.0 |
| connect-pg-simple | 10.0.0 |
| multer | 2.4.0 |
| sharp | 0.35.4 |
| nodemailer | 10.0.10 |

| Dependencias de desarrollo | Versión exacta |
| --- | --- |
| node-pg-migrate | 9.0.0 |
| vitest | 5.0.1 |
| @vitest/coverage-v8 | 5.0.1 |
| supertest | 7.3.0 |
| @playwright/test | 1.63.0 |
| eslint | 10.11.0 |
| @eslint/js | 10.0.1 |
| globals | 17.12.0 |
| prettier | 3.9.9 |
| eslint-config-prettier | 10.1.8 |

Para las dependencias transitivas, la referencia común es `package-lock.json`. Vitest y su proveedor de cobertura deben tener la misma versión. GitHub y GitHub Actions se utilizan como servicios remotos; no requieren instalar un runner en los equipos de desarrollo.

### 2.1. Decisión obligatoria antes de instalar

Consultar primero la presencia, ruta y versión de cada herramienta con los comandos de su apartado. Si `Get-Command` no encuentra el ejecutable, no ejecutar aún su consulta de versión: revisar si existe en Inicio o en su carpeta de instalación. Si no existe, seguir el paso de instalación; si existe pero no está accesible, corregir su ruta y volver a consultar.

| Resultado de la comprobación | Acción para este proyecto |
| --- | --- |
| No está instalada | Instalar y configurar la versión exacta de la tabla |
| Coincide exactamente | Conservarla y realizar la comprobación funcional |
| Es inferior | Instalar o seleccionar obligatoriamente la versión de la tabla; no continuar usando la detectada |
| Es superior o cualquier otra distinta | Seleccionar o instalar igualmente la versión de la tabla |
| Hay varias instalaciones | Comprobar cuál resuelve la terminal y seleccionar la fijada para ReFind |
| Los archivos compartidos contradicen el manual | Corregir la discrepancia conjuntamente antes de instalar; no elegir una versión diferente por cuenta propia |

Cambiar la versión utilizada por ReFind no exige borrar instalaciones, configuraciones o datos de otros proyectos. Si una herramienta existente se utiliza en otro trabajo, conservarla y utilizar una instalación separada cuando el fabricante lo permita. No intentar degradar un directorio de datos PostgreSQL con binarios de otra versión.

Todos usarán Windows PowerShell 5.1 Desktop; los números de compilación y revisión que dependen de las actualizaciones de Windows se registran, pero no se exige igualarlos ni desinstalar actualizaciones del sistema. Chromium queda fijado por Playwright y las dependencias transitivas por el lockfile. GitHub y Actions son servicios remotos, sin versión local que seleccionar.

Las actualizaciones de herramientas y paquetes se incorporarán de forma coordinada: actualizar la tabla y los archivos compartidos, comprobarlos y comunicar el cambio a todos. No aceptar actualizaciones individuales del conjunto fijado durante la reproducción del entorno.

Referencias de las versiones seleccionadas: [Git](https://github.com/git-for-windows/git/releases/tag/v2.55.0.windows.5), [VS Code](https://code.visualstudio.com/updates/v1_139), [Node](https://nodejs.org/es/blog/release/v24.21.0), [PostgreSQL](https://www.postgresql.org/docs/17/release.html) y [pgAdmin](https://www.pgadmin.org/news/).

## 3. Instalación de herramientas

**Dónde:** PowerShell externo, usuario normal, cualquier carpeta. Aquí se consulta también `$PSVersionTable.PSVersion`. Las excepciones de instalación se indican en cada apartado.

Antes del primer paso, abrir **Windows PowerShell** desde Inicio y consultar `$PSVersionTable`. Si se abre PowerShell 7, cerrar esa terminal y abrir **Windows PowerShell**; no es necesario desinstalar PowerShell 7. En VS Code, seleccionar también **Windows PowerShell** como perfil de terminal.

```powershell
$PSVersionTable
```

En el resultado, `Major = 5` y `Minor = 1` identifican PowerShell 5.1; `Build` y `Revision` son la compilación y revisión. No es necesario que estos dos últimos valores coincidan entre desarrolladores. La comprobación exige `PSVersion` 5.1 y `PSEdition` Desktop.

Copiar únicamente los comandos, sin el prefijo de la terminal (`PS C:\...>`) ni las salidas de ejemplo. Ejecutarlos uno a uno. El mensaje sobre el tiempo de carga de perfiles no es un error de instalación. Si el prompt empieza por `(base)`, puede haber un entorno Conda activo: comparar las rutas de `Get-Command` y las versiones reales antes de continuar; ese prefijo por sí solo no invalida la comprobación.

### 3.1. Git

**Dónde:** comprobación y validación en PowerShell externo, usuario normal, cualquier carpeta. La instalación o actualización se realiza con el instalador gráfico de Git para Windows; aceptar elevación solo si el instalador la solicita. Volver después a una terminal externa nueva sin elevar.

Versión fijada: **2.55.0.windows.5**, exacta. Aplicar la tabla de decisión del apartado 2.1.

**Comprobación previa:**

```powershell
Get-Command git -ErrorAction SilentlyContinue
git --version
```

`Get-Command` muestra dónde se encuentra Git. Su columna `Version` puede mostrar `2.55.0.5`; `git --version` identifica la revisión completa, por ejemplo `git version 2.55.0.windows.5`. Utilizar esta segunda salida para comparar con la versión fijada. Si `Get-Command` no devuelve nada, revisar instalación y PATH.

Si coincide exactamente, conservarlo. Si falta o difiere, descargar el instalador x64 de la [publicación 2.55.0.windows.5](https://github.com/git-for-windows/git/releases/tag/v2.55.0.windows.5), ejecutarlo y habilitar Git desde la línea de comandos. Si otra instalación debe conservarse, utilizar la distribución PortableGit de esa misma publicación en una carpeta separada y seleccionar su carpeta `cmd` en el PATH de la terminal del proyecto. Reabrir PowerShell y repetir `Get-Command git` y `git --version`: deben identificar la instalación elegida y la versión exacta.

**Validación:** el comando devuelve la versión y Git está disponible en la terminal.

### 3.2. VS Code

**Dónde:** comprobación y validación en PowerShell externo, usuario normal, cualquier carpeta. La instalación o cambio de versión se realiza con el instalador de la revisión exacta de VS Code. No abrir VS Code como administrador.

Versión fijada: **1.139.0 estable**, exacta. Aplicar el apartado 2.1.

**Comprobación previa:**

```powershell
Get-Command code -ErrorAction SilentlyContinue
code --version
```

En `Get-Command`, `code.cmd` puede aparecer con versión `0.0.0.0`; no es la versión del editor. `code --version` devuelve tres líneas: versión del editor, identificador de compilación y arquitectura. La primera debe ser `1.139.0` exactamente; `x64` indica arquitectura de 64 bits.

Si la aplicación existe pero no se reconoce `code`, revisar su incorporación al PATH. Si falta o difiere, descargar el instalador de usuario x64 desde la [publicación 1.139](https://code.visualstudio.com/updates/v1_139), instalar exactamente 1.139.0 y activar la opción de añadir al PATH. No usar «Buscar actualizaciones» para seleccionar esta revisión. Si se necesita conservar otro VS Code, utilizar la distribución ZIP de 1.139.0 en una carpeta separada y su ejecutable, siguiendo el [modo portable](https://code.visualstudio.com/docs/editor/portable); comprobar que `code` apunta a su carpeta `bin`.

#### Configurar manualmente las actualizaciones de VS Code y sus extensiones

**Dónde:** dentro de VS Code, en la configuración de **usuario**. Estas preferencias afectan al editor utilizado por ese usuario y a sus extensiones, también cuando abre otros proyectos. No se guardan en el archivo `.vscode/settings.json` del repositorio.

1. Abrir VS Code y pulsar **Ctrl + Shift + P**.
2. Buscar y seleccionar **Preferences: Open User Settings (JSON)** o **Preferencias: Abrir configuración de usuario (JSON)**. Se abrirá el archivo personal `settings.json`.
3. Revisar si ya existen las propiedades `update.mode`, `extensions.autoUpdate` y `extensions.autoCheckUpdates`. Si existen, modificar sus valores; si faltan, añadirlas dentro de las llaves exteriores `{ }`, conservando todas las demás preferencias.

Si el archivo está vacío o contiene únicamente `{}`, dejarlo así:

```json
{
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false
}
```

Si ya contiene otras preferencias, **no sustituir el archivo completo por este bloque**. Añadir las tres propiedades dentro del objeto existente, separándolas de las demás mediante comas. No añadir otro par de llaves exteriores, no duplicar propiedades y no copiar los delimitadores del bloque de código. Escribir `false` sin comillas.

| Propiedad | Valor | Efecto |
| --- | --- | --- |
| `update.mode` | `"none"` | Desactiva las actualizaciones automáticas de VS Code |
| `extensions.autoUpdate` | `false` | Desactiva las actualizaciones automáticas de las extensiones |
| `extensions.autoCheckUpdates` | `false` | Desactiva la búsqueda automática de actualizaciones de extensiones |

Estas entradas no cambian las versiones instaladas ni impiden modificarlas manualmente. Tampoco controlan Node, npm, PostgreSQL o las dependencias del proyecto. Las actualizaciones del conjunto se coordinarán según 2.1; las extensiones de análisis y formato se instalan en 6.2 y la de Playwright en el manual de pruebas.

4. Guardar con **Ctrl + S** y comprobar que VS Code no señala errores de sintaxis en las entradas editadas.
5. Cerrar VS Code y volver a abrirlo.
6. Abrir de nuevo la configuración de usuario mediante los pasos 1–2 y confirmar que las tres propiedades conservan los valores indicados.
7. En PowerShell externo, ejecutar:

```powershell
code --version
```

**Validación:** el editor abre, la primera línea devuelve exactamente `1.139.0` y las tres preferencias quedan guardadas. La consulta de versión comprueba el editor instalado; la revisión del archivo comprueba la configuración. Registrar ambos resultados por separado y no marcar la configuración como comprobada hasta completar los dos controles.

Referencia: [configuración de usuario y del espacio de trabajo en VS Code](https://code.visualstudio.com/docs/configure/settings).

### 3.3. Node.js y npm

**Dónde:** consultas de versión y validación en PowerShell externo, usuario normal, cualquier carpeta. Si se utiliza el MSI, ejecutar el instalador gráfico y aceptar la elevación que solicite. Si se utiliza nvm-windows, ejecutar `nvm install` y `nvm use` en PowerShell externo como administrador; cerrar esa ventana al terminar y verificar desde otra sin elevar. El ajuste global de npm se ejecuta en PowerShell externo; si la ubicación de Node exige elevación, usar una ventana externa de administrador solo para ese ajuste. No ejecutar estas operaciones desde VS Code.

Versiones del proyecto: **Node 24.21.0 LTS y npm 11.19.0**, exactas.

**Comprobación previa:**

```powershell
Get-Command node,npm.cmd,nvm -ErrorAction SilentlyContinue
node --version
npm.cmd --version
```

Si se detecta nvm-windows, consultar también:

```powershell
nvm version
nvm list
```

`nvm version` identifica el gestor, no Node. `nvm list` enumera las versiones de Node disponibles y señala la activa. Si ya aparece `24.21.0`, basta con seleccionarla mediante `nvm use 24.21.0`; no repetir su instalación. Si no aparece, instalarla primero. Si falla `nvm install`, detenerse y resolver el error antes de ejecutar `nvm use`.

Comparar Node y npm con las versiones acordadas en el apartado 2. Si el proyecto ya dispone de `.node-version` y `package.json`, consultar primero esos archivos. Conservar la instalación únicamente si coincide exactamente con las versiones fijadas.

Si hay que instalar o seleccionar otra versión, elegir un único procedimiento:

- **Con nvm-windows ya disponible:** si falta la versión, ejecutar `nvm install 24.21.0`; después ejecutar `nvm use 24.21.0`. Ambos comandos se ejecutan en PowerShell externo como administrador. La versión anterior seguirá instalada.
- **Sin gestor de versiones:** descargar el MSI x64 de [Node.js 24.21.0](https://nodejs.org/es/blog/release/v24.21.0) e incluir Node, npm y PATH. No instalar nvm adicionalmente como requisito de este manual.

No mezclar un instalador MSI con una instalación administrada por nvm. No instalar npm por separado antes de comprobar la versión que acompaña a Node. Si después de seleccionar Node 24.21.0 `npm.cmd --version` no devuelve 11.19.0, ejecutar manualmente `npm.cmd install --global npm@11.19.0` y repetir la comprobación.

**Validación:** en una terminal nueva, `node --version` y `npm.cmd --version` devuelven las versiones acordadas.

Cerrar la ventana de administrador y abrir PowerShell externo como usuario normal. Ejecutar:

```powershell
node --version
npm.cmd --version
```

Resultados esperados, respectivamente: `v24.21.0` y `11.19.0`. El `0.0.0.0` que pueda mostrar `Get-Command` para `npm.cmd` o `nvm.exe` no sustituye estas consultas de versión.

## 4. Preparación del repositorio

### 4.1. Comprobar o clonar

**Dónde:** PowerShell externo, usuario normal. Para comprobar si existe la carpeta o clonar, situarse en la carpeta que contendrá el proyecto; para los comandos `git rev-parse`, `git remote` y `git status`, entrar en la raíz del repositorio. No hacen falta permisos de administrador.

Desde la carpeta que se desea utilizar, comprobar primero:

```powershell
Get-Location
Test-Path -LiteralPath '.\Proyecto-Ingenieria-Software'
```

La ruta que empieza por `.\` se busca dentro de la ubicación actual. Si el resultado es `False`, solo significa que esa subcarpeta no existe allí; no demuestra que el repositorio no esté en otra ubicación. Si ya se dispone de una copia, localizarla en el Explorador de Windows y copiar su ruta completa antes de decidir clonar.

Para entrar en esa copia, sustituir la ruta del siguiente comando por la del desarrollador, conservando las comillas:

```powershell
Set-Location -LiteralPath 'C:\RUTA\AL\Proyecto-Ingenieria-Software'
```

Este comando cambia la carpeta de trabajo; no mueve ni modifica archivos. Si da error, no continuar con los comandos Git hasta corregir la ruta.

Si la carpeta existe, entrar en ella y comprobar:

```powershell
git rev-parse --show-toplevel
git remote get-url origin
git status --short
```

Interpretar las salidas antes de continuar:

| Comando | Resultado esperado |
| --- | --- |
| `git rev-parse --show-toplevel` | Ruta completa de la raíz del proyecto; puede mostrarse con `/` en lugar de `\` |
| `git remote get-url origin` | `https://github.com/jesusJoana/Proyecto-Ingenieria-Software.git` como URL simple |
| `git status --short` | Sin salida si no hay cambios; `??` identifica archivos nuevos no seguidos por Git y `M` archivos modificados |

Los archivos nuevos o modificados no impiden continuar con la preparación. Revisarlos sin borrarlos ni añadirlos a Git automáticamente. Estos tres comandos solo consultan el repositorio.

Si ya se está dentro del repositorio, ejecutar directamente esas tres comprobaciones. La raíz debe coincidir con el proyecto y el remoto con `https://github.com/jesusJoana/Proyecto-Ingenieria-Software.git`. Si la carpeta existe pero no es el clon correcto, resolver su ubicación antes de continuar; no clonar encima.

Solo si no existe una copia del proyecto en la ubicación elegida:

```powershell
git clone https://github.com/jesusJoana/Proyecto-Ingenieria-Software.git
Set-Location -LiteralPath '.\Proyecto-Ingenieria-Software'
```

### 4.2. Identidad y apertura

**Dónde:** PowerShell externo, usuario normal, desde la raíz del repositorio. Ejecutar ahí las consultas de identidad, su configuración si procede y `code .`. A partir del apartado 5, usar la terminal PowerShell integrada salvo que se indique expresamente otra cosa.

**Comprobación previa:**

```powershell
git config --get user.name
git config --get user.email
```

Ambas consultas deben mostrar la identidad que el desarrollador quiere usar en sus commits. Si no hay salida, falta ese valor. Si los valores son correctos, conservarlos y pasar a la apertura del proyecto.

Si faltan o no corresponden al desarrollador, configurar valores locales al repositorio:

```powershell
git config --local user.name 'TU NOMBRE'
git config --local user.email 'TU CORREO'
```

Sustituir los textos por los datos del desarrollador. Repetir la consulta de identidad. Tanto si se ha cambiado la identidad como si ya era correcta, abrir el proyecto desde su raíz:

```powershell
code .
```

Revisar el README y los documentos de la práctica. En VS Code, abrir **Terminal > Nuevo terminal**, seleccionar el perfil **PowerShell** y ejecutar `Get-Location` para confirmar que la terminal integrada está en la raíz del repositorio.

**Cierre de herramientas y repositorio:** Git, VS Code, Node y npm disponibles, versiones registradas y repositorio correcto. Continuar con las dependencias y la validación del entorno base. PostgreSQL se prepara mediante su manual independiente.

## 5. Instalación de todas las dependencias del proyecto

**Dónde:** raíz del repositorio, PowerShell integrado y VS Code sin elevar permisos.

**Elegir un solo recorrido para este apartado:**

| Quién prepara el equipo | Recorrido |
| --- | --- |
| Responsable de preparar y comprobar por primera vez el entorno compartido | Seguir 5.1 para registrar las dependencias con `npm install`, preparar los archivos comunes del apartado 6 y compartirlos después de comprobarlos |
| Compañero que clona el repositorio con esa preparación ya publicada | Omitir 5.1 y seguir 5.2: instalar todas las dependencias mediante `npm ci` y completar únicamente la preparación local y las comprobaciones |

Los apartados 5.1 y 5.2 son alternativas según el estado del repositorio, no dos instalaciones consecutivas. El recorrido para los compañeros se resume en el apartado 9.

### 5.1. Preparación inicial de las dependencias: responsable del entorno

Este paso lo realiza una vez quien prepara los archivos compartidos. Los compañeros que reciban esos archivos completos siguen el apartado 5.2. Los paquetes relacionados con base de datos y pruebas se instalan también con el manifiesto común, pero su preparación funcional se valida en los otros manuales.

**Comprobación previa, después de clonar y desde la raíz del repositorio:**

```powershell
Get-Location
Test-Path -LiteralPath package.json
Test-Path -LiteralPath package-lock.json
Test-Path -LiteralPath .node-version
```

Si los archivos están en el repositorio remoto pero faltan en la copia, comprobar la carpeta y la revisión descargadas antes de continuar. No generar un proyecto distinto para suplir un clon incompleto.

Si se está preparando por primera vez el proyecto compartido y todavía no existe `package.json`, ejecutar manualmente `npm.cmd init -y` en su raíz y configurar el archivo según los pasos siguientes. Si ya existe, conservarlo y editar los campos necesarios. Crear `.node-version` desde VS Code si falta. `package-lock.json` se generará al instalar las dependencias del paso 5; no escribirlo manualmente. Antes de esa primera instalación, revisar la licencia y el resto de datos generados por `npm init` para que correspondan al repositorio.

1. Conservar los datos existentes de `package.json` y establecer `private: true`, `type: "module"`, `engines.node: "24.21.0"` y `packageManager: "npm@11.19.0"`. Mantener nombre, versión, repositorio y licencia del proyecto.
2. Comprobar que `.node-version` contiene únicamente `24.21.0`.
3. Añadir a `.gitignore`, si faltan, las siguientes entradas:

```gitignore
node_modules/
.env
.env.*
!.env.example
coverage/
playwright-report/
test-results/
var/
```

4. Consultar los requisitos de los 21 paquetes npm del entorno. Copiar el bloque completo siguiente en PowerShell integrado, desde la raíz del repositorio y sin permisos de administrador. El bloque solo consulta el registro npm: no instala paquetes ni modifica archivos. Cada encabezado identifica el paquete al que pertenece la salida. Esta consulta corresponde al responsable de preparar la selección compartida; los compañeros que la reproduzcan siguen 5.2.

```powershell
$paquetesReFind = @(
    'express@5.2.1'
    'pg@8.23.0'
    'ejs@6.0.1'
    'bootstrap@5.3.8'
    'zod@4.6.5'
    'argon2@0.45.1'
    'express-session@1.19.0'
    'connect-pg-simple@10.0.0'
    'multer@2.4.0'
    'sharp@0.35.4'
    'nodemailer@10.0.10'
    'node-pg-migrate@9.0.0'
    'vitest@5.0.1'
    '@vitest/coverage-v8@5.0.1'
    'supertest@7.3.0'
    '@playwright/test@1.63.0'
    'eslint@10.11.0'
    '@eslint/js@10.0.1'
    'globals@17.12.0'
    'prettier@3.9.9'
    'eslint-config-prettier@10.1.8'
)

foreach ($paqueteReFind in $paquetesReFind) {
    Write-Output ""
    Write-Output "===== $paqueteReFind ====="
    npm.cmd view $paqueteReFind engines peerDependencies peerDependenciesMeta --json
    Write-Output "Código de salida: $LASTEXITCODE"
}
```

**Revisión de resultados antes de instalar:**

- Conservar la salida completa, incluidos los mensajes de error y el código de salida de cada consulta. El bloque continúa consultando los demás paquetes aunque alguno falle.
- Comprobar que los rangos de `engines` admiten Node **24.21.0** y, cuando se declare un requisito de npm, npm **11.19.0**.
- Contrastar los requisitos de `peerDependencies` con las versiones del conjunto seleccionado. Si aparece un paquete adicional o una incompatibilidad, revisar si el requisito es obligatorio u opcional antes de modificar la selección; no instalar dependencias adicionales automáticamente.
- Un código de salida `0` indica que la consulta terminó correctamente; no demuestra por sí solo compatibilidad. Una salida vacía con código `0` puede indicar que el paquete no declara esos campos.
- Si una consulta devuelve un código distinto de `0`, resolver el error y repetirla. No continuar con el paso 5 mientras queden errores de consulta o incompatibilidades sin resolver.

Registrar esta revisión como pendiente hasta examinar los resultados. La compatibilidad declarada se completará con las comprobaciones funcionales del manual después de instalar y configurar el conjunto. Este bloque no consulta Git, VS Code, PostgreSQL ni las extensiones; sus comprobaciones se realizan en sus respectivos apartados.

5. Incorporar e instalar el conjunto completo con estos dos comandos, comprobando que cada uno termina sin errores. Este paso corresponde al responsable que prepara las dependencias compartidas; los compañeros que clonen el resultado no repiten estos comandos:

```powershell
npm.cmd install --save-exact express@5.2.1 pg@8.23.0 ejs@6.0.1 bootstrap@5.3.8 zod@4.6.5 argon2@0.45.1 express-session@1.19.0 connect-pg-simple@10.0.0 multer@2.4.0 sharp@0.35.4 nodemailer@10.0.10
npm.cmd install --save-dev --save-exact node-pg-migrate@9.0.0 vitest@5.0.1 @vitest/coverage-v8@5.0.1 supertest@7.3.0 @playwright/test@1.63.0 eslint@10.11.0 @eslint/js@10.0.1 globals@17.12.0 prettier@3.9.9 eslint-config-prettier@10.1.8
```

No utilizar `--force`, `--legacy-peer-deps` ni instalar paquetes globalmente. Si Argon2 o Sharp no pueden instalar su binario, conservar el error y comprobar plataforma, arquitectura y acceso a las descargas; no añadir compiladores o herramientas ajenas a este procedimiento automáticamente.

Antes de compartir el resultado, revisar `git diff -- package.json package-lock.json`: el primer comando debe haber registrado los paquetes de ejecución en `dependencies`; el segundo, los de desarrollo en `devDependencies`. `--save-exact` fija las versiones directas sin rangos y npm genera o actualiza el lockfile con las dependencias resueltas. Comprobar el conjunto y compartir ambos archivos en el mismo cambio, junto con la configuración común descrita en el manual. No compartir `node_modules`.

### 5.2. Instalación después de clonar: demás desarrolladores

Recibir una revisión del repositorio que incluya las dependencias, el lockfile y todos los archivos documentados. Los archivos se obtienen mediante el clon del apartado 4. No ejecutar `npm init` en este recorrido. Si todavía falta la configuración compartida, debe completarse mediante 5.1 antes de reproducirla.

Si existe `node_modules`, consultar primero `npm.cmd ls --depth=0` y comparar las versiones con las tablas; una instalación ausente, incompleta o diferente se sustituye localmente mediante `npm.cmd ci`. Si todas coinciden, se puede conservar la instalación y pasar a las comprobaciones funcionales. Para una instalación nueva, con las versiones exactas de Node y npm del apartado 2:

```powershell
node --version
npm.cmd --version
npm.cmd ci
npm.cmd ls --depth=0
```

`npm ci` instala en una sola operación el conjunto de paquetes ya registrado, incluidos Express, EJS, Bootstrap, Vitest y las demás dependencias. No hay que indicar sus nombres ni instalarlos uno a uno. Para asegurar que también se instalen las dependencias de desarrollo aunque la terminal tenga una configuración que las omita, utilizar `npm.cmd ci --include=dev` en lugar de `npm.cmd ci`.

`npm ci` reconstruye `node_modules` a partir del lockfile y no modifica `package.json` ni `package-lock.json`. No ejecutarlo con un servidor o pruebas del proyecto abiertos. Si el manifiesto y el lockfile no coinciden, corregirlos en la configuración común; no borrar el lockfile ni sustituir el comando por `npm install` para sortear el error.

Después de instalar las dependencias, continuar con el apartado 6 y la validación parcial de 8. Conservar los archivos compartidos recibidos por Git. No crear todavía los archivos de aplicación de los anexos, las variables de base de datos ni las configuraciones de pruebas para cerrar este bloque.

**Comprobación para ambos recorridos:** `npm.cmd ls --depth=0` debe mostrar todas las dependencias de las tablas, sin ausentes, inválidas ni sobrantes. Verificar el JSON con:

```powershell
node -e "JSON.parse(require('node:fs').readFileSync('package.json', 'utf8')); console.log('package.json válido')"
```

### 5.3. Qué comando utilizar

| Situación | Comando y resultado |
| --- | --- |
| Incorporar una dependencia de ejecución acordada | `npm.cmd install --save-exact PAQUETE@VERSION`: instala y registra el paquete en `package.json` y actualiza el lockfile |
| Incorporar una dependencia de desarrollo acordada | `npm.cmd install --save-dev --save-exact PAQUETE@VERSION`: realiza lo mismo en `devDependencies` |
| Instalar las dependencias ya declaradas con `npm install` sin nombres | `npm.cmd install`: instala lo declarado y puede generar o actualizar el lockfile; no descubre ni añade herramientas que no estén declaradas |
| Reproducir el conjunto compartido tras clonar o recibir cambios de dependencias | `npm.cmd ci --include=dev`: instala el conjunto fijado sin reescribir los dos archivos compartidos |

Los comandos con `PAQUETE@VERSION` describen el mantenimiento del proyecto; no se ejecutan literalmente ni son pasos adicionales para quien clona. Una incorporación futura de dependencias se prepara y comprueba una vez, se comparten ambos archivos npm y los demás reproducen el cambio mediante `npm ci`. Node y VS Code se preparan en este manual; PostgreSQL y la extensión Playwright, en sus manuales: no los instala este comando.

Referencias: [npm install](https://docs.npmjs.com/cli/v11/commands/npm-install/) y [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

## 6. ESLint, Prettier y extensiones de VS Code

### 6.1. Configuración compartida

El responsable prepara una vez estos archivos; quien clona los conserva y comprueba. No requieren PostgreSQL ni un servidor Express. Crear `eslint.config.js`:

```javascript
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'var/**'] },
  js.configs.recommended,
  { files: ['**/*.js', '**/*.cjs'], languageOptions: { globals: globals.node } },
  { files: ['public/**/*.js'], languageOptions: { globals: globals.browser } },
  prettier,
];
```

Crear `.prettierrc.json`:

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "endOfLine": "lf"
}
```

Crear `.prettierignore`:

```text
node_modules/
coverage/
playwright-report/
test-results/
var/
package-lock.json
.env
.env.*
```

Integrar únicamente estas entradas en `scripts` de `package.json`, conservando el resto si existe:

```json
{
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

Ejecutar `npm.cmd run lint` y `npm.cmd run format:check`. Si hay diferencias de formato, revisarlas y aplicar `npm.cmd run format`; este último comando sí modifica los archivos compatibles del repositorio. Revisar `git diff` antes de compartirlos y repetir ambas comprobaciones. No excluir archivos de aplicación o pruebas para ocultar errores. EJS se comprueba mediante renderizado y navegador; no se añade un plugin de formato para él.

**Resultado esperado:** cero errores de ESLint y comprobación de formato correcta. Añadir temporalmente una referencia a una variable inexistente en un archivo JS y confirmar que `lint` falla; retirarla y repetir con éxito. Referencia: [configuración de ESLint](https://eslint.org/docs/latest/use/configure/configuration-files).

### 6.2. Instalación y configuración de extensiones

En VS Code, abrir Extensiones y buscar e instalar las dos extensiones por su identificador, comprobando el editor publicado en Marketplace:

| Extensión | Identificador | Versión exacta | Editor |
| --- | --- | --- | --- |
| ESLint | `dbaeumer.vscode-eslint` | 3.0.34 | Microsoft |
| Prettier | `esbenp.prettier-vscode` | 12.4.0 | Prettier |

Antes y después de la instalación, consultar en PowerShell integrado:

```powershell
code --list-extensions --show-versions
```

Si coinciden exactamente, conservarlas. Si falta alguna o difiere, instalar la revisión fijada: en el menú de la extensión, utilizar **Install Another Version... / Instalar otra versión...** y seleccionar la indicada. Como alternativa, ejecutar manualmente únicamente los comandos de las extensiones que falten o difieran:

```powershell
code --install-extension dbaeumer.vscode-eslint@3.0.34
code --install-extension esbenp.prettier-vscode@12.4.0
```

Reiniciar VS Code y repetir la lista con versiones: deben aparecer los dos identificadores con las revisiones exactas. Mantener desactivada su actualización automática como se indica en 3.2. Referencias: [ESLint](https://github.com/microsoft/vscode-eslint/releases), [Prettier](https://github.com/prettier/prettier-vscode/releases/tag/v12.4.0), [Playwright](https://github.com/microsoft/playwright-vscode/releases/tag/v1.1.19) e [instalación de versiones de extensiones](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace). En la configuración del espacio de trabajo, integrar estas entradas de `.vscode/settings.json` sin sustituir otras preferencias:

```json
{
  "editor.formatOnSave": true,
  "[javascript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[css]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "eslint.validate": ["javascript"]
}
```

**Comprobación:** introducir y retirar un error de variable no definida y comprobar el aviso de ESLint; desordenar el formato de un JS, guardarlo y comprobar Prettier. Los mismos controles deben pasar desde npm, independientemente del editor.


## 7. Estructura de carpetas y archivos del proyecto

Este mapa distingue los archivos existentes de la estructura prevista. No obliga a crear todas las carpetas al instalar el entorno. Los ejemplos de los anexos se prepararán durante el desarrollo.

| Ruta | Contenido | Estado y preparación |
| --- | --- | --- |
| `README.md`, `LICENSE` | Información del repositorio y licencia | Existentes |
| `docs/` | Documentación y los tres manuales | Existente |
| `package.json`, `package-lock.json` | Dependencias y scripts | Existentes; 21 paquetes registrados, scripts aún pendientes |
| `.node-version`, `.gitignore` | Versión de Node y exclusiones | Existentes; revisar las entradas documentadas |
| `.vscode/` | Preferencias compartidas del proyecto | Carpeta existente; configuración del apartado 6 pendiente de confirmar |
| `node_modules/` | Paquetes instalados en cada equipo | Instalado localmente; generado por npm, excluido de Git |
| `eslint.config.js`, `.prettierrc.json`, `.prettierignore` | Configuración de calidad | Preparar en 6; quien clona no los recrea |
| `.env.example` | Plantilla de configuración sin secretos | Preparar al conectar la aplicación, según manual de base de datos |
| `.env.development`, `.env.test`, `.env.e2e` | Configuración local con secretos | Preparación posterior por equipo; excluida de Git |
| `src/` | Código, servidor y configuración de ReFind | Desarrollo posterior; ejemplos en anexo A |
| `views/` | Vistas EJS | Desarrollo posterior |
| `public/css/`, `public/js/` | Recursos propios del navegador | Desarrollo posterior; JavaScript cliente cuando sea necesario |
| `scripts/` | Comandos auxiliares | Desarrollo posterior; ejemplos en manual de base de datos |
| `migrations/` | Cambios del esquema de la aplicación | Desarrollo posterior; no necesarios para instalar PostgreSQL |
| `tests/setup/` | Comprobaciones aisladas de herramientas de pruebas | Manual de pruebas |
| `tests/unit/`, `tests/integration/`, `tests/e2e/` | Pruebas del software que se desarrolle | Manual de pruebas, anexo A |
| `vitest.setup.config.js`, `playwright.setup.config.js` | Configuración de comprobaciones aisladas | Manual de pruebas |
| `vitest.config.js`, `playwright.config.js` | Configuración de pruebas de la aplicación | Manual de pruebas, anexo A |
| `.github/workflows/` | Integración continua | Manual de pruebas, anexo B |
| `coverage/`, `playwright-report/`, `test-results/` | Informes generados | Locales, excluidos de Git |
| `var/uploads/development/`, `var/uploads/test/`, `var/uploads/e2e/` | Fotografías locales separadas por uso | Desarrollo posterior; excluidas de Git |

El directorio de datos PostgreSQL se sitúa fuera del repositorio y de OneDrive. La configuración de **usuario** de VS Code no pertenece a `.vscode/` del proyecto. Quien clona recibe los archivos publicados, pero prepara localmente sus secretos y los archivos generados.

## 8. Validación parcial del entorno base

No requiere PostgreSQL, el arranque de ReFind ni los ejecutores de pruebas. No ejecutar los anexos para cerrar esta instalación.

### 8.1. Versiones y archivos compartidos

1. Confirmar las versiones de PowerShell, Git, VS Code, Node y npm con los comandos de 3. Confirmar remoto e identidad Git según 4.
2. Reabrir las preferencias de usuario de VS Code y comprobar los tres valores de 3.2. La versión del editor no acredita esas preferencias.
3. Ejecutar `npm.cmd ls --depth=0`: deben aparecer los 21 paquetes con sus versiones exactas, sin dependencias directas ausentes o inválidas.
4. Comprobar sintaxis y coherencia de las versiones directas mediante esta consulta de lectura, desde PowerShell:

```powershell
node --input-type=module -e "import { readFileSync } from 'node:fs'; const p = JSON.parse(readFileSync('package.json', 'utf8')); const l = JSON.parse(readFileSync('package-lock.json', 'utf8')); let count = 0; for (const group of ['dependencies', 'devDependencies']) { const a = p[group] ?? {}; const b = l.packages[''][group] ?? {}; if (Object.keys(a).length !== Object.keys(b).length) throw new Error('Discrepancia en ' + group); for (const [name, version] of Object.entries(a)) { if (b[name] !== version || l.packages['node_modules/' + name]?.version !== version) throw new Error('Discrepancia: ' + name); count++; } } console.log('JSON válidos; dependencias directas coherentes:', count);"
```

Resultado esperado: JSON válidos y **21** dependencias directas coherentes. El número se actualizará cuando se incorporen paquetes de forma coordinada.

### 8.2. Carga básica sin servidor ni base de datos

Estas comprobaciones no instalan nada, no guardan archivos ni arrancan servicios. Ejecutarlas una a una y detenerse ante cualquier error.

**Carga de los paquetes de ejecución y presencia de recursos Bootstrap:**

```powershell
node --input-type=module -e "import { readFileSync } from 'node:fs'; const p = JSON.parse(readFileSync('package.json', 'utf8')); for (const name of Object.keys(p.dependencies).filter(name => name !== 'bootstrap')) { await import(name); console.log('Carga correcta:', name); } for (const file of ['css/bootstrap.min.css', 'js/bootstrap.bundle.min.js']) { if (!readFileSync('node_modules/bootstrap/dist/' + file).length) throw new Error('Recurso vacío: ' + file); } console.log('Recursos Bootstrap disponibles');"
```

**Argon2, cálculo y verificación en memoria:**

```powershell
node --input-type=module -e "import argon2 from 'argon2'; const hash = await argon2.hash('prueba-local-refind', { type: argon2.argon2id }); console.log('Contraseña correcta:', await argon2.verify(hash, 'prueba-local-refind')); console.log('Contraseña incorrecta:', await argon2.verify(hash, 'otra-clave'));"
```

Resultados esperados: carga correcta de los diez paquetes de ejecución distintos de Bootstrap, recursos Bootstrap disponibles y verificación de contraseña `true` / `false`. Esto verifica carga básica; la conexión SQL, sesiones persistentes, formularios y recorridos funcionales corresponden a los otros bloques o al desarrollo.

### 8.3. Análisis, formato y extensiones

Completar 6 y ejecutar `npm.cmd run lint` y `npm.cmd run format:check`. Ambos deben terminar sin errores. Confirmar las dos extensiones y sus comprobaciones de 6.2. No se necesitan pruebas de aplicación.

### 8.4. Incidencia pendiente: scripts de instalación de Argon2

La instalación de Jesús mostró un aviso de scripts no cubiertos por `allowScripts` para `argon2@0.45.1`. El script declarado en el paquete local coincide con el registro: `cross-env ZERO_AR_DATE=1 node-gyp-build`. La prueba de hash devolvió `true` para la contraseña correcta y `false` para la incorrecta. El aviso alternativo con `node-gyp rebuild` no está explicado.

**Funcionamiento local comprobado; tratamiento del aviso y reproducción con `npm ci` pendientes.** No se ha validado una reinstalación ni aprobado el script como parte del procedimiento. No indicar aprobaciones o recompilaciones automáticas a los compañeros. Para consultar el estado sin modificar el manifiesto:

```powershell
npm.cmd install-scripts ls
```

Referencia: [gestión de scripts de instalación de npm](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/).

### 8.5. Registro parcial

Evidencias comunicadas por Jesús y revisión de sus archivos en esta conversación. Fecha individual y commit: por registrar. Cada compañero inicia su propio registro como pendiente.

| Elemento | Evidencia | Estado |
| --- | --- | --- |
| PowerShell | 5.1.26100.9549, Desktop | Comprobado |
| Git | 2.55.0.windows.5 | Versión comprobada; identidad y remoto por confirmar |
| VS Code | 1.139.0 x64 | Versión comprobada |
| Preferencias de actualización | Falta confirmación tras guardar y reiniciar | Pendiente |
| Node y npm | 24.21.0 y 11.19.0 | Comprobados |
| nvm existente | 1.2.2, Node 24.21.0 x64 activo | Comprobado |
| Dependencias npm | 11 de ejecución y 10 de desarrollo, versiones exactas | Instaladas y versiones comprobadas |
| Manifiesto y lockfile | JSON válidos, versiones directas coincidentes | Comprobado mediante lectura |
| Argon2 | Hash y verificación correcta/incorrecta | Funcionamiento local comprobado |
| Carga conjunta de 8.2 | Resultado completo todavía no recibido | Pendiente |
| Calidad y extensiones | Paquetes instalados; configuración y controles sin confirmar | Pendiente |
| Aviso `allowScripts` y reproducción limpia | Sin resolver ni comprobar mediante `npm ci` | Pendiente |

Cerrar la validación parcial cuando pasen 8.1–8.3. Resolver y comprobar 8.4 antes de presentar la instalación como completamente reproducible. La validación parcial no acredita PostgreSQL ni el entorno de pruebas.

## 9. Entregar la preparación a los siguientes desarrolladores

El responsable comparte los archivos npm, `.node-version`, `.gitignore`, configuración común de 6 y manuales, después de revisar `git diff` y `git status --short`. No incluir secretos, datos, informes ni `node_modules`. No se necesita crear los ejemplos del anexo para compartir el entorno base.

Entregar el [manual de incorporación de desarrolladores](Manual_entorno_ReFind_resumido.md) una vez publicada y comprobada la configuración común.

**Recorrido definido, pendiente de validar en una instalación limpia y de resolver el tratamiento de `allowScripts`.**
## Anexo A. Ejemplos de desarrollo: fuera de la instalación base

Se conservan como referencia para desarrollar ReFind. No ejecutar estos pasos para validar la instalación base. Requieren una configuración de aplicación y migraciones todavía pendientes de desarrollo, además de los archivos de pruebas de su manual cuando se invoquen esos scripts. Todos los ejemplos siguen pendientes de comprobación. Quien clone una aplicación ya preparada no recreará sus archivos.

### A.1. Express, EJS, Bootstrap, sesiones, fotografías y correo local

Crear `src/app.js`:

```javascript
import express from 'express';
import path from 'node:path';
import pg from 'pg';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import multer from 'multer';
import sharp from 'sharp';
import nodemailer from 'nodemailer';

export function createRuntime(config) {
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  const PgStore = connectPgSimple(session);
  const store = new PgStore({ pool, createTableIfMissing: false, pruneSessionInterval: false });
  const mail = nodemailer.createTransport({ jsonTransport: true });
  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.resolve('views'));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use('/vendor/bootstrap/css', express.static(path.resolve('node_modules/bootstrap/dist/css')));
  app.use('/vendor/bootstrap/js', express.static(path.resolve('node_modules/bootstrap/dist/js')));
  app.use('/css', express.static(path.resolve('public/css')));
  app.use(session({
    name: 'refind.sid',
    secret: config.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 3600000 },
  }));
  app.get('/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.get('/', (req, res) => res.render('index'));

  // Rutas exclusivas del entorno automatizado.
  if (config.APP_ENV === 'test') {
    app.get('/__check/session', (req, res) => {
      req.session.checkCount = (req.session.checkCount ?? 0) + 1;
      res.json({ count: req.session.checkCount });
    });
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    });
    app.post('/__check/photo', upload.single('photo'), async (req, res) => {
      if (!req.file) return res.sendStatus(400);
      try {
        const result = await sharp(req.file.buffer, { limitInputPixels: 25000000 })
          .rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 }).toBuffer();
        res.type('image/webp').send(result);
      } catch {
        res.sendStatus(400);
      }
    });
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.sendStatus(error instanceof multer.MulterError ? 400 : 500);
  });
  return {
    app, pool, mail,
    async close() {
      await store.close();
      await pool.end();
    },
  };
}
```

La cookie `Secure` está desactivada únicamente para el HTTP local. Las sesiones caducan en una hora. La limpieza automática se desactiva en esta comprobación para evitar temporizadores; al incorporar sesiones del producto, activar su limpieza periódica y probarla. Estas rutas no implementan autenticación: los permisos, CSRF, limitación de intentos, regeneración y cierre de sesión se comprobarán al desarrollar las rutas correspondientes.

El correo de desarrollo utiliza `jsonTransport: true`, sin cuenta SMTP ni envío externo. Se utilizará ese transporte en las pruebas de recuperación de contraseña. La entrega real se definirá con el despliegue. Referencia: [Nodemailer](https://nodemailer.com/transports/stream).

Para fotografías persistentes del desarrollo se establecen `var/uploads/development/`, `var/uploads/test/` y `var/uploads/e2e/`, sin publicación estática de `var/`. La comprobación procesa en memoria. La futura ruta de fotografías comprobará permisos antes de guardar o servir archivos, manteniendo el límite de 5 MiB y 25 millones de píxeles.

Crear `src/server.js`:

```javascript
import { readConfig } from './config.js';
import { createRuntime } from './app.js';

const config = readConfig(process.argv[2]);
const runtime = createRuntime(config);
const server = runtime.app.listen(config.PORT, '127.0.0.1', () => {
  console.log(`ReFind: http://127.0.0.1:${config.PORT}`);
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => { await runtime.close(); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

Crear `views/index.ejs`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ReFind</title>
    <link rel="stylesheet" href="/vendor/bootstrap/css/bootstrap.min.css">
    <link rel="stylesheet" href="/css/refind.css">
  </head>
  <body>
    <main class="container py-4">
      <h1>ReFind</h1>
      <p>Entorno de desarrollo preparado.</p>
      <button class="btn btn-primary" type="button" data-bs-toggle="collapse"
        data-bs-target="#estado" aria-expanded="false" aria-controls="estado">
        Ver estado
      </button>
      <div class="collapse" id="estado">Recursos de interfaz disponibles.</div>
    </main>
    <script src="/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
  </body>
</html>
```

Crear `public/css/refind.css`:

```css
body {
  min-width: 320px;
}
```

Servir Bootstrap desde el paquete instalado; no añadir CDN, Sass, jQuery ni otra copia de Popper. Referencia: [Bootstrap](https://getbootstrap.com/docs/5.3/getting-started/introduction/).

### A.2. Scripts compartidos y comprobación de arranque

Integrar estas entradas en `scripts` de `package.json`, conservando otras existentes:

```json
{
  "dev": "node --watch src/server.js development",
  "start:e2e": "node src/server.js e2e",
  "db:migrate": "node scripts/database.js migrate development",
  "db:migrate:test": "node scripts/database.js migrate test",
  "db:migrate:e2e": "node scripts/database.js migrate e2e",
  "db:check": "node scripts/database.js check development",
  "db:check:test": "node scripts/database.js check test",
  "db:check:e2e": "node scripts/database.js check e2e",
  "test": "vitest run",
  "test:unit": "vitest run tests/unit",
  "test:integration": "vitest run tests/integration",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

Ejecutar en PowerShell integrado, en este orden y comprobando cada salida:

```powershell
npm.cmd run db:migrate
npm.cmd run db:migrate:test
npm.cmd run db:migrate:e2e
npm.cmd run db:check
npm.cmd run db:check:test
npm.cmd run db:check:e2e
```

Las consultas deben mostrar su base, su usuario y `ReFind`. Repetir las tres migraciones: no deben reaplicar `001-entorno.cjs`; las consultas deben seguir devolviendo una fila. Para comprobar persistencia, cerrar las conexiones de la aplicación, reiniciar únicamente el servicio PostgreSQL identificado y repetir las consultas con el mismo resultado.

Arrancar el servidor:

```powershell
npm.cmd run dev
```

En una segunda terminal integrada:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Resultado: `status` con valor `ok`. Abrir `http://127.0.0.1:3000`: debe aparecer ReFind, el botón debe desplegar el estado y los tres recursos CSS/JS deben responder HTTP 200 sin errores en consola. Comprobar anchos de 375, 768 y 1280 píxeles. Detener con `Ctrl+C`. Si el puerto está ocupado, resolver el conflicto con la instancia propia identificada; no reutilizar procesos desconocidos.

## 10. Entorno de despliegue: pendiente de definición

**La forma de instalar y poner ReFind a disposición de otros usuarios en sus lugares de trabajo sigue abierta.** El proceso anterior define el entorno de desarrollo reproducible del equipo; no es un procedimiento de instalación del producto para sus usuarios.

Queda por decidir y documentar:

- Plataforma y sistema operativo de destino, alojamiento y modalidad de instalación.
- Uso o descarte de contenedores y, si corresponden, Docker Engine, Compose, Docker Desktop o WSL 2 según el destino.
- Publicación de la aplicación, dominio, HTTPS, puertos y acceso desde los puestos de trabajo.
- Servicios de ejecución, arranque automático, supervisión y recuperación ante fallos.
- Configuración de producción, secretos, cuentas, permisos y migraciones.
- Almacenamiento persistente de PostgreSQL y fotografías, copias de seguridad y restauración.
- Proveedor de correo y comprobación de entrega real.
- Distribución de versiones, actualización, reversión y comprobación de funcionamiento en el destino.

No se fija todavía una herramienta ni una secuencia de despliegue. Se añadirá un procedimiento propio cuando se decida ese entorno y pueda validarse en un destino representativo, incluyendo el acceso de los usuarios finales desde sus lugares de trabajo.
