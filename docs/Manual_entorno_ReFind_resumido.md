# ReFind · Instalación rápida del entorno base

Windows 11 x64 · 28 de septiembre de 2026

Guía para compañeros que clonan el repositorio. Ejecutar los comandos en **Windows PowerShell**, uno a uno. Comprobar cada paso antes de continuar.

## 1. Instalar las herramientas

Consultar primero qué está disponible:

```powershell
$PSVersionTable
Get-Command git,code,node,npm.cmd -ErrorAction SilentlyContinue
```

Ejecutar las consultas siguientes solo para las herramientas encontradas:

| Herramienta | Consulta | Versión exacta | Descarga si falta o difiere |
| --- | --- | --- | --- |
| Windows PowerShell | `$PSVersionTable` | 5.1, Desktop | Incluido en Windows; abrir **Windows PowerShell** desde Inicio |
| Git | `git --version` | 2.55.0.windows.5 | [Git para Windows](https://github.com/git-for-windows/git/releases/tag/v2.55.0.windows.5), instalador x64 |
| VS Code | `code --version` | 1.139.0, x64 | [VS Code 1.139](https://code.visualstudio.com/updates/v1_139), instalador de usuario x64 |
| Node.js | `node --version` | 24.21.0 | [Node 24.21.0](https://nodejs.org/es/blog/release/v24.21.0), instalador MSI x64 con npm |
| npm | `npm.cmd --version` | 11.19.0 | Comprobarlo después de instalar Node |

- Si coincide, conservarlo. Si falta o difiere, instalar o seleccionar la versión indicada.
- En los instaladores, habilitar la incorporación al **PATH**. Cerrar y reabrir PowerShell y VS Code y repetir las consultas.
- Si Node ya se administra con nvm, seleccionar la versión fijada con ese gestor; no mezclarla con el MSI. Véase [manual completo, 3.3](Manual_entorno_ReFind.md#33-nodejs-y-npm).
- Si npm difiere después de seleccionar Node, ejecutar y comprobar:

```powershell
npm.cmd install --global npm@11.19.0
npm.cmd --version
```

## 2. Clonar y abrir el proyecto

Desde la carpeta donde se quiera guardar el proyecto, si todavía no existe una copia:

```powershell
git clone https://github.com/jesusJoana/Proyecto-Ingenieria-Software.git
Set-Location -LiteralPath '.\Proyecto-Ingenieria-Software'
code .
```

Si ya está clonado, abrir esa carpeta y continuar. En la terminal integrada de VS Code, elegir **Windows PowerShell** y comprobar:

```powershell
git rev-parse --show-toplevel
git remote get-url origin
git config --get user.name
git config --get user.email
```

La raíz debe ser la del proyecto y el remoto el de la URL de clonación. Si falta la identidad o es incorrecta, sustituir los marcadores y ejecutar:

```powershell
git config --local user.name 'TU NOMBRE'
git config --local user.email 'TU CORREO'
```

## 3. Instalar todos los paquetes

Desde la raíz del repositorio, con Node y npm en las versiones fijadas:

```powershell
npm.cmd ci --include=dev
npm.cmd ls --depth=0
```

Debe terminar sin errores y mostrar los **21 paquetes** declarados. No ejecutar `npm init`, no añadir paquetes uno a uno y no borrar el lockfile. Los archivos `package.json` y `package-lock.json` se reciben con el clon y deben contener las dependencias compartidas. Si faltan o no coinciden, consultar al responsable.

Si aparece el aviso de Argon2 sobre `allowScripts`, conservar la salida y ejecutar solo esta consulta:

```powershell
npm.cmd install-scripts ls
```

Comunicar el resultado al responsable antes de aprobar scripts o reinstalar. El tratamiento de ese aviso en una instalación limpia sigue pendiente de validación.

## 4. Configurar VS Code y sus extensiones

Pulsar **Ctrl + Shift + P** → **Preferences: Open User Settings (JSON)** / **Preferencias: Abrir configuración de usuario (JSON)**. Añadir estas propiedades dentro de las llaves existentes, conservando las demás y separándolas con comas:

```json
{
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "extensions.autoCheckUpdates": false
}
```

Guardar y reiniciar VS Code. Estas preferencias desactivan las actualizaciones automáticas del editor y de sus extensiones para ese usuario.

Consultar las extensiones e instalar únicamente las que falten o tengan otra versión:

```powershell
code --list-extensions --show-versions
code --install-extension dbaeumer.vscode-eslint@3.0.34
code --install-extension esbenp.prettier-vscode@12.4.0
```

Repetir la lista: deben aparecer ESLint **3.0.34** y Prettier **12.4.0**. Conservar la configuración compartida recibida por Git; no recrearla.

## 5. Comprobar y registrar el resultado

- [ ] Versiones del paso 1 correctas.
- [ ] Repositorio e identidad Git correctos.
- [ ] `npm ci --include=dev` completado y 21 paquetes con versiones exactas según el [inventario común](Manual_entorno_ReFind.md#2-versiones-comunes).
- [ ] Preferencias de VS Code guardadas y dos extensiones con las versiones indicadas.
- [ ] Incidencias comunicadas; anotar fecha y commit (`git rev-parse HEAD`).

Cuando el repositorio incluya los scripts y configuraciones de calidad, ejecutar también:

```powershell
npm.cmd run lint
npm.cmd run format:check
```

**Estado de la preparación compartida:** los paquetes están definidos, pero los scripts de calidad y sus archivos todavía no están preparados en la copia revisada. Su responsable los incorporará una vez; mientras falten, marcar esa comprobación como pendiente. La reproducción limpia y el aviso `allowScripts` tampoco se presentan aún como validados.

## Preparaciones independientes

No instalar PostgreSQL ni descargar Chromium para completar esta guía base. Seguir sus manuales cuando se aborde cada parte:

- [Base de datos: instalación, configuración y validación](Manual_base_datos_ReFind.md).
- [Entorno de pruebas: instalación, configuración y validación](Manual_pruebas_ReFind.md).
- [Manual base completo: detalles, incidencias y validación ampliada](Manual_entorno_ReFind.md).

El despliegue para usuarios finales está pendiente de definición.
