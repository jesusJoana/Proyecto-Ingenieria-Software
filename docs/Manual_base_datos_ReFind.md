# Manual 2 · Base de datos de ReFind

Versión 1.0 · 25 de septiembre de 2026

**Destinatarios:** todos los desarrolladores, incluido el primero. Cada uno prepara su propia instalación local siguiendo este mismo manual.

## 1. Alcance y requisitos

Este manual explica cómo instalar y comprobar estas herramientas en Windows 11 x64:

- **PostgreSQL 17.11:** el servidor que almacena y gestiona los datos del proyecto.
- **pgAdmin 4 9.17:** una aplicación gráfica para conectarnos a PostgreSQL, consultar tablas y datos y ejecutar consultas SQL. La instalamos para trabajar con las bases de datos desde una interfaz visual.

Prepararemos tres bases separadas: `refind_dev` para desarrollo, `refind_test` para pruebas de integración y `refind_e2e` para pruebas de la aplicación desde el navegador. Cada una tendrá su propio usuario de conexión.

Cada desarrollador realizará la instalación y creará sus bases de datos, usuarios y contraseñas en su propio equipo.

## 2. Instalación y configuración de PostgreSQL

Las tres bases del entorno son `refind_dev`, `refind_test` y `refind_e2e`, con un rol diferente para cada una. Los pasos siguientes se realizan manualmente en cada equipo.
### 2.1. Reservar una instalación exclusiva para ReFind

Las instalaciones de otros proyectos se conservan. Para ReFind utilizaremos:

| Elemento | Valor |
| --- | --- |
| Programa | `C:\ReFind\PostgreSQL\17` |
| Datos | `C:\ReFind\PostgreSQL\17\data` |
| Servicio de Windows | `postgresql-x64-17` |
| Dirección | `127.0.0.1` |
| Puerto | `5433` |
| Identificador de la instancia | `refind-local` |

**Dónde:** Windows PowerShell, como usuario normal. Ejecutar:

```powershell
Test-Path 'C:\ReFind\PostgreSQL\17'
Test-Path 'C:\ReFind\PostgreSQL\17\data'
Get-Service -Name 'postgresql-x64-17' -ErrorAction SilentlyContinue
Get-NetTCPConnection -State Listen -LocalPort 5433 -ErrorAction SilentlyContinue
```

**Si los dos primeros devuelven `False` y los otros no muestran nada:** continuar con 2.2.

**Si ya completaste esta instalación de ReFind:** no reinstalar; continuar desde el punto pendiente de 2.2.

**Si alguno de esos elementos pertenece a otra instalación o no sabes a cuál pertenece:** detenerse y comunicar el resultado al responsable. No sobrescribir carpetas ni detener servicios. Este procedimiento de instalación gráfica solo se aplica cuando los valores de la tabla están libres.

Se requiere Windows 11 de 64 bits. Si no lo has comprobado en el manual del entorno, consultar `winver` y `Get-ComputerInfo | Select-Object OsArchitecture` antes de descargar el instalador.

### 2.2. Instalar y comprobar la instancia ReFind

Si ya terminaste la instalación, no repetir los puntos 1–4. Continuar desde el primer punto de configuración que tengas pendiente.

1. En [PostgreSQL para Windows](https://www.postgresql.org/download/windows/), pulsar **Download the installer / Descarga el instalador**. En la página de EDB, descargar **PostgreSQL 17.11 para Windows x64**. Si no aparece esa versión, consultar al responsable antes de descargar otra.
2. Abrir el archivo descargado con doble clic y aceptar la solicitud de permisos de Windows si aparece. No es necesario lanzarlo desde PowerShell.
3. Avanzar por el asistente utilizando estos valores:

| Pantalla | Qué indicar |
| --- | --- |
| Installation Directory | `C:\ReFind\PostgreSQL\17` |
| Select Components | Marcar **PostgreSQL Server**, **Command Line Tools** y **pgAdmin 4**. Desmarcar **Stack Builder**. Comprobar la versión de pgAdmin en 2.5. |
| Data Directory | `C:\ReFind\PostgreSQL\17\data` |
| Password | Elegir y confirmar la contraseña del administrador `postgres`. Guardarla localmente; se utilizará en el punto 8. |
| Port | `5433` |
| Advanced Options / Locale | Conservar el valor predeterminado. |

Si el asistente propone actualizar una instalación existente o cambiar una cuenta de servicio existente, cancelar para no afectar a otro proyecto. El recorrido de esta guía requiere que las rutas, el servicio y el puerto de 2.1 estén libres.

4. Finalizar el asistente. Si ofrece abrir Stack Builder, desmarcar esa opción. El servicio de esta instalación se llama **postgresql-x64-17**. Utilizaremos los programas por su ruta completa, sin cambiar el PATH.
5. Abrir **Bloc de notas como administrador** desde Inicio, pulsar **Ctrl+O** y abrir:

```text
C:\ReFind\PostgreSQL\17\data\postgresql.conf
```

Buscar estas propiedades y dejar una sola línea activa para cada una, sin `#` al principio. Guardar con **Ctrl+S**:

```ini
listen_addresses = '127.0.0.1'
port = 5433
cluster_name = 'refind-local'
```

6. En el mismo Bloc de notas, pulsar **Ctrl+O** y abrir:

```text
C:\ReFind\PostgreSQL\17\data\pg_hba.conf
```

Buscar la línea activa que empieza por `host`, tiene `all` en las columnas de base y usuario, y contiene `127.0.0.1/32`. Debe quedar así:

```text
host    all    all    127.0.0.1/32    scram-sha-256
```

Si ya coincide, continuar con el punto 7. Si el método de esa línea es `trust` o `md5`, sustituirlo por `scram-sha-256` y guardar. Si falta la línea o hay reglas anteriores que también admiten esa dirección, consultar al responsable antes de modificarlas. Conservar las reglas de otras direcciones.

7. Abrir **Windows PowerShell como administrador** y ejecutar estas dos líneas, una a una:

```powershell
Restart-Service -Name 'postgresql-x64-17' -ErrorAction Stop
Get-Service -Name 'postgresql-x64-17'
```

El primer comando puede terminar sin mostrar nada. El segundo debe mostrar **Running**. Si aparece un error o no muestra ese estado, resolverlo antes de continuar. Cerrar esta terminal.

8. Abrir **Windows PowerShell como usuario normal**, desde cualquier carpeta. Ejecutar uno a uno:

```powershell
$pgBin = 'C:\ReFind\PostgreSQL\17\bin'
& "$pgBin\psql.exe" --version
Get-CimInstance Win32_Service -Filter "Name='postgresql-x64-17'" | Select-Object Name,State,PathName | Format-List
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U postgres -d postgres -W -c "SELECT current_setting('server_version') AS version, current_setting('listen_addresses') AS direccion, current_setting('port') AS puerto, current_setting('cluster_name') AS instancia, current_setting('data_directory') AS datos;"
```

El último comando pide la contraseña de `postgres` elegida durante la instalación. Al escribirla no aparecen caracteres; introducirla y pulsar **Intro**.

| Comprobación | Resultado esperado |
| --- | --- |
| Versión del cliente | `psql (PostgreSQL) 17.11` |
| Servicio y estado | `postgresql-x64-17`, `Running` |
| PathName del servicio | Ejecutable dentro de `C:\ReFind\PostgreSQL\17\bin` y datos en `C:\ReFind\PostgreSQL\17\data` |
| version | `17.11` |
| direccion | `127.0.0.1` |
| puerto | `5433` |
| instancia | `refind-local` |
| datos | `C:/ReFind/PostgreSQL/17/data`, o la misma ruta con barras invertidas |

Si coincide todo, continuar con **2.3**. Si algo difiere, corregirlo antes de crear las bases.

En cada terminal nueva, ejecutar `$pgBin = 'C:\ReFind\PostgreSQL\17\bin'` antes de usar los comandos que contienen `$pgBin`.

### 2.3. Bases y credenciales de desarrollo y pruebas

**Dónde:** abrir `psql` desde PowerShell externo como usuario normal. Introducir la contraseña cuando la solicite; no escribirla en el comando.

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U postgres -d postgres -W
```

El comando anterior abre una conexión con PostgreSQL como administrador `postgres`, en el puerto `5433`. Introducir su contraseña cuando se solicite. Cuando aparezca `postgres=#`, ya estás dentro de `psql`, la consola de PostgreSQL.

**Dentro de `psql`**, ejecutar uno a uno:

```text
\du
```

Muestra los usuarios y roles existentes. Buscar `refind_dev_user`, `refind_test_user` y `refind_e2e_user` para saber si ya están creados.

```text
\l
```

Muestra las bases de datos existentes y sus propietarios. Buscar `refind_dev`, `refind_test` y `refind_e2e`. En una instalación nueva es normal encontrar las bases `postgres`, `template0` y `template1`; conservarlas.

Estos dos comandos solo consultan información: no crean ni modifican nada. Si la salida ocupa una pantalla y aparece `(END)`, pulsar **q** para volver a `postgres=#`.

Si no aparecen los usuarios ni las bases de ReFind, continuar con su creación a continuación. Si alguno ya existe, no repetir su creación: comprobar su propietario y permisos antes de utilizarlo.

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

Comprobaremos que cada usuario puede entrar en su base y no puede entrar en las otras dos.

**Dónde:** Windows PowerShell externo, como usuario normal. Si sigues dentro de `psql` (aparece `postgres=#`), ejecutar `\q` para salir. En PowerShell, definir la ruta:

```powershell
$pgBin = 'C:\ReFind\PostgreSQL\17\bin'
```

Ejecutar los comandos siguientes **uno a uno**. Cada comando pide la contraseña del usuario indicado con `-U`, aunque la base indicada con `-d` sea de otro usuario.

#### 1. Comprobar el acceso a la base propia

Las conexiones de desarrollo e integración ya se comprobaron en 2.3. Completar la comprobación con el usuario E2E:

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_e2e_user -d refind_e2e -W -c "SELECT current_database(), current_user, 1 AS comprobacion;"
```

Introducir la contraseña de `refind_e2e_user`. Debe devolver `refind_e2e`, `refind_e2e_user` y `1`. Si falla, corregir esta conexión antes de continuar.

#### 2. Comprobar los seis accesos que deben rechazarse

**En todos estos casos, el resultado correcto es un error de permiso denegado para la base solicitada** (`permission denied for database`). Es un rechazo esperado, no un fallo de la instalación.

**Caso 1: `refind_dev_user` intenta entrar en `refind_test`.**

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_dev_user -d refind_test -W -c "SELECT current_database(), current_user;"
```

Introducir la contraseña de **`refind_dev_user`**. Debe denegar el acceso a **`refind_test`**.

**Caso 2: `refind_dev_user` intenta entrar en `refind_e2e`.**

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_dev_user -d refind_e2e -W -c "SELECT current_database(), current_user;"
```

Introducir la contraseña de **`refind_dev_user`**. Debe denegar el acceso a **`refind_e2e`**.

**Caso 3: `refind_test_user` intenta entrar en `refind_dev`.**

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_test_user -d refind_dev -W -c "SELECT current_database(), current_user;"
```

Introducir la contraseña de **`refind_test_user`**. Debe denegar el acceso a **`refind_dev`**.

**Caso 4: `refind_test_user` intenta entrar en `refind_e2e`.**

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_test_user -d refind_e2e -W -c "SELECT current_database(), current_user;"
```

Introducir la contraseña de **`refind_test_user`**. Debe denegar el acceso a **`refind_e2e`**.

**Caso 5: `refind_e2e_user` intenta entrar en `refind_dev`.**

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_e2e_user -d refind_dev -W -c "SELECT current_database(), current_user;"
```

Introducir la contraseña de **`refind_e2e_user`**. Debe denegar el acceso a **`refind_dev`**.

**Caso 6: `refind_e2e_user` intenta entrar en `refind_test`.**

```powershell
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5433 -U refind_e2e_user -d refind_test -W -c "SELECT current_database(), current_user;"
```

Introducir la contraseña de **`refind_e2e_user`**. Debe denegar el acceso a **`refind_test`**.

#### 3. Interpretar el resultado

| Resultado de cada intento | Qué hacer |
| --- | --- |
| Permiso denegado para la base solicitada | Caso correcto. Continuar con el siguiente. |
| Devuelve la base y el usuario | El aislamiento falla. Detenerse y revisar los permisos `REVOKE` y `GRANT` del apartado 2.3. Después repetir las comprobaciones. |
| Contraseña incorrecta | El caso no está comprobado. Repetir con la contraseña del usuario indicado con `-U`. |
| No se puede conectar al servidor u otro error | El caso no está comprobado. Resolver el error y repetirlo. |

Cuando las tres conexiones a las bases propias funcionen y los seis accesos cruzados sean rechazados **por permisos**, el aislamiento queda comprobado. Continuar con **2.5**.

### 2.5. Configurar y comprobar pgAdmin 4

Vamos a guardar tres conexiones en pgAdmin: una para desarrollo, otra para integración y otra para E2E. Utilizan las bases y usuarios creados en 2.3; este apartado no crea nuevas bases ni instala otro servidor.

#### Paso 1. Abrir pgAdmin 9.17

Si ya está abierto y has confirmado la versión 9.17, pasar al paso 2. En otro caso, ejecutar en PowerShell como usuario normal:

```powershell
& 'C:\ReFind\PostgreSQL\17\pgAdmin 4\runtime\pgAdmin4.exe'
```

Pulsar **Help → About**, comprobar **Version: 9.17** y cerrar la ventana de información. Dejar abierta la ventana principal de pgAdmin. PostgreSQL debe seguir iniciado.

#### Paso 2. Crear la conexión de desarrollo

1. En **Dashboard**, pulsar **Add New Server**. Se abre el formulario para registrar una conexión.
2. En la pestaña **General**, escribir **ReFind desarrollo** en **Name**. Mantener **Connect now?** activado.
3. Abrir la pestaña **Connection** y completar:

| Campo | Valor |
| --- | --- |
| Host name/address | `127.0.0.1` |
| Port | `5433` |
| Maintenance database | `refind_dev` |
| Username | `refind_dev_user` |
| Password | La contraseña asignada a `refind_dev_user` en 2.3 |

4. Dejar **Role** y **Service** vacíos. No escribir el nombre del servicio de Windows en **Service**. Dejar **Save password?** desactivado; pgAdmin volverá a pedir la contraseña cuando sea necesario.
5. Pulsar **Save**. Debe aparecer **ReFind desarrollo** bajo **Servers**, en **Object Explorer** (panel izquierdo).

Si ya existe una conexión con ese nombre, abrir sus **Properties** con el botón derecho y revisar los valores en lugar de crear un duplicado. Conservar la entrada **PostgreSQL 17** que ya aparecía; las comprobaciones siguientes utilizan las conexiones llamadas ReFind.

#### Paso 3. Comprobar la conexión de desarrollo

1. En el panel izquierdo, desplegar **ReFind desarrollo → Databases**. Si pide contraseña, introducir la de `refind_dev_user`.
2. Seleccionar **refind_dev**, pulsar el botón derecho y elegir **Query Tool**. Se abre una pestaña para escribir consultas.
3. Pegar esta consulta en el editor:

```sql
SELECT current_database() AS base, current_user AS usuario;
```

4. Ejecutar con **F5**. En **Data Output**, debajo del editor, debe aparecer una fila:

| base | usuario |
| --- | --- |
| refind_dev | refind_dev_user |

Si coincide, continuar con el paso 4. Aunque el explorador muestre otras bases, eso no significa que este usuario pueda conectarse a ellas; sus permisos se comprobaron en 2.4.

#### Paso 4. Crear la conexión de integración

1. Pulsar el botón derecho sobre **Servers**, en el panel izquierdo, y elegir **Register → Server**.
2. En **General → Name**, escribir **ReFind integración**. Mantener **Connect now?** activado.
3. En **Connection**, completar:

| Campo | Valor |
| --- | --- |
| Host name/address | `127.0.0.1` |
| Port | `5433` |
| Maintenance database | `refind_test` |
| Username | `refind_test_user` |
| Password | La contraseña asignada a `refind_test_user` en 2.3 |

4. Dejar **Role** y **Service** vacíos, y **Save password?** desactivado. Pulsar **Save**.
5. Desplegar **ReFind integración → Databases**. Seleccionar **refind_test**, pulsar el botón derecho y elegir **Query Tool**.
6. Pegar la consulta siguiente y pulsar **F5**:

```sql
SELECT current_database() AS base, current_user AS usuario;
```

**Data Output** debe mostrar:

| base | usuario |
| --- | --- |
| refind_test | refind_test_user |

Si coincide, continuar con el paso 5.

#### Paso 5. Crear la conexión E2E

1. Pulsar el botón derecho sobre **Servers** y elegir **Register → Server**.
2. En **General → Name**, escribir **ReFind E2E**. Mantener **Connect now?** activado.
3. En **Connection**, completar:

| Campo | Valor |
| --- | --- |
| Host name/address | `127.0.0.1` |
| Port | `5433` |
| Maintenance database | `refind_e2e` |
| Username | `refind_e2e_user` |
| Password | La contraseña asignada a `refind_e2e_user` en 2.3 |

4. Dejar **Role** y **Service** vacíos, y **Save password?** desactivado. Pulsar **Save**.
5. Desplegar **ReFind E2E → Databases**. Seleccionar **refind_e2e**, pulsar el botón derecho y elegir **Query Tool**.
6. Pegar la consulta siguiente y pulsar **F5**:

```sql
SELECT current_database() AS base, current_user AS usuario;
```

**Data Output** debe mostrar:

| base | usuario |
| --- | --- |
| refind_e2e | refind_e2e_user |

#### Si algo falla

| Resultado | Qué revisar |
| --- | --- |
| Contraseña incorrecta | Usar la contraseña del usuario de esa conexión, no la de `postgres`. En pgAdmin se escribe la contraseña original, sin codificación de URL. |
| No conecta al servidor | PostgreSQL debe estar iniciado. Comprobar dirección `127.0.0.1` y puerto `5433`. |
| Base inexistente o permiso denegado | Comprobar **Maintenance database**, **Username** y que se completaron 2.3 y 2.4. |
| La consulta muestra otra base o usuario | Cerrar esa pestaña de consulta y abrir **Query Tool** desde la base de la conexión ReFind correspondiente. Revisar sus propiedades si sigue sin coincidir. |

Corregir el dato y repetir la conexión y consulta que fallaron antes de continuar.

**Fin del apartado:** deben existir las tres conexiones y cada consulta debe devolver su base y usuario correctos. Continuar con **3.1**.

Referencia de los campos de conexión: [pgAdmin 9.17, Server Dialog](https://www.pgadmin.org/docs/pgadmin4/9.17/server_dialog.html). Referencia del editor: [Query Tool](https://www.pgadmin.org/docs/pgadmin4/9.17/query_tool.html).

### 2.6. Abrir la consola psql desde PowerShell

`psql` permite escribir y ejecutar consultas SQL desde la terminal, sin abrir pgAdmin.

**Dónde:** abrir Windows PowerShell como usuario normal, desde cualquier carpeta. Ejecutar solo el comando correspondiente al usuario con el que quieras entrar.

**Como administrador de PostgreSQL**, para crear bases y usuarios o revisar la configuración:

```powershell
& 'C:\ReFind\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5433 -U postgres -d postgres -W
```

**Como usuario de desarrollo**, para trabajar en `refind_dev`:

```powershell
& 'C:\ReFind\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5433 -U refind_dev_user -d refind_dev -W
```

**Como usuario de integración**, para trabajar en `refind_test`:

```powershell
& 'C:\ReFind\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5433 -U refind_test_user -d refind_test -W
```

**Como usuario E2E**, para trabajar en `refind_e2e`:

```powershell
& 'C:\ReFind\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5433 -U refind_e2e_user -d refind_e2e -W
```

Cuando aparezca **Contraseña:**, introducir la contraseña del usuario indicado con `-U` y pulsar **Intro**. No aparecen caracteres mientras la escribes.

Si entras como administrador, aparecerá `postgres=#`. Como usuario de desarrollo aparecerá `refind_dev=>`; los otros usuarios mostrarán el nombre de su base. Ya estás dentro de `psql`: escribir allí las consultas SQL, terminadas en `;`.

Para comprobar la conexión, ejecutar dentro de `psql`:

```sql
SELECT current_database(), current_user;
```

Debe mostrar la base y el usuario elegidos. Para salir de `psql` y volver a PowerShell, ejecutar:

```text
\q
```

Si una consulta muestra `(END)`, pulsar **q** para cerrar la vista del resultado; después puedes seguir escribiendo en `psql`.

## 3. Validación independiente de la base de datos

Completar las comprobaciones del apartado 2: versión de cliente y servidor, servicio, puerto, tres conexiones correctas y seis conexiones cruzadas rechazadas. Confirmar las tres conexiones en pgAdmin.

### 3.1. Escritura y lectura por cada rol

Comprobaremos que cada usuario puede crear una tabla, guardar un dato y leerlo en su propia base. Al terminar cada prueba, desharemos sus cambios.

**Dónde:** Windows PowerShell, como usuario normal, desde cualquier carpeta. Si estás dentro de `psql`, ejecutar `\q` para volver a PowerShell.

#### Paso 1. Comprobar la base de desarrollo

En **PowerShell**, ejecutar:

```powershell
& 'C:\ReFind\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5433 -U refind_dev_user -d refind_dev -W
```

Introducir la contraseña de **`refind_dev_user`** y pulsar Intro. No se muestran caracteres al escribirla. Cuando aparezca **`refind_dev=>`**, ejecutar estas instrucciones **una a una dentro de psql**:

```sql
BEGIN;
CREATE TABLE public.refind_install_check (id integer PRIMARY KEY, valor text NOT NULL);
INSERT INTO public.refind_install_check VALUES (1, 'ReFind');
SELECT id, valor FROM public.refind_install_check;
ROLLBACK;
```

La consulta debe mostrar la fila **`1 | ReFind`**, sin errores en las instrucciones. Al finalizar, salir a PowerShell:

```text
\q
```

#### Paso 2. Comprobar la base de integración

En **PowerShell**, ejecutar:

```powershell
& 'C:\ReFind\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5433 -U refind_test_user -d refind_test -W
```

Introducir la contraseña de **`refind_test_user`** y pulsar Intro. No se muestran caracteres al escribirla. Cuando aparezca **`refind_test=>`**, ejecutar estas instrucciones **una a una dentro de psql**:

```sql
BEGIN;
CREATE TABLE public.refind_install_check (id integer PRIMARY KEY, valor text NOT NULL);
INSERT INTO public.refind_install_check VALUES (1, 'ReFind');
SELECT id, valor FROM public.refind_install_check;
ROLLBACK;
```

La consulta debe mostrar la fila **`1 | ReFind`**, sin errores en las instrucciones. Al finalizar, salir a PowerShell:

```text
\q
```

#### Paso 3. Comprobar la base de E2E

En **PowerShell**, ejecutar:

```powershell
& 'C:\ReFind\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5433 -U refind_e2e_user -d refind_e2e -W
```

Introducir la contraseña de **`refind_e2e_user`** y pulsar Intro. No se muestran caracteres al escribirla. Cuando aparezca **`refind_e2e=>`**, ejecutar estas instrucciones **una a una dentro de psql**:

```sql
BEGIN;
CREATE TABLE public.refind_install_check (id integer PRIMARY KEY, valor text NOT NULL);
INSERT INTO public.refind_install_check VALUES (1, 'ReFind');
SELECT id, valor FROM public.refind_install_check;
ROLLBACK;
```

La consulta debe mostrar la fila **`1 | ReFind`**, sin errores en las instrucciones. Al finalizar, salir a PowerShell:

```text
\q
```

#### Qué hace cada instrucción

| Instrucción | Función | Resultado esperado |
| --- | --- | --- |
| `BEGIN` | Inicia una transacción para poder deshacer la prueba. | `BEGIN` |
| `CREATE TABLE` | Crea una tabla de comprobación. | `CREATE TABLE` |
| `INSERT` | Guarda el dato de prueba. | `INSERT 0 1` |
| `SELECT` | Lee el dato guardado. | Una fila con `1` y `ReFind` |
| `ROLLBACK` | Deshace la creación de la tabla y el dato de esta prueba. | `ROLLBACK` |

Si aparece un error, ejecutar `ROLLBACK;` dentro de `psql` y detener esa comprobación. Si indica que la tabla ya existe, no borrarla: revisar su procedencia antes de repetir con un nombre de prueba libre. No marcar el caso como correcto solo porque `ROLLBACK` termine bien.

Si aparece `(END)` al mostrar el resultado, pulsar **q** para volver al indicador de `psql` y continuar con `ROLLBACK;`.

Cuando las pruebas de las tres bases terminen correctamente, continuar con **3.2**.

### 3.2. Comprobar que los datos se conservan al reiniciar PostgreSQL

Guardaremos un dato en la base de desarrollo, reiniciaremos realmente el servicio y comprobaremos que el dato sigue ahí.

#### Paso 1. Entrar en la base de desarrollo

Abrir **Windows PowerShell como usuario normal**, desde cualquier carpeta. Ejecutar:

```powershell
& 'C:\ReFind\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5433 -U refind_dev_user -d refind_dev -W
```

Introducir la contraseña de **refind_dev_user**. Cuando aparezca `refind_dev=>`, continuar con el paso 2.

#### Paso 2. Crear y guardar el dato de prueba

Dentro de **psql**, comprobar primero si existe la tabla:

```sql
SELECT to_regclass('public.refind_install_persistence');
```

- **Resultado vacío (`NULL`):** la tabla no existe. Ejecutar las instrucciones siguientes una a una.
- **Aparece un nombre de tabla:** detenerse y revisar su procedencia antes de continuar. No borrarla ni sobrescribir sus datos.

```sql
CREATE TABLE public.refind_install_persistence (id integer PRIMARY KEY, valor text NOT NULL);
INSERT INTO public.refind_install_persistence VALUES (1, 'ReFind');
SELECT id, valor FROM public.refind_install_persistence;
```

Deben aparecer `CREATE TABLE`, `INSERT 0 1` y esta fila:

```text
 id | valor
----+--------
  1 | ReFind
```

En esta sesión nueva, `psql` guarda cada instrucción automáticamente. **No ejecutar `BEGIN` ni `ROLLBACK` en esta prueba:** necesitamos conservar la tabla y el dato para comprobarlos después del reinicio.

Si aparece un error, resolverlo antes de continuar.

#### Paso 3. Cerrar las conexiones

Salir de **psql**:

```text
\q
```

Si el resultado muestra `(END)`, pulsar primero **q** y después ejecutar `\q`.

En pgAdmin, cerrar las pestañas de **Query Tool** y, con el botón derecho sobre cada conexión ReFind abierta, seleccionar **Disconnect Server**. Cerrar pgAdmin.

#### Paso 4. Reiniciar realmente el servicio

Desde Inicio, abrir **Windows PowerShell → Ejecutar como administrador**. Ejecutar estas dos líneas, una a una:

```powershell
Restart-Service -Name 'postgresql-x64-17' -ErrorAction Stop
Get-Service -Name 'postgresql-x64-17'
```

El primer comando detiene e inicia PostgreSQL; puede terminar sin mostrar ningún mensaje. El segundo debe mostrar **Running**.

Si el reinicio falla o el estado no es `Running`, detenerse y resolver el error. No dar la prueba por superada. Si funciona, cerrar la terminal de administrador.

#### Paso 5. Volver a conectar y leer el dato

En **Windows PowerShell como usuario normal**, ejecutar:

```powershell
& 'C:\ReFind\PostgreSQL\17\bin\psql.exe' -h 127.0.0.1 -p 5433 -U refind_dev_user -d refind_dev -W
```

Introducir la contraseña de **refind_dev_user**. Dentro de **psql**, ejecutar únicamente la consulta; no volver a crear la tabla ni insertar el dato:

```sql
SELECT id, valor FROM public.refind_install_persistence;
```

Debe aparecer de nuevo:

```text
 id | valor
----+--------
  1 | ReFind
```

**Si aparece esa fila, la prueba es correcta:** PostgreSQL ha conservado el dato después del reinicio. Si falta la tabla o la fila, no repetir la creación para darla por válida; revisar lo ocurrido.

Salir con `\q` y continuar con **3.3**. Dejar la tabla de comprobación creada hasta cerrar la validación de la instalación.

### 3.3. Comprobar la conexión desde Node

**Dónde:** en VS Code, abrir una terminal Windows PowerShell en la carpeta del proyecto, donde está `package.json`. PostgreSQL debe estar iniciado y las dependencias Node instaladas.

**1. Crear los tres archivos de conexión.** En el explorador de VS Code, crear estos archivos junto a `package.json`. Si ya existen, revisar su contenido.

Archivo **`.env.development`**:

```dotenv
APP_ENV=development
DATABASE_URL=postgresql://refind_dev_user:CLAVE_DESARROLLO@127.0.0.1:5433/refind_dev
```

Archivo **`.env.test`**:

```dotenv
APP_ENV=test
DATABASE_URL=postgresql://refind_test_user:CLAVE_PRUEBAS@127.0.0.1:5433/refind_test
```

Archivo **`.env.e2e`**:

```dotenv
APP_ENV=e2e
DATABASE_URL=postgresql://refind_e2e_user:CLAVE_E2E@127.0.0.1:5433/refind_e2e
```

Sustituir cada `CLAVE_...` por la contraseña asignada a ese usuario en 2.3. Los caracteres especiales deben codificarse para URL: por ejemplo, `@` como `%40`, `#` como `%23` y `%` como `%25`. Guardar los archivos con **Ctrl+S**, sin extensión `.txt`.

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

El bloque consulta el nombre y puerto del servidor sin cambiar datos.

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

Si aparecen las tres líneas y has completado correctamente las comprobaciones anteriores, la instalación de la base de datos queda comprobada en tu equipo. Si aparece `ERROR`, revisar el puerto de los `.env` y el valor `cluster_name` configurado en 2.2. Repetir hasta obtener el resultado esperado.

## 4. Reproducción por otro desarrollador

Cada desarrollador instala las versiones indicadas, crea sus usuarios, bases y contraseñas siguiendo el apartado 2 y realiza las comprobaciones del apartado 3. No copia los datos ni las contraseñas de otro equipo.
