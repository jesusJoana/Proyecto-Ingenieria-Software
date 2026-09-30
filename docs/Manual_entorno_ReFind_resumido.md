# ReFind · Entorno base · Siguientes desarrolladores

Para Windows 11. Seguir esta guía cuando el responsable haya publicado la configuración común. Cada desarrollador prepara solo su equipo; los archivos del proyecto se reciben por Git.

## 1. Preparar las herramientas

Cada desarrollador debe tener instaladas en su ordenador las herramientas de la tabla, con las versiones indicadas, antes de continuar con el proyecto.

**Dónde comprobarlo:** abrir **Windows PowerShell** desde el menú Inicio, como usuario normal. Los comandos se pueden ejecutar desde cualquier carpeta, uno a uno.

| Herramienta | Comando de comprobación | Resultado esperado |
| --- | --- | --- |
| Windows PowerShell | `$PSVersionTable.PSVersion` | Major `5`, Minor `1` |
| Git | `git --version` | `git version 2.55.0.windows.5` |
| VS Code | `code --version` | Primera línea: `1.139.0` |
| Node.js | `node --version` | `v24.21.0` |
| npm | `npm.cmd --version` | `11.19.0` |

Si un comando no se reconoce o muestra otra versión, resolverlo siguiendo el [apartado 3 del manual completo](Manual_entorno_ReFind.md#3-instalación-de-herramientas) antes de continuar.

## 2. Descargar el proyecto

Este paso sirve para descargar por primera vez el proyecto desde el repositorio.

**Dónde:** abrir Windows PowerShell como usuario normal, en la carpeta donde quieras guardar el proyecto. Ejecutar los comandos uno a uno:

```powershell
git clone https://github.com/jesusJoana/Proyecto-Ingenieria-Software.git
Set-Location -LiteralPath '.\Proyecto-Ingenieria-Software'
code .
```

Los comandos descargan el proyecto, entran en su carpeta y lo abren en VS Code.

Para los siguientes pasos, abrir en VS Code una terminal **Windows PowerShell**, situada en la carpeta del proyecto, donde está `package.json`.

## 3. Identificar tus cambios

**Para qué:** que Git registre tu nombre y correo en los commits.

Sustituir los textos por tus datos:

```powershell
git config --local user.name 'TU NOMBRE'
git config --local user.email 'TU CORREO'
```

## 4. Instalar las dependencias

Este paso instala las dependencias comunes del proyecto, incluidas las herramientas de pruebas. La lista y sus versiones vienen en los archivos `package.json` y `package-lock.json`, descargados del repositorio en el paso 2.

**Dónde:** en la terminal Windows PowerShell de VS Code, dentro de la carpeta del proyecto. Ejecutar:

```powershell
npm.cmd ci --include=dev
```

El comando descarga e instala esas dependencias en la carpeta `node_modules`.

**Si aparece un aviso sobre `allowScripts` y Argon2:** npm está indicando que un script de instalación de la biblioteca que protege las contraseñas no tiene autorización configurada. El aviso no demuestra por sí solo que Argon2 funcione o falle. Enviar el mensaje al responsable antes de continuar; la solución común sigue pendiente de validación (apartado 8.4 del manual completo).

## 5. Preparar VS Code

**Para qué:** disponer del análisis de código y formato con las versiones del equipo.

Instalar estas extensiones si no tienes ya las versiones indicadas:

```powershell
code --install-extension dbaeumer.vscode-eslint@3.0.34
code --install-extension esbenp.prettier-vscode@12.4.0
```

En **Ctrl+Shift+P → Preferencias: Abrir configuración de usuario (JSON)**, añadir o ajustar estas propiedades conservando las demás:

```json
{
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false
}
```

Guardar y reiniciar VS Code. Esto evita cambios automáticos de versión del editor y sus extensiones. La configuración del proyecto se recibe por Git.

## 6. Comprobar el entorno base

**Para qué:** verificar automáticamente Node, npm, dependencias, Bootstrap y Argon2.

```powershell
npm.cmd run check:env
```

Debe finalizar con todas las comprobaciones correctas. Si falla, resolver el mensaje antes de continuar; consultar [diagnóstico](../scripts/README.md#solo-si-un-comando-falla).

Estos scripts utilizan Node; no requieren activar un entorno Python `venv`. El prefijo `(base)` de Conda no impide por sí solo ejecutarlos.

## 7. Preparar la base de datos y las pruebas

Este paso prepara tu base de datos local y el navegador que utilizarán las pruebas automáticas.

### 7.1. Instalar y preparar PostgreSQL

Seguir los **apartados 2 y 3 del [manual de base de datos](Manual_base_datos_ReFind.md)** para instalar PostgreSQL y pgAdmin, crear las tres bases con sus usuarios y comprobar su funcionamiento. Dejar PostgreSQL iniciado.

### 7.2. Crear los archivos de conexión

Crear `.env.development`, `.env.test` y `.env.e2e` en la carpeta del proyecto, junto a `package.json`.

Copiar en cada uno el contenido indicado en [Archivos locales para el paso 2](../scripts/README.md#archivos-locales-para-el-paso-2) y poner las contraseñas de los usuarios que acabas de crear.

### 7.3. Comprobar la conexión a las bases

En la terminal Windows PowerShell de VS Code, dentro de la carpeta del proyecto, ejecutar:

```powershell
npm.cmd run check:db
```

Debe aparecer un `OK` para cada una de las tres bases. Si falla, resolver el error antes de continuar.

### 7.4. Preparar y comprobar las herramientas de pruebas

Seguir el [manual de pruebas para los siguientes desarrolladores](Manual_pruebas_ReFind_resumido.md). Indica cómo instalar Chromium, ejecutar las pruebas y preparar la extensión de VS Code.

## 8. Comunicar el resultado

**Para qué:** dejar constancia de que tu equipo puede ejecutar las comprobaciones.

Enviar al responsable tu nombre, fecha, resultado de los scripts y commit obtenido con:

```powershell
git rev-parse HEAD
```

No incluir archivos `.env` ni contraseñas.

**Pendiente del responsable:** validar la instalación limpia y resolver el aviso de Argon2; completar la configuración de calidad y sus comandos `lint` y `format:check`. Esta guía no da esos trabajos por terminados.
