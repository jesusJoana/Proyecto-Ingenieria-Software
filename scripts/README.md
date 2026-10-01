# Comprobación del entorno de ReFind

Guía común para todos los integrantes. **Estado: scripts preparados; ejecución y validación pendientes.**

## Antes de ejecutar

Preparar una vez lo siguiente. Si ya está preparado, pasar directamente a los comandos; los scripts realizan las comprobaciones.

| Preparación | Manual |
| --- | --- |
| Node, npm y dependencias del proyecto instalados. | [Manual del entorno de desarrollo](../docs/Manual_entorno_ReFind.md) |
| Para `check:db`: PostgreSQL iniciado, las tres bases y sus usuarios creados, y los archivos `.env` completados según el apartado de esta guía. | [Manual de base de datos](../docs/Manual_base_datos_ReFind.md) |
| Para `check:tests:browser`: Chromium de Playwright instalado. | [Manual del entorno de pruebas](../docs/Manual_pruebas_ReFind.md) |

Usar los scripts y configuraciones incluidos en el repositorio. No volver a crearlos copiando los ejemplos de los manuales ni preparar los anexos de desarrollo de la aplicación para estas comprobaciones.

En VS Code, abrir la carpeta del proyecto y una terminal **Windows PowerShell**, como usuario normal. Situarse en la raíz, donde está `package.json`.

Estos comandos utilizan Node y las dependencias de `node_modules`: no requieren activar un entorno Python `venv`. El prefijo `(base)` indica Conda activo y por sí solo no impide ejecutarlos. No es necesario activar o desactivar entornos Python como paso previo.

## Orden de ejecución

Ejecutar un paso cada vez. Si falla, revisar el error antes de continuar.

| Paso | Comando | Qué comprueba | Resultado esperado |
| --- | --- | --- | --- |
| 1 | `npm.cmd run check:env` | Versiones de Node y npm, coherencia de dependencias, carga de paquetes, recursos Bootstrap y verificación de contraseñas con Argon2. | Todas las comprobaciones muestran `OK` y el resumen indica que son correctas. |
| 2 | `npm.cmd run check:db` | Conexión a las tres bases, versión de PostgreSQL, identidad del usuario y permisos de acceso. | Un `OK` por entorno: desarrollo, pruebas de integración y pruebas de navegador (E2E). |
| 3 | `npm.cmd run check:tests:http` | Vitest ejecuta una prueba HTTP con Supertest y genera cobertura. | Una prueba correcta e informe `coverage/setup/index.html`. |
| 4 | `npm.cmd run check:tests:browser` | Playwright inicia Chromium, escribe en un campo y comprueba su valor. | Una prueba correcta e informe `playwright-report/setup/index.html`. |

Para ejecutar juntos los pasos 3 y 4:

```powershell
npm.cmd run check:tests
```

Si falla el paso 3, este comando no ejecuta el paso 4.

## Archivos locales para el paso 2

**Debes crear tres archivos en la raíz del proyecto, junto a `package.json`.** Son archivos de texto sin extensión `.txt`. Cada uno guarda la configuración de un entorno: la conexión a su base, el secreto de las sesiones y el puerto del servidor. Si alguno ya existe, revisarlo sin sobrescribir sus credenciales y añadir las líneas que falten.

Antes, las tres bases y sus usuarios deben estar creados en PostgreSQL siguiendo el [manual de base de datos, apartado 2.3](../docs/Manual_base_datos_ReFind.md#23-bases-y-credenciales-de-desarrollo-y-pruebas). Escribir estos archivos no crea las bases ni los usuarios.

### 0. Generar tres secretos de sesión

Cada archivo necesita un secreto distinto para firmar las cookies de sesión. En la terminal, ejecutar este comando **tres veces** y copiar cada resultado (64 caracteres):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### 1. Crear `.env.development`

En el explorador de VS Code, seleccionar la carpeta raíz del proyecto, pulsar **Nuevo archivo** y escribir exactamente `.env.development`. Pegar:

```dotenv
APP_ENV=development
DATABASE_URL=postgresql://refind_dev_user:CONTRASENA_DESARROLLO@127.0.0.1:5432/refind_dev
SESSION_SECRET=SECRETO_DESARROLLO
PORT=3000
```

Sustituir `CONTRASENA_DESARROLLO` por la contraseña que asignaste en PostgreSQL al usuario `refind_dev_user` y `SECRETO_DESARROLLO` por el primer secreto generado. Guardar con **Ctrl+S**.

### 2. Crear `.env.test`

Crear otro archivo en la misma carpeta, llamado exactamente `.env.test`. Pegar:

```dotenv
APP_ENV=test
DATABASE_URL=postgresql://refind_test_user:CONTRASENA_PRUEBAS@127.0.0.1:5432/refind_test
SESSION_SECRET=SECRETO_PRUEBAS
PORT=3002
```

Sustituir `CONTRASENA_PRUEBAS` por la contraseña que asignaste en PostgreSQL al usuario `refind_test_user` y `SECRETO_PRUEBAS` por el segundo secreto generado. Guardar con **Ctrl+S**.

### 3. Crear `.env.e2e`

Crear otro archivo en la misma carpeta, llamado exactamente `.env.e2e`. Pegar:

```dotenv
APP_ENV=e2e
DATABASE_URL=postgresql://refind_e2e_user:CONTRASENA_E2E@127.0.0.1:5432/refind_e2e
SESSION_SECRET=SECRETO_E2E
PORT=3001
```

Sustituir `CONTRASENA_E2E` por la contraseña que asignaste en PostgreSQL al usuario `refind_e2e_user` y `SECRETO_E2E` por el tercer secreto generado. Guardar con **Ctrl+S**.

### Qué debes cambiar en los ejemplos

- **Contraseñas:** usar las de los tres usuarios de PostgreSQL, no la contraseña de Windows ni la del administrador `postgres`. No dejar los textos `CONTRASENA_...` ni inventar nuevas claves aquí: deben coincidir con las asignadas a cada usuario.
- **Secretos:** usar los tres generados en el paso 0, uno distinto en cada archivo. No dejar los textos `SECRETO_...` ni inventar uno corto: deben tener 64 caracteres.
- **Puerto de PostgreSQL:** los ejemplos usan `5432` en `DATABASE_URL`. Si configuraste PostgreSQL en otro puerto (el manual de base de datos usa `5433`), sustituir `5432` por ese número en los tres archivos.
- **`PORT`:** es el puerto del servidor de ReFind, no el de PostgreSQL. Mantener `3000`, `3002` y `3001`: cada entorno usa uno distinto para poder ejecutarse a la vez.
- **Caracteres especiales:** la contraseña forma parte de una URL. Por ejemplo, `@` se escribe `%40`, `#` como `%23`, `%` como `%25` y `:` como `%3A`. La contraseña ficticia `Ejemplo@123` se escribiría `Ejemplo%40123` en el archivo. Esto solo cambia cómo se escribe en la URL, no la contraseña del usuario en PostgreSQL. Si tu contraseña contiene otros caracteres especiales, necesitas codificarlos también como componente de URL.

Mantener los nombres de bases, usuarios y valores `APP_ENV` tal como aparecen. Copiar solo las cuatro líneas de cada bloque, sin los delimitadores del bloque.

La carpeta debe contener estos archivos al mismo nivel:

```text
Proyecto-Ingenieria-Software/
  package.json
  .env.example
  .env.development
  .env.test
  .env.e2e
```

`.env.example` es solo una plantilla y no sustituye a los tres archivos. Estos archivos locales están excluidos de Git; cada compañero utiliza sus propias credenciales. No compartir su contenido.

### Después de guardarlos

Con PostgreSQL iniciado y el paso 1 (`check:env`) correcto, ejecutar desde la raíz:

```powershell
npm.cmd run check:db
```

El script lee automáticamente los tres archivos. No hay que abrirlos en la terminal ni activarlos. Debe mostrar un `OK` para cada entorno.

`check:db` solo comprueba la conexión. Después, crear las tablas con las migraciones según el [manual de base de datos, apartado 3.4](../docs/Manual_base_datos_ReFind.md#34-crear-las-tablas-con-las-migraciones), que también comprueba que `SESSION_SECRET` y `PORT` son correctos.

## Cómo interpretar el resultado

- Un comando que termina correctamente devuelve código de salida `0`; un fallo devuelve un código distinto de `0`.
- Ante un fallo, conservar el mensaje y corregir la causa antes de repetir ese paso.
- Registrar quién realizó las comprobaciones, la fecha, el commit del proyecto y el resultado de cada paso. Los informes se generan localmente y no se incluyen en Git.

Superar estos pasos acredita las comprobaciones descritas. Quedan aparte la configuración de VS Code, la instalación limpia reproducible, la escritura y persistencia tras reiniciar PostgreSQL, las conexiones cruzadas reales y las pruebas funcionales del producto. El paso 2 consulta permisos, pero no modifica datos ni intenta conexiones a las bases ajenas.

## Dónde está cada comprobación

| Archivo | Función |
| --- | --- |
| `scripts/check-environment.js` | Comprobaciones del entorno base. |
| `scripts/check-database.js` | Comprobaciones de conexión y permisos de PostgreSQL. |
| `tests/setup/http.js` | Aplicación mínima utilizada para la prueba HTTP. |
| `tests/setup/tools.test.js` | Prueba HTTP con Vitest y Supertest. |
| `tests/setup/browser.spec.js` | Prueba de interacción con Chromium. |
| `vitest.setup.config.js` | Configuración de la prueba HTTP y su cobertura. |
| `playwright.setup.config.js` | Configuración de la prueba de navegador y sus informes. |

## Solo si un comando falla

| Problema | Acción |
| --- | --- |
| PowerShell no reconoce el comando pegado y sugiere `npm.cmd`. | Borrar la línea y escribirla manualmente: puede contener un carácter invisible. No copiar el prefijo de la terminal. |
| No encuentra `package.json`. | Abrir la terminal en la raíz de la copia del proyecto. |
| No encuentra Node/npm, o `check:env` indica una versión incorrecta. | Consultar `Get-Command node,npm.cmd` y resolver la instalación o selección de versión según el apartado 3.3 del manual del entorno. |
| Faltan dependencias o sus versiones no coinciden. | Seguir el apartado de instalación de dependencias del manual del entorno. No reinstalar por rutina si el script pasa. |
| Falla Argon2 o aparece el aviso `allowScripts`. | Revisar el apartado 8.4 del manual del entorno; la instalación limpia sigue pendiente de validación. |
| Falla `check:db`. | Revisar el archivo `.env` del entorno indicado, el servicio PostgreSQL, puerto, credenciales y permisos según el manual de base de datos. |
| Un comando indica `faltan o son incorrectos SESSION_SECRET, PORT`. | Añadir esas líneas al archivo `.env` indicado según [Archivos locales para el paso 2](#archivos-locales-para-el-paso-2). |
| La descarga de Playwright indica `timed out`. | Seguir la [descarga por IPv4](../docs/Manual_pruebas_ReFind.md#descarga-por-ipv4-si-aparece-timed-out) y ejecutar `npm.cmd run check:tests`. |
| Playwright indica que falta el ejecutable del navegador. | Ejecutar `npx.cmd --no-install playwright install chromium --only-shell` como indica el manual de pruebas y repetir la prueba. |

Tras resolver la causa, repetir el comando que falló. Las consultas manuales de diagnóstico no forman parte de la secuencia habitual.



## Arranque y pruebas de la aplicación

### Antes de elegir un comando

Abrir la terminal **Windows PowerShell de VS Code**, como usuario normal, en la raíz del proyecto, donde está `package.json`.

Las dependencias deben estar instaladas, PostgreSQL iniciado y los archivos `.env` completados. Aplicar previamente las migraciones de las bases que se utilizarán. Estos comandos no realizan esa preparación automáticamente.

**Elegir el comando según lo que quieras hacer; no ejecutarlos todos en orden.**

### Utilizar la aplicación mientras desarrollas

```powershell
npm.cmd run dev
```

- **Hace:** arranca ReFind con `.env.development` y la base `refind_dev`. Reinicia el servidor al cambiar los archivos vigilados.
- **Tú haces:** abres en el navegador la dirección que muestra la terminal, normalmente `http://127.0.0.1:3000`, y utilizas la aplicación.
- **Para terminar:** pulsas **Ctrl+C** en esa terminal. Cerrar el navegador no apaga el servidor.

### Ejecutar las pruebas una vez

```powershell
npm.cmd test
```

- **Hace:** ejecuta las pruebas unitarias y de integración disponibles. Las de integración utilizan `.env.test` y `refind_test`.
- **Tú haces:** esperas y lees el resultado. No arrancas antes otro servidor ni abres el navegador: las propias pruebas preparan lo necesario.
- **Para terminar:** termina solo y devuelve el indicador de PowerShell. Si hay pruebas fallidas, revisar el error; una ejecución sin pruebas no valida nada.

### Repetir las pruebas mientras programas con TDD

```powershell
npm.cmd run test:watch
```

- **Hace:** ejecuta las pruebas y permanece esperando cambios para repetir las afectadas. Utiliza la misma configuración que `npm test`.
- **Tú haces:** editas y guardas código; consultas los resultados en la terminal.
- **Para terminar:** pulsas **Ctrl+C**. No termina por sí solo después de la primera ejecución.

### Ejecutar las pruebas automáticas de navegador

```powershell
npm.cmd run test:e2e
```

- **Necesita además:** Chromium de Playwright instalado y el puerto E2E libre. Si tienes `start:e2e` abierto, cerrarlo antes con **Ctrl+C**.
- **Hace:** arranca su propio servidor con `.env.e2e` y `refind_e2e`, ejecuta las pruebas con Chromium y cierra su servidor y navegador al terminar.
- **Tú haces:** esperas y lees el resultado. No arrancas antes la aplicación ni interactúas con el navegador. Chromium trabaja sin ventana visible.
- **Para terminar:** termina solo. El informe queda en `playwright-report/e2e/index.html`.

### Comprobar el proyecto antes de hacer push

```powershell
npm.cmd run verify
```

- **Necesita:** los requisitos de `npm test` y `test:e2e`. No ejecutar a la vez otras pruebas ni mantener abierto `start:e2e`.
- **Hace:** ejecuta `check:env`, después `test` y después `test:e2e`. Se detiene si falla cualquiera.
- **Tú haces:** esperas a que termine y revisas que todo pase. Si falla, corriges la causa y repites.
- **Para terminar:** termina solo. No crea commits ni hace push.

### Abrir la aplicación con una base de pruebas para inspeccionarla tú

Estos dos comandos son auxiliares. **No son pasos previos a las pruebas automáticas.**

| Comando | Archivo y base utilizados | Dirección habitual |
| --- | --- | --- |
| `npm.cmd run start:test` | `.env.test` → `refind_test` | `http://127.0.0.1:3002` |
| `npm.cmd run start:e2e` | `.env.e2e` → `refind_e2e` | `http://127.0.0.1:3001` |

- **Hacen:** dejan el servidor encendido con la base elegida. No ejecutan pruebas automáticas ni reinician al editar código.
- **Tú haces:** abres la dirección indicada en el navegador y utilizas la aplicación para inspeccionar su comportamiento.
- **Para terminar:** pulsas **Ctrl+C** en la terminal donde lo arrancaste. Cerrar el navegador no apaga el servidor.

### Qué se mantiene y qué se cierra

Los puertos de la aplicación proceden de `PORT` en cada `.env`; no son el puerto de PostgreSQL. Los comandos no detienen PostgreSQL al terminar: permanece como servicio de Windows.

No ejecutar `test` y `test:watch` simultáneamente ni utilizar `start:test` mientras se ejecutan las pruebas. Las pruebas de integración actuales eliminan las sesiones de `refind_test` para preparar sus casos.

Actualmente existen pruebas de integración y una prueba E2E de la página inicial y la respuesta 404. La configuración admite futuras pruebas unitarias. Los comandos `check:tests:*` siguen comprobando las herramientas, no las funcionalidades de ReFind.

**Estado:** comandos y configuración preparados; ejecución por el desarrollador pendiente.
