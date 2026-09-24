# Manual del entorno de trabajo de ReFind

Versión 1.2 · 24 de septiembre de 2026

## 1. Alcance y forma de seguir el manual

Este manual describe el montaje completo e incremental del entorno de desarrollo de la práctica ReFind. El punto de partida es un equipo con Windows, sin ninguna herramienta de desarrollo instalada ni el repositorio clonado. Los comandos se ejecutarán en PowerShell.

Cada desarrollador seguirá el orden indicado para preparar su equipo desde cero. Antes de instalar cada elemento, comprobará si ya está disponible y qué versión tiene. Si la comprobación detecta una instalación compatible, podrá conservarla y continuar con su configuración y validación.

Para cada elemento se seguirá esta secuencia:

1. Comprobar si está disponible y consultar su versión.
2. Comparar el resultado con la versión acordada y sus requisitos de compatibilidad.
3. Conservarlo si cumple; instalarlo si falta; actualizarlo o seleccionar otra versión si no cumple.
4. Aplicar la configuración correspondiente a la etapa.
5. Comprobar el resultado y registrar la validación antes de continuar.

Si un comando no se reconoce, comprobar también la instalación y el PATH antes de reinstalar. Tras una instalación o actualización, abrir una terminal nueva y repetir la consulta de versión.

### Primer incremento: RF1, RF2 y RF3

| Requisito | Funcionalidad inicial | Comprobación de aceptación |
| --- | --- | --- |
| RF1 | Registro de usuario | El usuario registrado queda almacenado en PostgreSQL y puede recuperarse mediante consulta |
| RF2 | Inicio y cierre de sesión | Las credenciales válidas permiten acceder; al cerrar sesión deja de permitirse el acceso autenticado |
| RF3 | Almacenamiento persistente y seguridad básica | Los datos permanecen tras reiniciar la aplicación; las contraseñas no se almacenan en texto claro y los accesos protegidos requieren sesión |

**El entorno inicial abarca los apartados 3 a 9.** Incluye desde el principio PostgreSQL, migraciones, pruebas de integración, validación de entradas, contraseñas y sesiones. El apartado 10 recoge las comprobaciones para aceptar RF1–RF3 una vez implementados.

| Orden | Preparación | Resultado necesario para continuar |
| --- | --- | --- |
| 1 | Git, VS Code, Node y npm (3) | Herramientas disponibles con las versiones indicadas |
| 2 | Repositorio y proyecto npm (4–5) | Proyecto abierto y dependencias reproducibles |
| 3 | WSL, Docker, PostgreSQL y migraciones (6) | Bases de desarrollo y pruebas separadas, conexión disponible |
| 4 | Vitest, Express y Supertest (7) | Aplicación ejecutable y pruebas HTTP y SQL preparadas |
| 5 | Formularios y validaciones (8) | Registro y acceso utilizables desde el navegador |
| 6 | Contraseñas y sesiones (9) | Dependencias y configuración de autenticación disponibles |
| 7 | Implementación y aceptación de RF1–RF3 (10) | Registro, acceso, cierre y persistencia comprobados |

Las instalaciones se realizan en ese orden, validando cada paso. Las pruebas de cada comportamiento se escriben durante su implementación; la aceptación del apartado 10 no implica posponer las pruebas hasta terminar todo el incremento. Las herramientas del apartado 11 quedan fuera del montaje mínimo y solo se incorporan cuando exista una necesidad concreta.

### Dónde ejecutar los comandos

Cada apartado indica la terminal, la carpeta de trabajo y los permisos para sus comprobaciones, instalación y validación.

- **PowerShell externo:** abrir PowerShell desde el menú Inicio de Windows, fuera de VS Code. Si el apartado requiere administrador, pulsar «Ejecutar como administrador» al abrirlo.
- **PowerShell integrado:** abrir la carpeta del repositorio en VS Code y seleccionar **Terminal > Nuevo terminal**, con el perfil **PowerShell**. Utilizar VS Code como usuario normal. Si aparece otro perfil, seleccionar PowerShell en el menú de perfiles de la terminal.
- **Raíz del repositorio:** la carpeta `Proyecto-Ingenieria-Software`. Ejecutar `Get-Location` para comprobar la ubicación antes de los comandos del proyecto.
- **Instalador o interfaz gráfica:** abrir la aplicación o el instalador indicado; esos pasos no se escriben en una terminal.

PowerShell externo e integrado admiten los mismos comandos cuando utilizan la misma versión, permisos y carpeta. Esta guía asigna un lugar concreto a cada etapa para seguir siempre el mismo recorrido. No ejecutar los bloques PowerShell en CMD, Git Bash, una consola JavaScript ni una terminal de Ubuntu/WSL.

Tras modificar Node, Git u otra herramienta del PATH, cerrar la terminal externa y abrir una nueva. Si VS Code estaba abierto, cerrarlo y volverlo a abrir antes de crear otra terminal integrada, para que reciba el entorno actualizado.

## 2. Versiones recomendadas y decisión de instalación

Referencias revisadas el 24 de septiembre de 2026. Estas son las versiones propuestas para preparar el entorno; la validación práctica corresponde a cada etapa. La compatibilidad declarada por los fabricantes no sustituye las pruebas del proyecto.

### 2.1. Herramientas y servicios

| Elemento | Versión recomendada | Qué hacer con la versión detectada |
| --- | --- | --- |
| PowerShell | Windows PowerShell 5.1 o PowerShell 7 | Conservar cualquiera de estas opciones; consultar `$PSVersionTable.PSVersion` |
| Git para Windows | 2.55.0.windows.5 | Conservar esa revisión o una revisión estable posterior de Git 2; actualizar las anteriores |
| VS Code | 1.139.0 estable | Conservar esa versión o una estable posterior de la serie 1; actualizar las anteriores |
| Node.js | 24.21.0 LTS | Usar exactamente esta revisión para reproducir el entorno; seleccionar o instalarla si aparece otra |
| npm | 11.19.0, incluido con Node 24.21.0 | Usar exactamente esta versión; si difiere después de seleccionar Node, ajustar npm en el apartado 3.3 |
| WSL | 2.7.14 | Mínimo técnico de Docker: 2.1.5; para este montaje actualizar a 2.7.14 o una estable posterior de WSL 2 |
| Docker Desktop | 4.92.0 | Instalar esta revisión; se admite una posterior estable de la serie 4 si supera las comprobaciones del apartado 6 |
| Docker Engine | 29.8.0, incluido en la línea Desktop indicada | Comprobar con `docker version`; no instalarlo por separado |
| Docker Compose | 5.5.1, incluido en la línea Desktop indicada | Comprobar con `docker compose version`; no sustituirlo por Compose 1 ni instalarlo por separado |
| PostgreSQL | 17.11; imagen `postgres:17.11` | Usar esa revisión en el servicio del proyecto; no sustituirla automáticamente por PostgreSQL 18 o 19 |
| Chromium (ampliación posterior) | El suministrado por Playwright 1.63.0 | Instalarlo mediante el comando de Playwright; no comparar con la versión de Chrome o Edge del equipo |

Git, VS Code y WSL pueden admitir versiones anteriores técnicamente; los umbrales de esta tabla son la base recomendada de esta guía, no mínimos oficiales universales. Para Node, npm y PostgreSQL se fija una revisión común para evitar diferencias entre desarrolladores.

Para el recorrido Docker se recomienda Windows 11 x64 actualizado y con soporte vigente. Antes de instalarlo, comprobar los requisitos oficiales de edición y compilación de Windows, al menos 8 GB de RAM y virtualización habilitada. Cumplir la versión de WSL por sí solo no basta.

Fuentes: [Git para Windows](https://git-scm.com/install/windows), [VS Code 1.139](https://code.visualstudio.com/updates/v1_139), [Node 24.21.0 y npm incluido](https://nodejs.org/en/download/archive/v24.21.0), [WSL 2.7.14](https://github.com/microsoft/WSL/releases/tag/2.7.14), [Docker Desktop y componentes](https://docs.docker.com/desktop/release-notes/), [requisitos de Docker](https://docs.docker.com/desktop/setup/install/windows-install/) y [publicaciones de PostgreSQL](https://www.postgresql.org/about/newsarchive/).

### 2.2. Paquetes del primer incremento y ampliaciones

No instalar esta tabla completa. Utilizar cada versión únicamente cuando se alcance su apartado. Las versiones y requisitos se han consultado en los metadatos publicados en el [registro npm](https://registry.npmjs.org/); Node 24.21.0 satisface los rangos de Node declarados por los paquetes de esta selección.

**Necesarios para el montaje propuesto de RF1–RF3:** instalar cada grupo al llegar a su apartado.

| Apartado | Paquete | Versión recomendada exacta | Grupo |
| --- | --- | --- | --- |
| 6.4 | pg | 8.23.0 | Ejecución |
| 6.4 | node-pg-migrate | 9.0.0 | Desarrollo |
| 7.1 | vitest | 5.0.1 | Desarrollo |
| 7.2 | express | 5.2.1 | Ejecución |
| 7.2 | supertest | 7.3.0 | Desarrollo |
| 8.1 | ejs | 6.0.1 | Ejecución |
| 8.2 | zod | 4.6.5 | Ejecución |
| 9.1 | argon2 | 0.45.1 | Ejecución |
| 9.2 | express-session | 1.19.0 | Ejecución |
| 9.2 | connect-pg-simple | 10.0.0 | Ejecución |

**Ampliaciones posteriores: no instalarlas para completar el entorno mínimo de RF1–RF3.**

| Apartado | Paquete | Versión recomendada exacta | Grupo |
| --- | --- | --- | --- |
| 11.1 | eslint | 10.11.0 | Desarrollo |
| 11.1 | @eslint/js | 10.0.1 | Desarrollo |
| 11.1 | globals | 17.12.0 | Desarrollo |
| 11.1 | prettier | 3.9.9 | Desarrollo |
| 11.1 | eslint-config-prettier | 10.1.8 | Desarrollo |
| 11.2 | @playwright/test | 1.63.0 | Desarrollo |
| 11.3 | @vitest/coverage-v8 | 5.0.1 | Desarrollo |
| 11.4 | multer | 2.4.0 | Ejecución |
| 11.4 | sharp | 0.35.4 | Ejecución |
| 11.4 | nodemailer | 10.0.10 | Ejecución |

Comprobaciones de compatibilidad entre paquetes: Vitest y su proveedor de cobertura deben coincidir en **5.0.1**; `@eslint/js` 10.0.1 requiere ESLint 10, satisfecho por 10.11.0; `node-pg-migrate` 9.0.0 admite `pg` desde 4.3.0 y menor que 9, satisfecho por 8.23.0. No instalar todas las dependencias opcionales que aparezcan al consultar `peerDependencies`.

Las extensiones de VS Code son opcionales. Utilizar la versión estable compatible que ofrezca el Marketplace para VS Code 1.139.0 o posterior; el editor indica si una versión exige actualizarlo. No forman parte del conjunto de paquetes npm ni requieren coincidir entre desarrolladores.

### 2.3. Cómo decidir después de consultar una versión

- **No se encuentra el elemento:** instalar la versión recomendada al llegar a su etapa.
- **Coincide con la versión exacta o cumple el rango admitido de la tabla:** conservarlo y ejecutar su comprobación funcional.
- **Es anterior al mínimo indicado:** actualizar antes de continuar.
- **Es diferente de una versión fijada como exacta:** usar la revisión indicada para este proyecto, aunque la otra pudiera ser técnicamente compatible. No es necesario desinstalar versiones que usen otros proyectos si se dispone de un gestor de versiones.
- **El proyecto ya tiene versiones validadas en sus archivos:** utilizar `.node-version`, `package.json` y `package-lock.json`. Si contradicen esta tabla, resolver la discrepancia y actualizar la guía con el equipo antes de cambiar dependencias.

Ejemplo: `node --version` devuelve `v22.20.0`. Para seguir esta guía se selecciona o instala **24.21.0**. Si devuelve `v24.21.0`, se conserva. `npm.cmd --version` debe devolver **11.19.0**.

## 3. Instalación inicial de herramientas

**Dónde:** PowerShell externo, usuario normal, cualquier carpeta. Aquí se consulta también `$PSVersionTable.PSVersion`. Las excepciones de instalación se indican en cada apartado.

Antes del primer paso, consultar `$PSVersionTable.PSVersion`. Los comandos de esta guía admiten Windows PowerShell 5.1 o PowerShell 7; no es necesario instalar PowerShell 7 si ya se dispone de 5.1.

```powershell
$PSVersionTable.PSVersion
```

En el resultado, `Major = 5` y `Minor = 1` identifican PowerShell 5.1; `Build` y `Revision` son la compilación y revisión. No es necesario que estos dos últimos valores coincidan entre desarrolladores. Una salida 5.1 supera esta comprobación.

Copiar únicamente los comandos, sin el prefijo de la terminal (`PS C:\...>`) ni las salidas de ejemplo. Ejecutarlos uno a uno. El mensaje sobre el tiempo de carga de perfiles no es un error de instalación. Si el prompt empieza por `(base)`, puede haber un entorno Conda activo: comparar las rutas de `Get-Command` y las versiones reales antes de continuar; ese prefijo por sí solo no invalida la comprobación.

### 3.1. Git

**Dónde:** comprobación y validación en PowerShell externo, usuario normal, cualquier carpeta. La instalación o actualización se realiza con el instalador gráfico de Git para Windows; aceptar elevación solo si el instalador la solicita. Volver después a una terminal externa nueva sin elevar.

Versión recomendada: **2.55.0.windows.5**. Actualizar si es anterior; conservar una revisión estable posterior de Git 2.

**Comprobación previa:**

```powershell
Get-Command git -ErrorAction SilentlyContinue
git --version
```

`Get-Command` muestra dónde se encuentra Git. Su columna `Version` puede mostrar `2.55.0.5`; `git --version` identifica la revisión completa, por ejemplo `git version 2.55.0.windows.5`. Utilizar esta segunda salida para comparar con la versión recomendada. Si `Get-Command` no devuelve nada, revisar instalación y PATH.

Si está instalado y cumple el apartado 2, conservarlo. Si falta o necesita actualizarse, utilizar el instalador oficial de [Git para Windows](https://git-scm.com/install/windows), habilitando su uso desde la terminal. Reabrir PowerShell y repetir `git --version`.

**Validación:** el comando devuelve la versión y Git está disponible en la terminal.

### 3.2. VS Code

**Dónde:** comprobación y validación en PowerShell externo, usuario normal, cualquier carpeta. La instalación se realiza con el instalador gráfico de usuario de VS Code; la actualización, desde el propio editor. No abrir VS Code como administrador.

Versión recomendada: **1.139.0 estable**. Actualizar si es anterior; conservar una estable posterior de la serie 1.

**Comprobación previa:**

```powershell
Get-Command code -ErrorAction SilentlyContinue
code --version
```

En `Get-Command`, `code.cmd` puede aparecer con versión `0.0.0.0`; no es la versión del editor. `code --version` devuelve tres líneas: versión del editor, identificador de compilación y arquitectura. La primera debe ser `1.139.0` o una estable posterior admitida; `x64` indica arquitectura de 64 bits.

Si la aplicación existe pero no se reconoce `code`, revisar su incorporación al PATH. Si falta, seguir la [instalación de VS Code en Windows](https://code.visualstudio.com/docs/setup/windows). Si necesita actualizarse, utilizar la actualización del editor. No instalar extensiones en esta etapa.

**Validación:** el editor abre y `code --version` muestra su revisión.

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

Comparar Node y npm con las versiones acordadas en el apartado 2. Si el proyecto ya dispone de `.node-version` y `package.json`, consultar primero esos archivos. No sustituir una instalación compatible.

Si hay que instalar o seleccionar otra versión, elegir un único procedimiento:

- **Con nvm-windows ya disponible:** si falta la versión, ejecutar `nvm install 24.21.0`; después ejecutar `nvm use 24.21.0`. Ambos comandos se ejecutan en PowerShell externo como administrador. La versión anterior seguirá instalada.
- **Sin gestor de versiones:** descargar el instalador de esa revisión desde [Node.js](https://nodejs.org/en/download) e incluir Node, npm y PATH. No instalar nvm adicionalmente como requisito de este manual.

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

**Cierre de herramientas y repositorio:** Git, VS Code, Node y npm disponibles, versiones registradas y repositorio correcto. Continuar con npm y PostgreSQL; todavía no está completo el entorno para RF1–RF3.

## 5. Preparación del proyecto npm

**Dónde:** PowerShell integrado en VS Code, usuario normal, desde la raíz del repositorio, para todas las comprobaciones y comandos npm de esta etapa. Editar los archivos en el editor de VS Code. No usar administrador.

Incorporar esta etapa al comenzar el primer incremento.

**Comprobación previa:**

```powershell
node --version
npm.cmd --version
Test-Path -LiteralPath package.json
Test-Path -LiteralPath package-lock.json
```

- Si existen manifiesto y lockfile, revisar sus versiones y ejecutar `npm.cmd ci` para instalar las dependencias ya adoptadas por el equipo.
- Si existe manifiesto pero no lockfile, revisar y validar su contenido antes de generar el lockfile mediante el procedimiento siguiente, sin instalar paquetes.
- Solo si no existe manifiesto, ejecutar `npm.cmd init -y` y editar el archivo generado mediante el procedimiento siguiente.

### Edición del manifiesto inicial

**Dónde:** editor de VS Code para modificar el archivo; PowerShell integrado, usuario normal y raíz del repositorio, para comprobarlo.

1. En el explorador de archivos de VS Code, abrir `package.json`.
2. Si acaba de generarse con `npm.cmd init -y` y no contiene trabajo del equipo, sustituir su contenido por el bloque siguiente. Si ya contiene dependencias, scripts u otros datos del proyecto, conservarlos y modificar únicamente los campos necesarios; no sustituir un manifiesto existente por esta plantilla mínima.
3. Guardar con **Ctrl+S**.

```json
{
  "name": "proyecto-ingenieria-software",
  "version": "0.1.0",
  "private": true,
  "description": "Proyecto ReFind",
  "type": "module",
  "engines": {
    "node": "24.21.0"
  },
  "packageManager": "npm@11.19.0",
  "scripts": {},
  "repository": {
    "type": "git",
    "url": "https://github.com/jesusJoana/Proyecto-Ingenieria-Software.git"
  }
}
```

Valores que revisar al editar:

| Campo | Valor o criterio de configuración |
| --- | --- |
| `name` | `proyecto-ingenieria-software`, en minúsculas y sin espacios |
| `version` | `0.1.0` para el incremento en desarrollo; `1.0.0` es también un valor válido si el equipo ya lo ha elegido. No es la versión de Node |
| `private` | `true`, sin comillas; impide publicar el paquete en npm, pero no cambia la visibilidad del repositorio GitHub |
| `description` | `Proyecto ReFind` |
| `type` | `module` |
| `engines.node` | Campo `node` dentro de `engines`, con valor `24.21.0`; es una declaración, no selecciona ni instala Node y no garantiza por sí sola un bloqueo de versiones diferentes |
| `packageManager` | `npm@11.19.0`; no instala ni actualiza npm |
| `scripts` | `{}` al crear el manifiesto mínimo; añadir los comandos de ejecución y pruebas al configurar esas etapas |
| `repository.type` | `git` |
| `repository.url` | URL simple del repositorio; este campo no modifica el remoto `origin` de Git |

Conservar la licencia que corresponda al archivo `LICENSE` del proyecto. No adoptar automáticamente el valor `ISC` que pueda generar npm sin comprobarlo.

Al copiar el JSON, no incluir los delimitadores del bloque de código. Utilizar comillas dobles, separar campos con comas y no añadir coma al último campo. Escribir `npm@11.19.0`, sin barra invertida antes de `@`. La URL no debe tener formato Markdown `[texto](dirección)`.

Para comprobar la sintaxis del archivo guardado, ejecutar en la terminal integrada:

```powershell
node -e "JSON.parse(require('node:fs').readFileSync('package.json', 'utf8')); console.log('package.json válido')"
```

Resultado esperado: `package.json válido`. El comando solo lee el archivo; no instala paquetes. Si devuelve un error, corregir el JSON y repetir la comprobación. Esta validación comprueba la sintaxis, no las versiones efectivas: contrastarlas también con `node --version` y `npm.cmd --version`.

### Generar y comprobar package-lock.json

**Dónde:** PowerShell integrado en VS Code, usuario normal, desde la raíz del repositorio. Realizar este paso después de guardar y validar `package.json`.

`npm.cmd init -y` crea `package.json`, pero no crea `package-lock.json`. El comando anterior de validación JSON tampoco lo genera: solo lee y comprueba el manifiesto.

Comprobar primero si existe:

```powershell
Test-Path -LiteralPath package-lock.json
```

Si devuelve `False`, generar el archivo sin instalar paquetes:

```powershell
npm.cmd install --package-lock-only
```

Si el comando termina correctamente, repetir la comprobación:

```powershell
Test-Path -LiteralPath package-lock.json
```

**Resultado esperado:** `True`. El archivo debe aparecer junto a `package.json` en el explorador de VS Code. Si el comando npm falla, resolver el error antes de continuar.

Si el archivo ya existía, conservarlo y comprobar su coherencia con el manifiesto; no borrarlo ni regenerarlo por rutina. No editarlo manualmente. Cuando se incorporen dependencias en las siguientes etapas, npm lo actualizará. Incluir `package.json` y `package-lock.json` en los cambios del proyecto que se compartan con el equipo.

### Archivo de versión y revisión final

**Dónde:** editor de VS Code y PowerShell integrado, usuario normal, raíz del repositorio.

En el explorador de VS Code, crear el archivo `.node-version` en la raíz, escribir únicamente `24.21.0` y guardar con **Ctrl+S**. Si ya existe, revisar su contenido antes de modificarlo. Este archivo registra la versión; no cambia automáticamente la versión activa de Node.

Registrar `24.21.0` en `.node-version`. Antes de crear secretos o instalar paquetes, revisar que `.gitignore` excluya `node_modules/`, `.env`, archivos locales de pruebas e informes, conservando las plantillas sin secretos.

**Validación:**

```powershell
npm.cmd ls --depth=0
git status --short
```

En un proyecto nuevo sin paquetes, una lista vacía es correcta. No añadir carpetas ni scripts de etapas que aún no se hayan iniciado.

### 5.1. Procedimiento común para cada paquete posterior

**Dónde:** PowerShell integrado en VS Code, usuario normal, desde la raíz del repositorio. Tanto `npm.cmd ls` como `npm.cmd view` y las instalaciones locales se ejecutan aquí. No usar administrador ni instalación global para estos paquetes.

Los comandos de consulta de paquetes se ejecutan desde la raíz del proyecto. `npm.cmd ls NOMBRE --depth=0` muestra la versión local; si está ausente o es inválida, puede finalizar con un código distinto de cero.

Si el paquete ya está fijado por el proyecto, respetar el manifiesto y el lockfile. Para una incorporación nueva, utilizar la revisión exacta de la tabla 2.2 y consultar sus requisitos antes de instalar:

```powershell
npm.cmd view NOMBRE@VERSION engines peerDependencies --json
```

Sustituir `NOMBRE` y `VERSION` por el paquete y la revisión exacta de la tabla 2.2. Por ejemplo: `npm.cmd view express@5.2.1 engines peerDependencies --json`. La selección indicada está preparada para Node 24.21.0; si aparece una incompatibilidad, detener esa etapa y revisar el mensaje, sin usar `--force` ni `--legacy-peer-deps`. Instalar solo tras comprobar la compatibilidad:

```powershell
# Dependencia de ejecución:
npm.cmd install --save-exact NOMBRE@VERSION
# O dependencia de desarrollo:
npm.cmd install --save-dev --save-exact NOMBRE@VERSION
```

Son alternativas, no dos pasos para un mismo paquete. Repetir `npm.cmd ls NOMBRE --depth=0` y revisar ambos archivos npm tras el cambio.

## 6. Persistencia: WSL, Docker y PostgreSQL

Completar esta etapa como parte del entorno inicial: RF1 y RF3 requieren persistencia real desde el primer incremento. El procedimiento de esta sección corresponde a PostgreSQL en Docker con backend WSL 2; si el equipo elige instalación nativa, deberá documentar ese recorrido antes de ejecutarlo.

### 6.1. Requisitos de Windows y WSL

**Dónde:** comprobaciones iniciales en PowerShell externo, usuario normal, cualquier carpeta. Para `wsl --install --no-distribution` o `wsl --update`, abrir PowerShell externo como administrador. Reiniciar Windows si se solicita y repetir las consultas en PowerShell externo sin elevar. No realizar la instalación de WSL desde la terminal integrada.

Versión recomendada de WSL: **2.7.14**. Docker requiere como mínimo **2.1.5**; seguir el objetivo recomendado para este montaje.

**Comprobación previa:**

```powershell
Get-ComputerInfo | Select-Object WindowsProductName,OsVersion,OsArchitecture
wsl --version
wsl --status
```

Comparar los resultados con los [requisitos vigentes de Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/), incluida virtualización. Si Windows no cumple, resolverlo antes de instalar Docker.

Si WSL no está instalado, seguir la [instalación oficial de WSL](https://learn.microsoft.com/en-us/windows/wsl/install). Para el recorrido sin distribución personal, cuando el sistema admita la opción:

```powershell
wsl --install --no-distribution
```

Si WSL es anterior a la revisión recomendada 2.7.14:

```powershell
wsl --update
```

Ejecutar con los permisos que solicite Windows y reiniciar si se requiere. Repetir `wsl --version` y `wsl --status`.

### 6.2. Docker Desktop y Compose

**Dónde:** consultas `docker` y validación en PowerShell externo, usuario normal, cualquier carpeta. Instalar Docker Desktop mediante su instalador gráfico y aceptar elevación solo si se solicita. Abrir Docker Desktop desde Inicio y configurar el backend en su interfaz. Tras instalar, usar una terminal externa nueva; reiniciar también VS Code antes de continuar con el proyecto.

Versión recomendada: **Docker Desktop 4.92.0**, con Engine **29.8.0** y Compose **5.5.1** de esa línea. Si se usa una actualización estable posterior, registrar sus componentes y repetir las comprobaciones. Para la incidencia documentada de WSL con `[automount] root=/`, consultar las notas oficiales antes de continuar.

**Comprobación previa:**

```powershell
Get-Command docker -ErrorAction SilentlyContinue
docker --version
docker compose version
docker version
```

La versión de Docker Desktop se consulta en su pantalla About; `docker --version` muestra la CLI, no la versión de Desktop. Si falta, instalar Docker Desktop 4.92.0 desde su documentación oficial. Si está instalado pero el motor no responde, abrir Docker Desktop y comprobar el arranque antes de reinstalar. Actualizarlo si no cumple los requisitos de Windows, WSL o del archivo Compose acordado.

Seleccionar backend WSL 2 y contenedores Linux. Compose se comprobará con la instalación de Docker Desktop, sin instalar otro ejecutable por anticipado.

**Validación:** `docker version` muestra Client y Server y `docker compose version` devuelve una versión.

### 6.3. PostgreSQL

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para comprobar archivos e imágenes y ejecutar todos los comandos Docker y Compose de esta etapa. Docker Desktop debe estar abierto y su motor iniciado. Editar Compose y las variables en VS Code. La consulta SQL se ejecutará dentro del cliente PostgreSQL del contenedor, no directamente como una instrucción PowerShell.

Versión recomendada: **17.11**, imagen **postgres:17.11**.

**Comprobación previa:**

```powershell
Test-Path -LiteralPath compose.yaml
docker image ls postgres
docker ps -a --filter ancestor=postgres
```

Si ya existe un servicio `db` del proyecto, consultar además:

```powershell
docker compose ps
docker compose exec db postgres --version
```

El último comando requiere el servicio arrancado. La ausencia de un servidor en ejecución no significa que la imagen no esté descargada. Una instalación nativa distinta no valida el servicio Docker del proyecto.

Antes de descargar una imagen, fijar `image: postgres:17.11` en el servicio y preparar `compose.yaml`, `.env.example` y `.env`. Configurar servicio `db`, puerto `127.0.0.1:5433`, base `refind_dev`, credenciales locales, volumen persistente y healthcheck. No sobrescribir archivos locales existentes.

Con esa configuración revisada:

```powershell
docker compose config --quiet
docker compose pull db
docker compose up -d --wait db
docker compose exec db postgres --version
```

**Validación:** servicio saludable, versión acordada, consulta `SELECT 1` correcta y datos de comprobación conservados tras detener y arrancar el servicio. No borrar volúmenes para resolver errores de contraseña ni actualizar una serie mayor sobre un volumen existente sin un procedimiento de migración.

### 6.4. Conexión, migraciones y aislamiento de pruebas

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para consultar e instalar los paquetes y ejecutar los scripts de conexión, migración y pruebas. Editar la configuración en VS Code; los scripts usarán el PostgreSQL del contenedor.

Versiones recomendadas: **pg 8.23.0 y node-pg-migrate 9.0.0**.

**Comprobación previa:**

```powershell
npm.cmd ls pg node-pg-migrate --depth=0
```

Después de validar PostgreSQL, incorporar `pg` como dependencia de ejecución y `node-pg-migrate` como dependencia de desarrollo. Comprobar versiones con el apartado 5.1.

Preparar la configuración de conexión y los comandos de consulta y migración. Crear una base `refind_test` separada antes de ejecutar pruebas SQL. Las pruebas no deben recibir las credenciales de `refind_dev`.

**Validación de esta etapa:** conexión desde Node, migraciones aplicadas desde una base vacía y segunda ejecución sin reaplicar cambios. Comprobar las URLs separadas de desarrollo y pruebas. Las pruebas automatizadas de aislamiento se ejecutarán después de configurar Vitest en el apartado 7.

## 7. Ejecución y pruebas de RF1–RF3

### 7.1. Pruebas iniciales

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para consultar e instalar Vitest y ejecutar las pruebas. Editar los archivos en VS Code.

Versión recomendada: **vitest 5.0.1**.

**Comprobación previa:**

```powershell
npm.cmd ls vitest --depth=0
```

Incorporar Vitest como dependencia de desarrollo, siguiendo el apartado 5.1 y sus [requisitos oficiales](https://vitest.dev/guide/). Configurar el descubrimiento de pruebas unitarias y de integración, además de los scripts `test`, `test:unit` y `test:integration`, antes de ejecutarlos. Las pruebas SQL usarán `refind_test`; aplicar allí las migraciones y preparar datos aislados antes de cada ejecución.

**Validación:** crear la primera prueba del comportamiento acordado, comprobar su fallo y verificar que pasa al implementar ese comportamiento. No dar por correcta una ejecución que no encuentre pruebas.

### 7.2. Servidor HTTP y pruebas HTTP

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para consultar e instalar Express y Supertest, arrancar el servidor y ejecutar las pruebas. Abrir la URL en el navegador. Si se necesita otro comando mientras el servidor está activo, abrir una segunda terminal integrada en la misma carpeta; detener el servidor con `Ctrl+C` en su terminal.

Versiones recomendadas: **express 5.2.1 y supertest 7.3.0**.

**Comprobación previa:**

```powershell
npm.cmd ls express supertest --depth=0
```

Para ejecutar registro, acceso y cierre de sesión, incorporar Express 5 como dependencia de ejecución y Supertest como dependencia de desarrollo. Fijar revisiones compatibles mediante el apartado 5.1.

Preparar únicamente los archivos de la primera ruta y su prueba. Separar la creación de la aplicación del arranque del servidor. Definir el script de arranque y documentar el puerto antes de ejecutarlo.

**Validación:** la prueba HTTP pasa, la ruta responde en el puerto documentado y el proceso se detiene con `Ctrl+C`.

## 8. Formularios de registro y acceso

### 8.1. Primera página

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para consultar e instalar EJS y arrancar la aplicación. Editar las vistas en VS Code y validar la página en el navegador.

Versión recomendada: **ejs 6.0.1**.

**Comprobación previa:**

```powershell
npm.cmd ls ejs --depth=0
```

Incorporar EJS como dependencia de ejecución del montaje propuesto. Preparar formularios de registro e inicio de sesión, sus mensajes de validación y la acción de cierre de sesión. La implementación funcional se verificará con los casos del apartado 10.

**Validación:** abrir la página y comprobar el HTML y los datos mostrados.

### 8.2. Entradas y configuración

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para consultar e instalar Zod y ejecutar las pruebas. Editar esquemas y archivos de variables en VS Code.

Versión recomendada: **zod 4.6.5**.

**Comprobación previa:**

```powershell
npm.cmd ls zod --depth=0
```

Incorporar Zod como dependencia de ejecución del montaje propuesto. Preparar validaciones de registro, credenciales y variables de conexión y sesión. Definir los esquemas de RF1–RF3 antes de implementar las rutas que los utilizan.

**Validación:** probar valores válidos, ausentes e inválidos. Crear `.env.example` sin secretos solo cuando se necesiten variables locales.

## 9. Contraseñas y sesiones para RF1–RF3

Estas dependencias forman parte del primer incremento. No se aplazan a futuras funcionalidades.

### 9.1. Contraseñas

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para comprobación, instalación y pruebas. Editar la configuración y el código en VS Code.

**Comprobación previa:**

```powershell
npm.cmd ls argon2 --depth=0
```

Versión recomendada: **argon2 0.45.1**. Si falta, instalarla siguiendo el apartado 5.1; si ya está declarada en el proyecto, respetar el lockfile.

Preparar el almacenamiento de un hash de contraseña y su verificación al acceder. No guardar contraseñas en texto claro ni incluirlas en registros. La migración de usuarios debe contemplar el hash, los campos de registro acordados y las restricciones de unicidad.

**Validación durante la implementación:** la contraseña correcta verifica el hash, una incorrecta no lo verifica y el dato guardado en PostgreSQL no contiene la contraseña original.

### 9.2. Sesiones persistentes

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para comprobación, instalación y pruebas; navegador para comprobar el acceso y cierre. Editar configuración y migraciones en VS Code.

**Comprobación previa:**

```powershell
npm.cmd ls express-session connect-pg-simple --depth=0
```

Versiones recomendadas: **express-session 1.19.0 y connect-pg-simple 10.0.0**. Incorporar como dependencias de ejecución conforme al apartado 5.1.

Preparar el almacén de sesiones en PostgreSQL y su tabla mediante migración. Separar las sesiones de desarrollo de las de pruebas. Configurar un secreto local fuera de Git, caducidad y cookies `HttpOnly` y `SameSite`. Activar `Secure` cuando se use HTTPS; documentar la configuración específica del desarrollo HTTP local.

Definir regeneración de sesión tras un acceso correcto, destrucción de la sesión al cerrar y comprobación de sesión en las rutas protegidas. Concretar protección CSRF para formularios que cambian estado y limitación de intentos de acceso antes de aceptar RF2–RF3; estas librerías no las configuran automáticamente.

**Validación durante la implementación:** credenciales válidas crean una sesión; las inválidas no permiten acceso; cerrar sesión invalida el acceso protegido, incluida la reutilización de la cookie anterior.

### 9.3. Cierre del montaje inicial

El entorno debe permitir iniciar PostgreSQL y la aplicación, aplicar migraciones y ejecutar pruebas unitarias, HTTP y de integración con una base separada. No basta con que las instalaciones devuelvan una versión: comprobar también la conexión entre los componentes antes de implementar los casos de aceptación.

## 10. Ejecución y aceptación del primer incremento

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para los comandos de aplicación, migraciones y pruebas. Utilizar una segunda terminal integrada para las comprobaciones mientras el servidor está en ejecución. Las comprobaciones de formularios se hacen en el navegador.

### 10.1. Comandos que debe ofrecer el incremento

Al preparar la configuración, definir estos scripts en `package.json`. Son el contrato previsto del entorno; no ejecutarlos hasta que sus archivos y scripts estén creados y revisados.

| Comando | Resultado esperado |
| --- | --- |
| `npm.cmd run db:check` | Conexión a PostgreSQL y consulta de comprobación correcta |
| `npm.cmd run db:migrate` | Esquema de usuarios y sesiones actualizado en desarrollo |
| `npm.cmd run dev` | Servidor de desarrollo en `http://127.0.0.1:3000` |
| `npm.cmd run test:unit` | Pruebas de validación y contraseñas |
| `npm.cmd run test:integration` | Migraciones y pruebas HTTP/SQL sobre `refind_test` |
| `npm.cmd test` | Ejecución de unitarias e integración |

La preparación de integración debe comprobar el destino `refind_test` antes de migrar o limpiar datos y cerrar conexiones al terminar. No debe recurrir a la URL de desarrollo si falta la de pruebas.

### 10.2. Comprobaciones de RF1–RF3

| Requisito | Caso que se ejecutará | Resultado esperado |
| --- | --- | --- |
| RF1 | Registrar un usuario con datos válidos y consultar la base | Una cuenta persistida, con contraseña almacenada como hash |
| RF1 | Repetir el identificador único o enviar datos inválidos | Registro rechazado sin crear cuentas duplicadas o incompletas |
| RF2 | Acceder con credenciales válidas | Sesión creada y acceso a una ruta protegida |
| RF2 | Acceder con contraseña incorrecta o sin sesión | Acceso rechazado |
| RF2 | Cerrar sesión e intentar acceder de nuevo, también con la cookie anterior | Sesión invalidada y acceso rechazado |
| RF3 | Registrar un usuario, detener la aplicación, arrancarla y volver a consultar/acceder | La cuenta sigue almacenada y sus credenciales siguen siendo válidas |
| RF3 | Detener y arrancar PostgreSQL conservando el volumen | Los datos siguen disponibles |
| RF3 | Ejecutar las pruebas de integración | Desarrollo no se modifica; las pruebas usan exclusivamente su base |
| RF3 | Revisar configuración y peticiones inválidas | Secretos fuera de Git, consultas parametrizadas y validaciones activas |

La permanencia de los datos de usuario tras reiniciar es distinta de la duración de una sesión; documentar y probar la caducidad de sesión elegida sin añadir como requisito una sesión indefinida.

Vitest y Supertest cubrirán automáticamente los casos unitarios, HTTP y de base de datos. Los formularios se comprobarán inicialmente en el navegador de forma manual; Playwright se incorporará cuando se acuerde automatizar ese recorrido.

**Cierre del incremento:** registrar resultados de estos casos. No presentar RF1–RF3 como completados solo por haber preparado el entorno.

## 11. Ampliaciones fuera del montaje mínimo

Estas herramientas no bloquean el desarrollo, ejecución y pruebas iniciales de RF1–RF3. Incorporarlas de forma independiente cuando el equipo lo necesite.

### 11.1. Formato y análisis del código

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para todas las consultas npm, instalaciones locales, scripts y `code --list-extensions --show-versions`. Instalar o actualizar las extensiones opcionales desde la vista Extensiones de VS Code.

Versiones recomendadas: **eslint 10.11.0, @eslint/js 10.0.1, globals 17.12.0, prettier 3.9.9 y eslint-config-prettier 10.1.8**.

Incorporar cuando el equipo acuerde automatizar sus reglas de formato y análisis.

**Comprobación previa:**

```powershell
npm.cmd ls eslint @eslint/js globals prettier eslint-config-prettier --depth=0
```

Incorporar los paquetes acordados como dependencias de desarrollo. Preparar las configuraciones y los scripts `lint`, `format` y `format:check` antes de utilizarlos.

**Validación:** ejecutar los scripts de análisis y comprobación de formato sobre el código existente.

Las extensiones del editor son opcionales. Antes de añadir cualquiera, consultar sus versiones:

```powershell
code --list-extensions --show-versions
```

Solo si se decide utilizarlas y faltan, instalar `dbaeumer.vscode-eslint` y `esbenp.prettier-vscode` desde VS Code. Actualizarlas si lo requiere su compatibilidad con el editor. Repetir la lista tras instalarlas.

### 11.2. Playwright

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para consultar e instalar el paquete, descargar su Chromium y ejecutar las pruebas. También se ejecuta aquí la consulta de extensiones; la extensión opcional se instala desde la vista Extensiones de VS Code. No usar administrador para la descarga del navegador.

Versión recomendada: **@playwright/test 1.63.0**, con su Chromium correspondiente.

Incorporar cuando exista un recorrido funcional que verificar.

**Comprobación previa del paquete:**

```powershell
npm.cmd ls @playwright/test --depth=0
```

Si falta, instalar una revisión compatible como dependencia de desarrollo. Consultar los [requisitos oficiales de Playwright](https://playwright.dev/docs/intro). Con el paquete local disponible, comprobar su versión y navegadores instalados:

```powershell
npx.cmd --no-install playwright --version
npx.cmd --no-install playwright install --list
```

Si falta el Chromium correspondiente a esa revisión:

```powershell
npx.cmd --no-install playwright install chromium
```

Repetir la consulta tras instalar o actualizar Playwright. Las revisiones de navegador deben corresponder al paquete instalado, conforme a la [documentación de navegadores](https://playwright.dev/docs/browsers).

Preparar la configuración, un servidor de pruebas propio y, cuando el recorrido use persistencia, la base `refind_e2e` y sus datos separados de desarrollo. Definir `test:e2e` antes de ejecutarlo.

**Validación:** el recorrido pasa, utiliza sus propios datos y cierra sus procesos.

La extensión `ms-playwright.playwright` es opcional: comprobar antes `code --list-extensions --show-versions` e instalarla solo si se decide utilizarla.

### 11.3. Cobertura

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para comprobar versiones, instalar el proveedor y ejecutar el script de cobertura. Abrir el informe generado desde su ubicación documentada.

Versión recomendada: **@vitest/coverage-v8 5.0.1**, junto a **vitest 5.0.1**.

**Comprobación previa:**

```powershell
npm.cmd ls vitest @vitest/coverage-v8 --depth=0
```

Incorporar `@vitest/coverage-v8` como dependencia de desarrollo cuando se vaya a medir cobertura, con la misma versión de Vitest. Configurar los archivos incluidos y el script correspondiente.

**Validación:** se ejecutan las pruebas y se genera un informe sobre el código esperado.

### 11.4. Fotografías y correo

**Dónde:** PowerShell integrado en VS Code, usuario normal, raíz del repositorio, para consultar versiones, instalar paquetes y ejecutar pruebas. Editar la configuración en VS Code.

No incorporar estas dependencias a RF1–RF3. El registro inicial no incluye verificación de correo ni recuperación de contraseña salvo que se amplíe expresamente su alcance.

| Necesidad posterior | Comprobación previa | Versiones recomendadas | Validación de la futura etapa |
| --- | --- | --- | --- |
| Fotografías | `npm.cmd ls multer sharp --depth=0` | multer 2.4.0 y sharp 0.35.4 | Archivos válidos, rechazados y permisos |
| Correo | `npm.cmd ls nodemailer --depth=0` | nodemailer 10.0.10 | Transporte de pruebas; SMTP real cuando corresponda |

Aplicar el procedimiento del apartado 5.1 únicamente al comenzar esa necesidad.

## 12. Integración continua y reproducción del entorno

**Dónde:** comprobaciones locales en PowerShell integrado en VS Code, usuario normal, raíz del repositorio. Editar el workflow en VS Code. Los comandos del workflow los ejecuta GitHub Actions en su entorno remoto; sus resultados se consultan en la pestaña Actions del repositorio en el navegador. Para comprobar una copia limpia, clonarla desde PowerShell externo como en el apartado 4 y abrir después esa copia en VS Code.

Esta etapa no bloquea el montaje local inicial de RF1–RF3. Incorporarla cuando se acuerde ejecutar remotamente los comandos locales ya definidos y validados.

**Comprobación previa:** revisar si existe `.github/workflows`, las versiones declaradas en el workflow, `.node-version`, `package.json` y `package-lock.json`. Consultar también `node --version`, `npm.cmd --version` y `npm.cmd ls --depth=0` en el equipo que verifica el procedimiento.

Preparar o actualizar el workflow con las versiones acordadas. Ejecutar `npm ci`, los controles locales existentes y, solo si se han incorporado, PostgreSQL, migraciones y pruebas de navegador. No instalar un runner local como parte de este recorrido.

**Validación:** una ejecución remota correcta y un fallo controlado detectado. Comprobar además el procedimiento desde una copia limpia, sin archivos personales ni pasos implícitos.

## 13. Registro de validación por desarrollador

| Etapa o elemento | Versión detectada | Versión acordada | Acción: conservar, instalar o actualizar | Fecha | Resultado | Validada |
| --- | --- | --- | --- | --- | --- | --- |
| Por completar | — | — | — | — | — | No |

No pasar a la siguiente etapa dependiente hasta validar la anterior. Registrar las incidencias y actualizar el procedimiento antes de compartirlo con el equipo.





