# Manual 2 · Base de datos de ReFind

Versión 1.1 · 1 de octubre de 2026

## 1. Alcance y requisitos

Este manual explica cómo instalar y comprobar estas herramientas en Windows 11 x64:

- **PostgreSQL 17.11:** el servidor que almacena y gestiona los datos del proyecto.
- **pgAdmin 4 9.18:** una aplicación gráfica para conectarnos a PostgreSQL, consultar tablas y datos y ejecutar consultas SQL. La instalamos para trabajar con las bases de datos desde una interfaz visual.

Prepararemos tres bases separadas: `refind_dev` para desarrollo, `refind_test` para pruebas de integración y `refind_e2e` para pruebas de la aplicación desde el navegador. Cada una tendrá su propio usuario de conexión.

Cada desarrollador realizará la instalación y creará sus bases de datos, usuarios y contraseñas en su propio equipo. Las tablas no se crean a mano: se crean con las migraciones del proyecto (apartado 3.4).

## 2. Instalación y configuración de PostgreSQL

Las tres bases del entorno son `refind_dev`, `refind_test` y `refind_e2e`, con un rol diferente para cada una. Los pasos siguientes se realizan manualmente en cada equipo.
### 2.1. Reservar una instalación exclusiva para ReFind

Las instalaciones de otros proyectos se conservan. Para ReFind utilizaremos:

| Elemento | Valor |
| --- | --- |
| Programa | `C:\ReFind\PostgreSQL\17` |
| Datos | `C:\ReFind\datos\postgresql17` |
| Servicio de Windows | `postgresql-refind-17` |
| Dirección | `127.0.0.1` |
| Puerto | `5433` |
| Identificador de la instancia | `refind-local` |

**Dónde:** Windows PowerShell, como usuario normal. Ejecutar:

```powershell
Test-Path 'C:\ReFind\PostgreSQL\17'
Test-Path 'C:\ReFind\datos\postgresql17'
Get-Service -Name 'postgresql-refind-17' -ErrorAction SilentlyContinue
Get-NetTCPConnection -State Listen -LocalPort 5433 -ErrorAction SilentlyContinue
```

**Si los dos primeros devuelven `False` y los otros no muestran nada:** continuar con 2.2.

**Si aparece una carpeta, un servicio o un puerto ocupado:** no sobrescribirlo ni detenerlo. Elegir con el responsable otro valor para el elemento ocupado y sustituirlo en los pasos siguientes. Las instalaciones que estén en otras rutas o puertos no se modifican.

Se requiere Windows 11 de 64 bits. Si no lo has comprobado en el manual del entorno, consultar `winver` y `Get-ComputerInfo | Select-Object OsArchitecture` antes de descargar el instalador.

### 2.2. Instalar y comprobar la instancia ReFind

1. Descargar el instalador de **PostgreSQL 17.11 para Windows x64** desde [PostgreSQL para Windows](https://www.postgresql.org/download/windows/). Si esa versión no está disponible, resolver la descarga con el responsable antes de continuar.
2. En el Explorador de archivos, localizar el instalador descargado. Pulsar **Mayús + botón derecho** sobre él y seleccionar **Copiar como ruta**. Abrir el menú Inicio, buscar **Windows PowerShell** y elegir **Ejecutar como administrador**. Se puede ejecutar desde cualquier carpeta.

En el comando siguiente, sustituir `'C:\RUTA\AL\INSTALADOR.exe'` completo, incluidas sus comillas, por la ruta copiada. La ruta pegada ya incluye comillas dobles: conservarlas. Mantener el resto del comando igual y pulsar **Intro**. Se abrirá el asistente de instalación: Las carpetas, el servicio y el puerto de ReFind se indican mediante los parámetros del comando.

```powershell
& 'C:\RUTA\AL\INSTALADOR.exe' --prefix 'C:\ReFind\PostgreSQL\17' --datadir 'C:\ReFind\datos\postgresql17' --servicename 'postgresql-refind-17' --serverport 5433 --disable-components pgAdmin,stackbuilder
```

3. En el asistente, comprobar las rutas y el puerto indicados. Instalar **PostgreSQL Server** y **Command Line Tools**. Establecer una contraseña nueva para el administrador `postgres` de esta instancia y guardarla localmente. Si el asistente propone actualizar una instalación existente o cambiar una cuenta de servicio existente, cancelar y revisar con el responsable.
4. Finalizar la instalación. No añadir esta instalación al PATH: utilizaremos siempre su ruta completa. Cerrar la terminal de administrador.
5. Abrir `C:\ReFind\datos\postgresql17\postgresql.conf` con un editor elevado y establecer una sola entrada activa para cada valor:

```ini
listen_addresses = '127.0.0.1'
port = 5433
cluster_name = 'refind-local'
```

6. En `C:\ReFind\datos\postgresql17\pg_hba.conf`, comprobar que el acceso TCP local exige contraseña con esta regla y que no hay una regla anterior que permita ese mismo acceso con `trust`:

```text
host    all    all    127.0.0.1/32    scram-sha-256
```

7. Abrir **Servicios** de Windows y reiniciar únicamente **postgresql-refind-17**.
8. En PowerShell normal, definir las rutas de esta instalación y comprobarla:

```powershell
$pgBin = 'C:\ReFind\PostgreSQL\17\bin'
& "$pgBin\psql.exe" --version
Get-CimInstance Win32_Service -Filter "Name='postgresql-refind-17'" | Select-Object Name,State,PathName
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U postgres -d postgres -W -c "SELECT version(), current_setting('cluster_name'), current_setting('data_directory'), inet_server_port();"
```

Introducir la contraseña del administrador de ReFind cuando se solicite. El cliente y el servidor deben indicar **17.11**, el servicio debe estar **Running**, su ruta debe apuntar a la instalación ReFind y la consulta debe devolver **refind-local**, **C:/ReFind/datos/postgresql17** (o la misma ruta con barras invertidas) y **5433**. Si algo difiere, corregirlo antes de crear las bases.

En cada terminal nueva, volver a definir `$pgBin` antes de usar los comandos siguientes.

Los parámetros del instalador están documentados en [EDB: parámetros de instalación](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/).

### 2.3. Bases y credenciales de desarrollo y pruebas

**Dónde:** abrir `psql` desde PowerShell externo como usuario normal. Introducir la contraseña cuando la solicite; no escribirla en el comando.

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U postgres -d postgres -W
```

**Dentro de `psql`**, consultar primero los roles y bases existentes:

```text
\du
\l
```

Solo si faltan, crear los tres roles y sus bases. Si ya existen, comprobar propietarios y permisos sin borrarlos ni restablecer sus contraseñas por rutina. Ejecutar cada instrucción por separado y revisar el resultado:

```sql
CREATE ROLE refind_dev_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE refind_test_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE refind_e2e_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
```

Asignar contraseñas distintas mediante las órdenes interactivas de `psql`:

```text
\password refind_dev_user
\password refind_test_user
\password refind_e2e_user
```

A continuación, en la misma sesión:

```sql
CREATE DATABASE refind_dev OWNER refind_dev_user ENCODING 'UTF8' TEMPLATE template0;
CREATE DATABASE refind_test OWNER refind_test_user ENCODING 'UTF8' TEMPLATE template0;
CREATE DATABASE refind_e2e OWNER refind_e2e_user ENCODING 'UTF8' TEMPLATE template0;
REVOKE CONNECT, TEMPORARY ON DATABASE refind_dev FROM PUBLIC;
REVOKE CONNECT, TEMPORARY ON DATABASE refind_test FROM PUBLIC;
REVOKE CONNECT, TEMPORARY ON DATABASE refind_e2e FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE refind_dev TO refind_dev_user;
GRANT CONNECT, TEMPORARY ON DATABASE refind_test TO refind_test_user;
GRANT CONNECT, TEMPORARY ON DATABASE refind_e2e TO refind_e2e_user;
```

Salir con `\q`. Comprobar desde PowerShell las conexiones de cada usuario:

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_dev_user -d refind_dev -W -c "SELECT current_database(), current_user, 1 AS comprobacion;"
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_test_user -d refind_test -W -c "SELECT current_database(), current_user, 1 AS comprobacion;"
```

**Resultado de los dos comandos anteriores:**

| Comando | Base que debe mostrar | Usuario que debe mostrar | comprobacion |
| --- | --- | --- | --- |
| Primero | `refind_dev` | `refind_dev_user` | `1` |
| Segundo | `refind_test` | `refind_test_user` | `1` |

Si los resultados coinciden, comprobar que el usuario de pruebas no puede entrar en la base de desarrollo. Ejecutar en la misma terminal PowerShell:

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_test_user -d refind_dev -W -c "SELECT current_database(), current_user;"
```

Introducir la contraseña de **refind_test_user**. Debe aparecer un error de **permiso denegado para la base de datos `refind_dev`**. En esta comprobación, ese rechazo es el resultado correcto: el usuario de pruebas no tiene acceso a la base de desarrollo.

Si conecta, revisar los permisos del apartado 2.3 antes de continuar. Un error de contraseña o de conexión no sirve para validar esta comprobación; corregirlo y repetir el comando.

Si las dos conexiones anteriores funcionan y esta última se rechaza por permisos, continuar con **2.4**.

### 2.4. Comprobación de aislamiento

Comprobar también E2E desde PowerShell externo:

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_e2e_user -d refind_e2e -W -c "SELECT current_database(), current_user, 1 AS comprobacion;"
```

Resultado: `refind_e2e`, `refind_e2e_user` y `1`. Repetir las conexiones de cada uno de los tres roles contra las otras dos bases: las seis conexiones cruzadas deben rechazarse. Conservar las conexiones correctas de cada rol con su propia base.

### 2.5. Instalación y configuración de pgAdmin 4

Descargar **pgAdmin 4 9.18** desde las [descargas oficiales](https://www.pgadmin.org/download/pgadmin-4-windows/). Instalarlo para ReFind en una carpeta propia, por ejemplo `C:\ReFind\pgAdmin4`. Si el instalador propone sustituir otra instalación, cancelar: hay que resolver una instalación separada antes de continuar. No borrar perfiles ni conexiones existentes. Abrir la copia instalada para ReFind y comprobar **Help > About: 9.18**.

Abrir pgAdmin y seleccionar **Register > Server**. Crear tres conexiones con nombres `ReFind desarrollo`, `ReFind integración` y `ReFind E2E`. En **Connection**, establecer host `127.0.0.1`, el puerto **5433** de ReFind, y como **Maintenance database** y **Username** la base y el rol correspondientes del apartado 2.3. Introducir la contraseña local de cada rol; no exportar conexiones con contraseñas para compartirlas.

Abrir **Query Tool** en cada base y ejecutar `SELECT current_database(), current_user;`. Cada conexión debe devolver su propia base y rol. No usar el administrador `postgres` para las consultas habituales de la aplicación. La consulta del cliente PowerShell y la de pgAdmin deben coincidir.


## 3. Validación independiente de la base de datos

Completar las comprobaciones del apartado 2: versión de cliente y servidor, servicio, puerto, tres conexiones correctas y seis conexiones cruzadas rechazadas. Confirmar las tres conexiones en pgAdmin.

### 3.1. Escritura y lectura por cada rol

Abrir `psql` con cada rol en su propia base usando los comandos del apartado 2.3 y 2.4. Ejecutar este bloque dentro de `psql` y revisar cada resultado:

```sql
BEGIN;
CREATE TABLE public.refind_install_check (id integer PRIMARY KEY, valor text NOT NULL);
INSERT INTO public.refind_install_check VALUES (1, 'ReFind');
SELECT id, valor FROM public.refind_install_check;
ROLLBACK;
```

Resultado esperado: la fila `1, ReFind` y finalización correcta de todas las instrucciones. `ROLLBACK` revierte únicamente los cambios de esta transacción de comprobación. Si la tabla ya existe, no borrarla: ejecutar `ROLLBACK`, identificar su procedencia y usar un nombre de comprobación libre antes de repetir. Repetir en las tres bases con sus respectivos roles; no usar `postgres` para esta comprobación.

### 3.2. Persistencia después de reiniciar el servicio

En `refind_dev`, como `refind_dev_user`, comprobar primero que el nombre está libre:

```sql
SELECT to_regclass('public.refind_install_persistence');
```

Si devuelve `NULL`, ejecutar:

```sql
CREATE TABLE public.refind_install_persistence (id integer PRIMARY KEY, valor text NOT NULL);
INSERT INTO public.refind_install_persistence VALUES (1, 'ReFind');
SELECT * FROM public.refind_install_persistence;
```

Si ya existe, inspeccionar sus datos y procedencia antes de continuar; no sobrescribirlos. Esta tabla se utiliza únicamente para comprobar que los datos se conservan después de reiniciar PostgreSQL.

Salir con `\q`, cerrar las conexiones de pgAdmin y reiniciar únicamente el servicio `postgresql-refind-17` desde Servicios de Windows. Reconectar con `refind_dev_user` y ejecutar de nuevo `SELECT * FROM public.refind_install_persistence;`: debe devolver la misma fila. Conservar el marcador hasta cerrar la validación; su retirada se hará de forma explícita después, sin tocar datos ajenos.

### 3.3. Comprobar la conexión desde Node

**Dónde:** en VS Code, abrir una terminal Windows PowerShell en la carpeta del proyecto, donde está `package.json`. PostgreSQL debe estar iniciado y las dependencias Node instaladas.

**1. Crear los tres archivos de conexión.** En el explorador de VS Code, crear estos archivos junto a `package.json`. Si ya existen, revisar su contenido y añadir las líneas que falten.

Cada archivo tiene cuatro líneas: el entorno, la conexión a su base, un secreto para firmar las cookies de sesión y el puerto del servidor.

Antes de crearlos, generar **tres secretos distintos**, uno para cada archivo. Ejecutar este comando tres veces en la terminal y copiar cada resultado:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Archivo **`.env.development`**:

```dotenv
APP_ENV=development
DATABASE_URL=postgresql://refind_dev_user:CLAVE_DESARROLLO@127.0.0.1:5433/refind_dev
SESSION_SECRET=SECRETO_DESARROLLO
PORT=3000
```

Archivo **`.env.test`**:

```dotenv
APP_ENV=test
DATABASE_URL=postgresql://refind_test_user:CLAVE_PRUEBAS@127.0.0.1:5433/refind_test
SESSION_SECRET=SECRETO_PRUEBAS
PORT=3002
```

Archivo **`.env.e2e`**:

```dotenv
APP_ENV=e2e
DATABASE_URL=postgresql://refind_e2e_user:CLAVE_E2E@127.0.0.1:5433/refind_e2e
SESSION_SECRET=SECRETO_E2E
PORT=3001
```

Sustituir cada `CLAVE_...` por la contraseña asignada a ese usuario en 2.3. Los caracteres especiales deben codificarse para URL: por ejemplo, `@` como `%40`, `#` como `%23` y `%` como `%25`. Si elegiste otro puerto en 2.1, sustituir `5433` por ese puerto.

Sustituir cada `SECRETO_...` por uno de los secretos generados: uno distinto en cada archivo, de 64 caracteres. No usar textos inventados ni repetir el mismo secreto. Mantener los valores de `PORT` indicados: cada entorno usa un puerto distinto para poder ejecutarse a la vez.

Guardar los archivos con **Ctrl+S**, sin extensión `.txt`. Git los ignora: no se suben al repositorio. No compartir su contenido.

**2. Comprobar las conexiones.** Ejecutar en la terminal:

```powershell
npm.cmd run check:db
```

Deben aparecer estas tres líneas:

```text
OK: development: conexión, versión y permisos.
OK: test: conexión, versión y permisos.
OK: e2e: conexión, versión y permisos.
```

Si aparece `ERROR`, revisar el archivo `.env` indicado, la contraseña y que el servidor esté iniciado. Corregir la causa y repetir antes de continuar.

**3. Confirmar que Node conecta al servidor de ReFind.** Copiar todo el bloque siguiente, pegarlo en la misma terminal y pulsar **Intro**. Incluir la primera y la última línea. No pegarlo dentro de `psql` ni en los archivos `.env`.

El bloque consulta el nombre y puerto del servidor sin cambiar datos. Si elegiste otros valores en 2.1, sustituir `5433` y `refind-local` por los acordados antes de ejecutarlo.

```powershell
@'
import { readFileSync } from "node:fs"; import { parseEnv } from "node:util"; import pg from "pg"; for (const mode of ["development", "test", "e2e"]) { const env = parseEnv(readFileSync(".env." + mode, "utf8")); const client = new pg.Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 5000 }); try { await client.connect(); const { rows: [r] } = await client.query("SELECT current_setting($1) AS instancia, inet_server_port() AS puerto", ["cluster_name"]); if (r.instancia !== "refind-local" || r.puerto !== 5433) throw new Error("Instancia incorrecta"); console.log(mode + ": OK instancia ReFind"); } catch { console.error(mode + ": ERROR al comprobar instancia ReFind"); process.exitCode = 1; } finally { await client.end(); } }
'@ | node --input-type=module
```

El resultado debe ser:

```text
development: OK instancia ReFind
test: OK instancia ReFind
e2e: OK instancia ReFind
```

Si aparecen las tres líneas, continuar con **3.4**. Si aparece `ERROR`, revisar el puerto de los `.env` y el valor `cluster_name` configurado en 2.2. Repetir hasta obtener el resultado esperado.

### 3.4. Crear las tablas con las migraciones

**Estado:** migraciones preparadas; pendientes de validar en el equipo de cada desarrollador.

Las tablas de ReFind no se crean a mano en `psql` ni en pgAdmin. Están definidas en la carpeta `migrations/` del proyecto y se crean con un comando, de modo que todos los desarrolladores tienen las mismas tablas en sus tres bases.

| Migración | Tabla que crea |
| --- | --- |
| `001_create-users.js` | `users`: usuarios registrados |
| `002_create-session.js` | `session`: sesiones de los usuarios conectados |

**Dónde:** terminal Windows PowerShell de VS Code, en la carpeta del proyecto. PostgreSQL debe estar iniciado y el apartado 3.3 correcto.

**1. Comprobar la configuración completa.** Copiar el bloque, pegarlo en la terminal y pulsar **Intro**. Muestra el entorno y el puerto de cada archivo `.env`, nunca contraseñas ni secretos:

```powershell
node --input-type=module -e "import { readConfig } from './src/config.js'; for (const m of ['development', 'test', 'e2e']) { try { const c = readConfig(m); console.log('OK', m, '| puerto', c.PORT); } catch (e) { console.log('ERROR', m, '->', e.message); } }"
```

Resultado esperado:

```text
OK development | puerto 3000
OK test | puerto 3002
OK e2e | puerto 3001
```

Si aparece `ERROR`, el mensaje indica qué dato revisar en ese archivo `.env`. Corregirlo y repetir.

**2. Aplicar las migraciones a las tres bases.** Ejecutar uno a uno:

```powershell
npm.cmd run db:migrate
npm.cmd run db:migrate:test
npm.cmd run db:migrate:e2e
```

Cada comando debe terminar así (con `test` y `e2e` en los otros dos):

```text
development: aplicada 001_create-users
development: aplicada 002_create-session
development: 2 migraciones aplicadas.
```

Si aparece `relation "users" already exists`, en esa base existe una tabla `users` creada a mano antes de las migraciones. Si no contiene datos que haya que conservar, eliminarla con el usuario de esa base y repetir el comando. Por ejemplo, en desarrollo:

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_dev_user -d refind_dev -W -c "DROP TABLE users;"
```

Si contiene datos, consultar al responsable antes de borrarla.

**3. Comprobar las tablas.** Ejecutar:

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_dev_user -d refind_dev -W -c "\dt"
```

Deben aparecer tres tablas cuyo dueño es `refind_dev_user`: `users`, `session` y `pgmigrations`. La última la crea la herramienta para anotar qué migraciones se han aplicado. Repetir con `refind_test_user`/`refind_test` y `refind_e2e_user`/`refind_e2e` para comprobar las otras dos bases.

**4. Comprobar que no se repiten.** Ejecutar de nuevo:

```powershell
npm.cmd run db:migrate
```

Resultado esperado: `development: la base de datos ya estaba al día; no hay migraciones pendientes.`

**Cuando lleguen migraciones nuevas.** Si después de `git pull` hay archivos nuevos en `migrations/`, ejecutar otra vez los tres comandos del paso 2. Solo se aplican las migraciones que falten en cada base.

**Normas para modificar las tablas:**

- No crear ni modificar tablas a mano en `psql` ni en pgAdmin.
- No modificar una migración que ya se haya compartido. Cada cambio se añade en un archivo nuevo de `migrations/` con el número siguiente, por ejemplo `003_...js`.
- No borrar ni modificar la tabla `pgmigrations`.

### 3.5. Anotar el resultado de la instalación

Este paso consiste en guardar qué has comprobado; no instala ni configura nada.

**1. Obtener la versión del proyecto.** Ejecutar en la terminal del proyecto:

```powershell
git rev-parse HEAD
```

Copiar el código que aparece.

**2. Crear una nota personal.** Copiar la ficha siguiente y sustituir los textos entre corchetes. Ajustar las rutas y el puerto si elegiste otros.

```text
Desarrollador: [tu nombre]
Fecha: [día/mes/año]
Versión del proyecto: [código obtenido con git rev-parse HEAD]
Servicio: postgresql-refind-17
Puerto: 5433
Programa: C:\ReFind\PostgreSQL\17
Datos: C:\ReFind\datos\postgresql17

2.2 - Cliente y servidor PostgreSQL 17.11: [OK / Pendiente / Error]
2.3 y 2.4 - Cada usuario conecta a su base: [OK / Pendiente / Error]
2.4 - Las seis conexiones a bases ajenas se rechazan: [OK / Pendiente / Error]
2.5 - pgAdmin 9.18 conecta a las tres bases: [OK / Pendiente / Error]
3.1 - Escritura y lectura con los tres usuarios: [OK / Pendiente / Error]
3.2 - Los datos se conservan después del reinicio: [OK / Pendiente / Error]
3.3 - Node conecta a las tres bases de ReFind: [OK / Pendiente / Error]
3.4 - Configuración completa y migraciones aplicadas en las tres bases: [OK / Pendiente / Error]

Incidencias: [ninguna, o comprobación fallida y mensaje sin contraseñas]
```

**3. Guardar y comunicar la ficha al responsable del proyecto.** Marcar `OK` solo si has realizado la comprobación y obtenido el resultado esperado. No incluir contraseñas ni contenido de los archivos `.env`.

La instalación queda validada cuando todas las comprobaciones están en `OK`. Si alguna falla o está pendiente, indicar cuál.

## 4. Reproducción por otro desarrollador

Cada desarrollador instala las versiones indicadas, crea sus usuarios, bases y contraseñas siguiendo el apartado 2 y realiza las comprobaciones del apartado 3. No copia los datos ni las contraseñas de otro equipo.

Cuando el repositorio incorpore migraciones nuevas, cada desarrollador las aplica en sus tres bases con los comandos del apartado 3.4.
