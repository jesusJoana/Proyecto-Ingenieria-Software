# Manual 2 · Base de datos de ReFind

Versión 1.0 · 25 de septiembre de 2026

## 1. Alcance y requisitos

Este manual prepara y valida PostgreSQL **17.11** y pgAdmin 4 **9.18** en Windows 11 x64, con las bases `refind_dev`, `refind_test` y `refind_e2e` y sus roles separados. La preparación de las bases de pruebas no equivale a configurar los ejecutores de pruebas.

Referencias comunes: [manual del entorno base](Manual_entorno_ReFind.md) para terminal, versiones, paquetes y repositorio; [manual de pruebas](Manual_pruebas_ReFind.md) para los ejecutores. Aplicar la decisión de conservar una herramienta solo si coincide con la versión exacta, instalarla si falta y seleccionar la fijada si difiere. Conservar instalaciones y datos de otros proyectos.

**Estado:** instalación y configuración pendientes de confirmación del desarrollador. Este bloque puede aplazarse sin impedir las comprobaciones del entorno base o la instalación de Chromium.

Los apartados 2 y 3 se realizan manualmente en cada equipo. Las migraciones y el servidor del producto no son requisitos para validar PostgreSQL: se conservan como ejemplos en el anexo A. Quien clone el proyecto reutiliza las migraciones compartidas cuando se implementen; crea sus propios roles, bases y credenciales locales.

## 2. Instalación y configuración de PostgreSQL

Las tres bases del entorno son `refind_dev`, `refind_test` y `refind_e2e`, con un rol diferente para cada una. Los pasos siguientes se realizan manualmente en cada equipo.
### 2.1. Comprobaciones previas

**Dónde:** PowerShell externo, usuario normal, cualquier carpeta.

```powershell
Get-ComputerInfo | Select-Object WindowsProductName,OsVersion,OsArchitecture
Get-Command psql -ErrorAction SilentlyContinue
Get-Service -Name '*postgres*' -ErrorAction SilentlyContinue
Get-NetTCPConnection -State Listen -LocalPort 5432 -ErrorAction SilentlyContinue
```

Si `psql` está disponible, consultar `psql --version`. Si no aparece en el PATH, comprobar la carpeta de instalación antes de reinstalar; la ruta habitual para la serie 17 es `C:\Program Files\PostgreSQL\17\bin`. Una versión del cliente no demuestra la versión del servidor.

Si existe una instancia, identificar su servicio, puerto, versión y uso antes de cambiarla. Solo sirve para ReFind si el servidor y cliente son exactamente 17.11. Si difieren, preparar 17.11 con un servicio, puerto y directorio de datos propios cuando haya que conservar la instancia existente. Una actualización de una instancia usada por otros proyectos necesita revisar sus datos y copias previamente; no se realizará como sustitución automática. No reemplazar instalaciones ni datos de otros proyectos. El puerto inicial de esta guía es **5432**; si está ocupado por otro servicio, elegir **5433** y sustituirlo en todos los comandos y conexiones siguientes.

### 2.2. Instalación y configuración local

**Dónde:** instalador gráfico de PostgreSQL, aceptando la elevación que solicite Windows. Consultas posteriores en PowerShell externo como usuario normal.

1. Desde [PostgreSQL para Windows](https://www.postgresql.org/download/windows/), acceder al instalador de EDB y seleccionar **17.11** para Windows x64. Si no está disponible, detener este paso y resolver la descarga con el equipo; no instalar otra revisión por defecto.
2. Instalar **PostgreSQL Server** y **Command Line Tools**. Desmarcar pgAdmin en este instalador: se instala por separado con la versión exacta en 2.5. No instalar complementos mediante Stack Builder.
3. Registrar la ubicación de instalación y el directorio de datos. Mantener los datos fuera del repositorio y de carpetas sincronizadas con OneDrive.
4. Establecer una contraseña local para el administrador `postgres`, guardarla fuera de Git y seleccionar el puerto comprobado en 2.1. Conservar la configuración regional predeterminada del instalador y registrar su valor.
5. Finalizar y consultar el servicio con `Get-Service -Name '*postgres*'`. Si está detenido, abrir **Servicios** de Windows e iniciar únicamente la instancia identificada; elevar permisos si se solicita.
6. En `postgresql.conf` de esa instancia, comprobar `listen_addresses = 'localhost'`. En `pg_hba.conf`, mantener autenticación con contraseña `scram-sha-256` para conexiones locales TCP (`127.0.0.1/32` y `::1/128`). No usar `trust` ni habilitar acceso externo para este recorrido. Si se modifica la configuración, reiniciar el servicio identificado desde Servicios.

Para utilizar el cliente sin modificar el PATH, establecer su ruta en cada terminal nueva; ajustar si se eligió otra ubicación:

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
& "$pgBin\psql.exe" --version
& "$pgBin\pg_isready.exe" -h 127.0.0.1 -p 5432
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -W -c "SELECT version();"
```

**Validación:** servicio iniciado, puerto correcto, servidor aceptando conexiones y versión acordada devuelta por SQL. `pg_isready` por sí solo no valida credenciales. Resolver cualquier error antes de crear las bases.

### 2.3. Bases y credenciales de desarrollo y pruebas

**Dónde:** abrir `psql` desde PowerShell externo como usuario normal. Introducir la contraseña cuando la solicite; no escribirla en el comando.

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -W
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
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U refind_dev_user -d refind_dev -W -c "SELECT current_database(), current_user, 1 AS comprobacion;"
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U refind_test_user -d refind_test -W -c "SELECT current_database(), current_user, 1 AS comprobacion;"
```

**Validación:** las consultas de desarrollo e integración devuelven su base y usuario correctos. Repetir la conexión de `refind_test_user` apuntando a `refind_dev`: debe ser rechazada por permisos. La aplicación y las pruebas no utilizarán el administrador `postgres`.

La persistencia se comprueba con el marcador técnico del apartado 3.2, sin esperar a implementar la aplicación. No borrar el directorio de datos ni reinstalar para resolver fallos de conexión.

Referencia de las órdenes del cliente: [documentación de psql](https://www.postgresql.org/docs/17/app-psql.html).


### 2.4. Comprobación de aislamiento

Comprobar también E2E desde PowerShell externo:

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U refind_e2e_user -d refind_e2e -W -c "SELECT current_database(), current_user, 1 AS comprobacion;"
```

Resultado: `refind_e2e`, `refind_e2e_user` y `1`. Repetir las conexiones de cada uno de los tres roles contra las otras dos bases: las seis conexiones cruzadas deben rechazarse. Conservar las conexiones correctas de cada rol con su propia base.

### 2.5. Instalación y configuración de pgAdmin 4

Comprobar en Inicio si existe pgAdmin 4 y consultar **Help > About**. Si muestra **9.18**, conservarlo. Si falta o muestra otra versión, descargar el instalador Windows x64 de **pgAdmin 4 9.18** desde las [descargas oficiales](https://www.pgadmin.org/download/pgadmin-4-windows/), ejecutarlo y volver a comprobar **Help > About**. Conservar las configuraciones existentes; no borrar perfiles ni conexiones para cambiar de versión. Esta instalación no sustituye ni modifica el servidor PostgreSQL.

Abrir pgAdmin y seleccionar **Register > Server**. Crear tres conexiones con nombres `ReFind desarrollo`, `ReFind integración` y `ReFind E2E`. En **Connection**, establecer host `127.0.0.1`, el puerto registrado, y como **Maintenance database** y **Username** la base y el rol correspondientes del apartado 2.3. Introducir la contraseña local de cada rol; no exportar conexiones con contraseñas para compartirlas.

Abrir **Query Tool** en cada base y ejecutar `SELECT current_database(), current_user;`. Cada conexión debe devolver su propia base y rol. No usar el administrador `postgres` para las consultas habituales de la aplicación. La consulta del cliente PowerShell y la de pgAdmin deben coincidir.


## 3. Validación independiente de la base de datos

No necesita Express, migraciones de ReFind ni pruebas automatizadas. Completar las comprobaciones de 2: versión de cliente y servidor, servicio, puerto, tres conexiones correctas y seis conexiones cruzadas rechazadas. Confirmar las tres conexiones en pgAdmin.

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

Si ya existe, inspeccionar sus datos y procedencia antes de continuar; no sobrescribirlos. La tabla es exclusivamente un marcador técnico de instalación, no una entidad ni migración del producto.

Salir con `\q`, cerrar las conexiones de pgAdmin y reiniciar únicamente el servicio PostgreSQL identificado desde Servicios de Windows. Reconectar con `refind_dev_user` y ejecutar de nuevo `SELECT * FROM public.refind_install_persistence;`: debe devolver la misma fila. Conservar el marcador hasta cerrar la validación; su retirada se hará de forma explícita después, sin tocar datos ajenos.

### 3.3. Registro y cierre

Desarrollador, fecha, commit, nombre del servicio, puerto y rutas de instalación/datos: por registrar. No anotar contraseñas.

| Comprobación | Resultado esperado | Estado comunicado |
| --- | --- | --- |
| Cliente y servidor | Ambos 17.11 | Pendiente |
| pgAdmin | 9.18 y tres conexiones válidas | Pendiente |
| Servicio y red local | Iniciado y puerto registrado, acceso local autenticado | Pendiente |
| Tres conexiones propias | Base y usuario correctos | Pendiente |
| Seis conexiones cruzadas | Acceso rechazado | Pendiente |
| Escritura/lectura por rol | Correctas en las tres bases, transacciones revertidas | Pendiente |
| Persistencia | Marcador conservado después de reiniciar | Pendiente |

El bloque queda validado cuando se registren todas estas comprobaciones correctas. Conexión de la aplicación desde `pg`, migraciones del producto y pruebas de integración se comprobarán durante su desarrollo; no se presentan como realizadas al validar el servidor de base de datos.

## 4. Reproducción por otro desarrollador

Cada compañero instala las mismas versiones, prepara sus roles, bases y contraseñas y ejecuta 3. No copia directorios de datos ni secretos de otro equipo. Cuando existan migraciones compartidas, las recibe por Git y las aplica según los scripts del proyecto; no las reescribe. El anexo siguiente conserva ejemplos para ese trabajo posterior.
## Anexo A. Configuración de aplicación y migraciones: desarrollo posterior

Estos ejemplos se conservan para la aplicación, no para validar la instalación de PostgreSQL. Prepararlos junto con el anexo A del [manual base](Manual_entorno_ReFind.md). No se han ejecutado ni validado. Los secretos permanecen locales y no se publican en Git.

### A.1. Variables locales

Crear `.env.example` en la raíz con este contenido sin secretos:

```dotenv
APP_ENV=development
DATABASE_URL=postgresql://refind_dev_user:CLAVE_CODIFICADA@127.0.0.1:5432/refind_dev
SESSION_SECRET=SUSTITUIR_POR_UN_SECRETO_LOCAL
PORT=3000
```

Desde el editor, preparar tres archivos locales a partir de esa plantilla:

| Archivo | APP_ENV | Base y usuario de DATABASE_URL | PORT |
| --- | --- | --- | --- |
| `.env.development` | `development` | `refind_dev` / `refind_dev_user` | 3000 |
| `.env.test` | `test` | `refind_test` / `refind_test_user` | 3002 |
| `.env.e2e` | `e2e` | `refind_e2e` / `refind_e2e_user` | 3001 |

Introducir en cada URL la contraseña de su rol, codificando los caracteres especiales como componentes de URL. Si se cambió el puerto de PostgreSQL, reflejarlo en las tres URLs. Generar un secreto diferente para cada archivo con este comando y copiar el resultado únicamente al archivo local correspondiente:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Comprobar que Git ignora los archivos locales y permite compartir la plantilla:

```powershell
git check-ignore .env.development .env.test .env.e2e
git check-ignore .env.example
```

El primer comando debe enumerar los tres archivos. El segundo no debe mostrar salida y devuelve código 1. No copiar contraseñas o secretos al registro de validación.

### A.2. Carga y validación de configuración con Zod

Crear `src/config.js`. Se lee únicamente el archivo seleccionado:

```javascript
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { z } from 'zod';

export function readConfig(mode) {
  if (!['development', 'test', 'e2e'].includes(mode)) {
    throw new Error('Entorno no permitido');
  }
  const input = parseEnv(readFileSync(`.env.${mode}`, 'utf8'));
  const result = z.object({
    APP_ENV: z.literal(mode),
    DATABASE_URL: z.string().url(),
    SESSION_SECRET: z.string().min(64),
    PORT: z.coerce.number().int().min(1024).max(65535),
  }).safeParse(input);
  if (!result.success) throw new Error('Revisar la configuración local');
  const config = result.data;
  const target = new URL(config.DATABASE_URL);
  const suffix = { development: 'dev', test: 'test', e2e: 'e2e' }[mode];
  if (
    target.protocol !== 'postgresql:' ||
    target.hostname !== '127.0.0.1' ||
    target.pathname !== `/refind_${suffix}` ||
    target.username !== `refind_${suffix}_user`
  ) throw new Error('Base o usuario incorrecto para el entorno');
  return config;
}
```

**Comprobación, tras preparar los scripts del anexo A.2 del manual del entorno base:** cambiar temporalmente `PORT` a `incorrecto` en `.env.development`: debe rechazarse el arranque con `Revisar la configuración local`. Restaurarlo. En `.env.test`, cambiar temporalmente el nombre de base a `refind_dev`: `npm.cmd run db:check:test` debe rechazarlo antes de conectar. Restaurar el valor y repetir con éxito.

### A.3. Migración y comandos de base de datos

Crear `migrations/001-entorno.cjs`:

```javascript
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE environment_check (
      id integer PRIMARY KEY,
      label text NOT NULL
    );
    INSERT INTO environment_check VALUES (1, 'ReFind');
    CREATE TABLE session (
      sid varchar NOT NULL PRIMARY KEY,
      sess json NOT NULL,
      expire timestamp(6) NOT NULL
    );
    CREATE INDEX session_expire_idx ON session (expire);
  `);
};
exports.down = (pgm) => {
  pgm.sql('DROP TABLE session; DROP TABLE environment_check;');
};
```

Crear `scripts/database.js`. El procedimiento usa únicamente migraciones ascendentes; no ejecutar `down` durante la instalación:

```javascript
import pg from 'pg';
import { runner } from 'node-pg-migrate';
import { readConfig } from '../src/config.js';

const [action, mode] = process.argv.slice(2);
const config = readConfig(mode);
if (action === 'migrate') {
  await runner({
    databaseUrl: config.DATABASE_URL,
    dir: 'migrations',
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
  });
} else if (action === 'check') {
  const client = new pg.Client({ connectionString: config.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      'SELECT current_database() AS db, current_user AS usuario, label FROM environment_check WHERE id = $1',
      [1],
    );
    if (result.rows.length !== 1 || result.rows[0].label !== 'ReFind') {
      throw new Error('Falta la fila de comprobación');
    }
    console.log(result.rows[0]);
  } finally {
    await client.end();
  }
} else {
  throw new Error('Acción de base de datos no permitida');
}
```

Referencias: esquema de sesiones de [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) y [API de node-pg-migrate](https://salsita.github.io/node-pg-migrate/api). Las migraciones posteriores se añadirán como archivos nuevos; no modificar una migración ya compartida y aplicada.
