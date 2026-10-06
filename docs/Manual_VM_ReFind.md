# ReFind: entorno completo en una máquina virtual Windows

**Estado: scripts preparados y pruebas locales realizadas; instalación completa en una VM nueva pendiente de tu ejecución.**

Sigue los apartados en orden. Cada desarrollador prepara su propia VM y sus propias claves. La creación de la VM y la instalación de Windows son manuales; después, los scripts instalan y configuran ReFind.

**Anfitrión** significa tu ordenador actual. **VM** significa el Windows que abrirás dentro de VirtualBox. Los pasos indican dónde ejecutarlos.

## 1. Preparar VirtualBox y Windows — anfitrión

1. Comprueba que tu ordenador tiene procesador Intel/AMD de 64 bits, al menos 16 GB de RAM y espacio libre suficiente: reserva 100 GB para la VM y espacio adicional para instantáneas.
2. Abre **Administrador de tareas → Rendimiento → CPU**. Debe indicar **Virtualización: habilitada**. Si está deshabilitada, activa Intel VT-x o AMD-V/SVM en el firmware del equipo antes de continuar.
3. Descarga e instala el paquete **Windows hosts de VirtualBox 7.2** desde [Oracle](https://www.oracle.com/virtualization/technologies/vm/downloads/virtualbox-downloads.html). El paquete base es libre; este procedimiento no necesita Extension Pack.
4. Elige la descarga de Windows del apartado siguiente. **Para probar la instalación de ReFind sin comprar una licencia, utiliza la opción A.**

### 1.1. Elegir Windows para la VM

| Opción | Cuándo utilizarla |
| --- | --- |
| **A. Evaluación gratuita de 90 días — elegida para esta prueba** | Validar la instalación de los entornos sin comprar una licencia ni introducir una clave de producto. |
| B. Windows con licencia para la VM | Mantener un entorno de uso continuado con una licencia que cubra esa instalación virtual. |

**Opción A: descarga para pruebas**

1. En el anfitrión, abre el [Centro de evaluación de Microsoft](https://www.microsoft.com/en-us/evalcenter/evaluate-windows-11-enterprise).
2. Pulsa **Descargar la ISO de Windows 11 Enterprise**; no selecciones LTSC.
3. Completa el formulario de registro.
4. Selecciona **Español** y **x64 / 64 bits** y descarga el archivo `.iso`.
5. Utiliza esa ISO al crear la VM. Si ya la creaste con otra, apágala y abre **Configuración → Almacenamiento**; selecciona la unidad óptica y, en el icono de disco, elige el archivo ISO de evaluación.

La evaluación es una licencia temporal gratuita, no un Windows sin licencia indefinido. Microsoft no exige una clave de producto para esta descarga. Al vencer los 90 días, el sistema muestra avisos y se apaga cada hora: guarda el trabajo fuera de la VM antes de que termine el plazo y utiliza una licencia adecuada si necesitas continuar. [Condiciones de la evaluación](https://www.microsoft.com/en-us/evalcenter/evaluate-windows-11-enterprise).

**Opción B:** descarga la [ISO habitual de Windows 11 x64](https://www.microsoft.com/software-download/windows11) y utiliza una licencia válida para esa VM. Las pantallas de edición, clave y cuenta pueden diferir de las descritas aquí para Enterprise Evaluation.

**El resto del recorrido de instalación de Windows de este manual corresponde a la opción A.** Los scripts de ReFind se ejecutan después de llegar al escritorio.

**Comprobación:** puedes abrir VirtualBox y tienes el archivo `.iso` descargado. No instales PostgreSQL ni Node en el anfitrión para realizar este procedimiento.

## 2. Crear la máquina virtual — anfitrión

En VirtualBox, pulsa **Nueva / New** y configura:

| Campo | Valor |
| --- | --- |
| Nombre | `ReFind-Windows11` |
| Carpeta | Una carpeta local con espacio, fuera de OneDrive |
| Imagen ISO | La ISO descargada |
| Sistema | Windows 11 de 64 bits |
| Instalación desatendida | Omitir / Skip Unattended Installation |
| Memoria | 8192 MB |
| Procesadores | 4, si puedes dejar recursos suficientes al anfitrión; en caso contrario, 2 |
| Disco | Nuevo, VDI, 100 GB, reservado dinámicamente |

En VirtualBox, **en el anfitrión**, selecciona la VM apagada y abre **Configuración / Settings**:

1. Selecciona **Expert → Sistema → Placa base**. Comprueba **8192 MB**, **TPM Version: 2.0**, **UEFI** y **Secure Boot** activados. UEFI es la opción denominada EFI en algunas versiones.
2. En **Red / Network**, deja el adaptador 1 en **NAT**. No añadas redirecciones de puertos.
3. Conserva deshabilitados el portapapeles compartido y arrastrar y soltar.

Estas opciones corresponden al [manual oficial de VirtualBox 7.2](https://download.virtualbox.org/virtualbox/UserManual.pdf). Si Windows rechaza los requisitos del equipo, revisa EFI, TPM y recursos; no omitas sus comprobaciones.

## 3. Instalar Windows — dentro de la VM

### 3.1. Arrancar desde la ISO

1. En VirtualBox, selecciona `ReFind-Windows11` y pulsa **Iniciar**.
2. Haz clic dentro de la pantalla de la VM. Cuando aparezca **Press any key to boot from CD or DVD…**, pulsa **Enter inmediatamente**.
3. Si se agota el tiempo y aparece el aviso de fallo de arranque, selecciona la ISO **Enterprise Evaluation** en el campo **DVD**, pulsa **Montar y reintentar inicio** y repite el paso anterior.

**Resultado:** se abre **Configuración de Windows 11**. Desde aquí trabajas dentro de la VM.

### 3.2. Idioma e inicio de la instalación

Las primeras pantallas pueden variar con la revisión de la ISO. Sigue la fila correspondiente cuando aparezca:

| Pantalla | Qué seleccionar |
| --- | --- |
| Configuración de idioma | Español y formato regional de España; **Siguiente**. |
| Configuración de teclado | Teclado Español; **Siguiente**. |
| Seleccionar opción de configuración | **Instalar Windows 11**. Si solicita aceptar que se eliminará el contenido, marca la casilla: estamos instalando en el disco virtual nuevo y vacío. Pulsa **Siguiente**. |
| Términos de licencia | Lee las condiciones y pulsa **Aceptar** si estás conforme. |
| Petición de clave de producto | No corresponde al recorrido de esta ISO de evaluación. Comprueba qué ISO está montada antes de continuar. |

### 3.3. Seleccionar ubicación para instalar Windows 11

Esta es la pantalla con las opciones **Actualizar**, **Cargar controlador**, **Eliminar partición**, **Formatear la partición** y **Crear partición**.

1. En la tabla, selecciona **Disco 0 Espacio sin asignar**.
2. Comprueba que **Tamaño total** y **Espacio disponible** indican **100.0 GB**, como en la captura revisada.
3. Deja esa fila seleccionada y pulsa **Siguiente**, abajo a la derecha.

**No tienes que crear ni formatear particiones manualmente**: Windows preparará las necesarias. Este disco es el disco virtual creado para ReFind. Si aparecen discos o particiones con datos en lugar del único disco vacío previsto, detén este paso y revisa el almacenamiento de la VM; no elimines particiones para imitar la captura.

### 3.4. Confirmar e instalar

1. En **Listo para instalar**, comprueba que la edición indicada corresponde a **Windows 11 Enterprise** y pulsa **Instalar**.
2. Espera mientras Windows copia los archivos. La VM se reiniciará durante el proceso.
3. En esos reinicios, si vuelve a aparecer **Press any key to boot from CD or DVD…**, **no pulses ninguna tecla**. Ahora debe continuar desde el disco virtual, no iniciar de nuevo la instalación desde la ISO.

Referencia para las pantallas de selección de disco y confirmación: [instalación con medios de Windows, Microsoft](https://support.microsoft.com/es-es/windows/deployment/install-upgrade/reinstall-windows-with-the-installation-media). Aquí utilizamos un disco virtual vacío; no aplicamos sus instrucciones de borrado para reinstalar un equipo existente.

### 3.5. Configuración inicial de Windows

Después de la instalación aparece el asistente de configuración. El orden y las opciones de cuenta pueden variar según la ISO; estas pantallas posteriores aún están pendientes de contrastar durante nuestra ejecución.

| Cuando aparezca | Qué hacer |
| --- | --- |
| País o región | Selecciona **España** y confirma. |
| Distribución de teclado | Selecciona **Español** y confirma. |
| Segunda distribución de teclado | Pulsa **Omitir**, si no necesitas otra. |
| Conexión a una red | Utiliza la conexión Ethernet proporcionada por NAT. No necesitas configurar Wi-Fi dentro de la VM. |
| Nombre del dispositivo, si lo solicita | Escribe `REFIND-VM` y continúa; puede reiniciarse. |
| Cuenta de usuario | Para esta VM de pruebas, utiliza la opción de cuenta local si el asistente la ofrece; sigue los pasos de debajo. |
| PIN y privacidad | Configura tu PIN si se solicita y revisa las opciones de privacidad antes de aceptarlas. |

**Cuenta para la VM de pruebas:**

1. En la pantalla que pide una cuenta de trabajo o educativa, abre **Opciones de inicio de sesión**.
2. **Si aparece** **Unirse a un dominio en su lugar**, selecciónala para crear una cuenta local. No necesitas indicar un dominio para crearla.
3. Introduce como usuario `desarrollador`, establece una contraseña y completa las preguntas de recuperación si aparecen. Conserva estos datos localmente.
4. Si esa opción no aparece, detente y revisa la pantalla antes de continuar: su disponibilidad en la ISO descargada aún no se ha confirmado en esta ejecución.

En nuestra prueba, la cuenta universitaria produjo **801c03ed**: la organización no permite registrar esta VM. Esa pantalla también rechazó la cuenta personal. No es una petición de licencia de Windows; volver a introducir esas cuentas no resuelve la restricción. Si estás en ese error, usa la flecha de atrás para volver a las opciones de inicio de sesión.

Utiliza la misma cuenta Windows para desarrollar y para elevar permisos con **Ejecutar como administrador** en los apartados posteriores. Si la elevación exige credenciales de otro usuario, hay que resolver los permisos de tu cuenta antes de ejecutar los scripts.

**Resultado:** aparece el escritorio de Windows dentro de la VM.

### 3.6. Actualizar y preparar la copia de partida

1. Dentro de la VM, abre **Inicio → Configuración → Windows Update → Buscar actualizaciones**. Instala las actualizaciones y reinicia cuando lo solicite.
2. En **Configuración → Sistema → Activación**, comprueba el estado de la evaluación con la VM conectada a Internet. La evaluación dura 90 días; no es una licencia permanente.
3. En el menú superior de la ventana de VirtualBox, selecciona **Dispositivos → Insertar imagen de CD de las Guest Additions**.
4. Dentro de la VM, abre **Explorador de archivos → Este equipo → Unidad de CD de VirtualBox Guest Additions**. Ejecuta `VBoxWindowsAdditions.exe`, acepta la elevación, completa el asistente y reinicia.
5. Apaga Windows desde **Inicio → Encendido → Apagar**.
6. En el administrador de VirtualBox del anfitrión, selecciona la VM apagada, abre **Instantáneas / Snapshots**, pulsa **Tomar** y escribe `Windows-limpio`.

**Comprobación:** la VM inicia Windows y permite navegar por Internet. Esta instantánea permite repetir la prueba desde cero sin afectar al anfitrión.

## 4. Preparar el paquete del proyecto — anfitrión

**Para qué:** llevar a la VM el código actual, incluidos estos scripts aunque todavía no se hayan subido a GitHub.

Abre una terminal PowerShell normal en la raíz del proyecto, donde está `package.json`. Ejecuta:

```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\ReFindEntrega" -Force
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\provision\windows\Export-Bundle.ps1 -Destination "$env:USERPROFILE\ReFindEntrega\ReFind-VM.zip"
```

**Resultado:** `OK:` seguido de la ruta del ZIP. Si ya existe, elige otro nombre de ZIP; el script no lo reemplaza.

El paquete incluye el historial Git y los archivos de trabajo, con los cambios todavía sin commit. Excluye del contenido de trabajo los `.env` reales, dependencias y archivos ignorados. El historial Git se conserva tal como existe: utiliza el paquete únicamente para trasladar tu proyecto a tu VM.

## 5. Copiar y extraer el paquete — VM

1. Con la VM apagada, abre **Configuración → Carpetas compartidas → Añadir**.
2. Selecciona la carpeta `ReFindEntrega` creada en tu perfil del anfitrión.
3. Pon como nombre compartido **ReFindEntrega** y marca **Solo lectura**. No compartas todo tu disco ni tu carpeta de usuario.
4. Inicia la VM. Abre el Explorador y escribe `\\VBOXSVR\ReFindEntrega` en su barra de direcciones.
5. Copia `ReFind-VM.zip` a **Descargas de la VM**.
6. En la VM, abre **Windows PowerShell como usuario normal**, desde cualquier carpeta, y ejecuta:

```powershell
Unblock-File -LiteralPath "$env:USERPROFILE\Downloads\ReFind-VM.zip"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\ReFind-VM.zip" -DestinationPath 'C:\ReFind\Entrega'
Test-Path 'C:\ReFind\Entrega\workspace\scripts\provision\windows\Install-Machine.ps1'
```

**Resultado:** `True`. Si cambiaste el nombre del ZIP, sustituye ese nombre en los dos comandos anteriores. La carpeta `Entrega` debe estar vacía o no existir antes de extraer.

## 6. Instalar herramientas y PostgreSQL — VM, administrador

**Para qué:** instalar las versiones del equipo en carpetas propias de ReFind.

En el Inicio de Windows de la VM, busca **Windows PowerShell**, pulsa **Ejecutar como administrador** y acepta UAC con tu misma cuenta. Desde cualquier carpeta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\ReFind\Entrega\workspace\scripts\provision\windows\Install-Machine.ps1
```

El script descarga y prepara:

| Componente | Versión / ubicación |
| --- | --- |
| Node y npm | Las versiones exactas de `package.json`, actualmente 24.21.0 y 11.19.0; `C:\ReFind\Tools\Node` |
| Git CLI, distribución MinGit | 2.55.0.windows.5; `C:\ReFind\Tools\Git` |
| VS Code | 1.139.0; `C:\ReFind\Tools\Code` |
| PostgreSQL y cliente `psql` | 17.11; `C:\ReFind\PostgreSQL\17` |
| pgAdmin | 9.17 incluido con PostgreSQL; su versión se comprueba |
| Datos de PostgreSQL | `C:\ReFind\datos\postgresql17` |
| Servicio de Windows | `postgresql-refind-17`, exclusivo de esta VM |
| Conexión PostgreSQL | `127.0.0.1:5433`, instancia `refind-local` |

Se validan los hashes oficiales de Node y Git y las firmas de Microsoft y EDB. Las versiones auxiliares se fijan en `scripts/provision/windows/versions.json`. La instalación de PostgreSQL utiliza los [parámetros oficiales de EDB](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/command_line_parameters/).

Se generan claves locales distintas y se guardan cifradas para tu cuenta Windows en `%LOCALAPPDATA%\ReFindSetup\secrets.xml`. No tienes que inventarlas ni escribirlas en los scripts. No se instala Stack Builder.

**Resultado esperado:** `OK: fase de administrador terminada...`.

Si aparece un error, no continúes al apartado 7. Consulta el apartado 12. Al terminar correctamente, **cierra la terminal de administrador**.

## 7. Preparar proyecto, bases y pruebas — VM, usuario normal

Abre una nueva **Windows PowerShell normal**, con la misma cuenta Windows. Desde cualquier carpeta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\ReFind\Entrega\workspace\scripts\provision\windows\Prepare-Project.ps1
```

Este script realiza, por orden:

1. Recupera el proyecto y su historial en `C:\ReFind\Proyecto`, conservando los cambios incluidos en el paquete.
2. Ejecuta `npm ci --include=dev` y comprueba las herramientas del proyecto.
3. Crea las tres bases, sus roles y sus permisos; comprueba las seis conexiones cruzadas, que deben rechazarse.
4. Escribe los tres `.env` con claves nuevas, y comprueba que Git los ignora.
5. Aplica las migraciones existentes a las tres bases.
6. Instala Chromium sin interfaz para las pruebas automáticas de Playwright.
7. Configura VS Code y las extensiones ESLint, Prettier y Playwright en un perfil separado.
8. Ejecuta `check:tests` para las herramientas y `verify` para las pruebas de la aplicación ya implementada.

| Entorno | Base | Rol | Archivo | Puerto de la aplicación |
| --- | --- | --- | --- | --- |
| Desarrollo | `refind_dev` | `refind_dev_user` | `.env.development` | 3000 |
| Pruebas | `refind_test` | `refind_test_user` | `.env.test` | 3002 |
| E2E | `refind_e2e` | `refind_e2e_user` | `.env.e2e` | 3001 |

Los tres archivos quedan en la raíz del proyecto. No debes crearlos a mano ni copiar los del anfitrión. Los puertos de esta tabla son de la aplicación; las tres bases utilizan PostgreSQL en el puerto **5433**.

**Resultado esperado:** pruebas correctas y `OK: entorno instalado y pruebas correctas...`. Los scripts se detienen si falla una orden; un mensaje de error no equivale a una instalación terminada.

Si Chromium falla por descarga, ejecuta el mismo paso con la alternativa IPv4:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\ReFind\Entrega\workspace\scripts\provision\windows\Prepare-Project.ps1 -IPv4
```

La alternativa afecta únicamente al proceso de descarga y restaura `NODE_OPTIONS` al terminar. No desactiva la comprobación de certificados.

## 8. Abrir el proyecto y pgAdmin — VM, usuario normal

### 8.1. Abrir VS Code

En Windows PowerShell normal:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Set-Location -LiteralPath 'C:\ReFind\Proyecto'
. .\scripts\provision\windows\Enter-Environment.ps1
code .
```

El punto inicial seguido de un espacio es parte del comando. Selecciona las herramientas de ReFind en esa terminal; no necesitas Conda ni `venv`. El permiso de ejecución se limita a esta terminal.

Acepta la confianza del proyecto propio si VS Code la solicita. En **Extensiones**, comprueba que aparecen ESLint, Prettier y Playwright. Abre la terminal integrada y ejecuta:

```powershell
npm.cmd run check:env
```

**Resultado:** entorno base correcto. Si abres VS Code de otra manera y no encuentra Node, vuelve a abrirlo con los comandos anteriores.

Antes de realizar tu primer commit en esta copia, configura tu identidad desde la raíz del proyecto, sustituyendo los valores:

```powershell
git config --local user.name "TU NOMBRE"
git config --local user.email "TU CORREO"
git status --short
```

Los cambios locales trasladados en el ZIP seguirán apareciendo como cambios. El procedimiento no hace commit ni push. La autenticación de tu cuenta de GitHub se realiza cuando la necesites; no se copian credenciales del anfitrión.

### 8.2. Comprobar pgAdmin

1. Abre desde el Explorador `C:\ReFind\PostgreSQL\17\pgAdmin 4\runtime\pgAdmin4.exe`.
2. En **Help → About**, comprueba **9.17**.
3. Pulsa **Add New Server**. En **General → Name**, escribe `ReFind desarrollo`.
4. En **Connection**, escribe los datos de la primera fila:

| Nombre | Host name/address | Port | Maintenance database | Username |
| --- | --- | --- | --- | --- |
| ReFind desarrollo | `127.0.0.1` | `5433` | `refind_dev` | `refind_dev_user` |
| ReFind pruebas | `127.0.0.1` | `5433` | `refind_test` | `refind_test_user` |
| ReFind E2E | `127.0.0.1` | `5433` | `refind_e2e` | `refind_e2e_user` |

5. Para obtener la contraseña de desarrollo, ejecuta en PowerShell normal:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\ReFind\Proyecto\scripts\provision\windows\Get-LocalPassword.ps1 -Environment development
```

6. Copia únicamente la contraseña mostrada al campo **Password** de pgAdmin y pulsa **Save**. No compartas capturas de esa contraseña.
7. Repite **Add New Server** para las otras dos filas. Obtén sus contraseñas sustituyendo `development` por `test` y por `e2e` en el comando.

**Resultado:** las tres conexiones abren su propia base. En **Schemas → public → Tables** deben aparecer las tablas de las migraciones y `refind_vm_probe`, usada para comprobar que los datos sobreviven al reinicio.

## 9. Comprobar un reinicio real — VM, administrador

**Para qué:** demostrar que los datos siguen guardados después de reiniciar PostgreSQL.

Cierra los servidores de la aplicación si los has arrancado (`Ctrl+C`). Abre Windows PowerShell **como administrador**, con la misma cuenta, y ejecuta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\ReFind\Proyecto\scripts\provision\windows\Test-Persistence.ps1
```

El script lee el dato de comprobación de cada base, reinicia únicamente `postgresql-refind-17` y vuelve a leerlo. **No vuelve a crear el dato entre ambas lecturas.** Deben finalizar correctamente las comprobaciones de las tres bases.

Cierra esa terminal. Reinicia también Windows de la VM desde **Inicio → Reiniciar**.

## 10. Verificación final — VM, usuario normal

Después del reinicio de Windows, abre PowerShell normal y ejecuta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\ReFind\Proyecto\scripts\provision\windows\Test-Environment.ps1
```

Comprueba servicio, bases, lectura/escritura, aislamiento, herramientas y las pruebas actuales de la aplicación. No debes arrancar manualmente los servidores de pruebas: los ejecutores se encargan de ellos.

**El entorno está validado cuando:**

- Este comando termina sin errores y todas las pruebas pasan.
- El apartado 9 confirmó la persistencia en las tres bases.
- Has abierto correctamente VS Code y las tres conexiones de pgAdmin.

No hace falta crear otro documento de evidencias. Puedes apagar la VM y crear la instantánea `ReFind-verificado` para recuperar este estado si lo necesitas. No distribuyas esa instantánea como entorno de otros desarrolladores: contiene tus claves personales.

## 11. Utilizar el entorno después

En cada terminal PowerShell nueva dentro de la VM:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Set-Location -LiteralPath 'C:\ReFind\Proyecto'
. .\scripts\provision\windows\Enter-Environment.ps1
```

Después elige lo que necesitas:

| Comando | Qué hace / qué haces tú |
| --- | --- |
| `npm.cmd run dev` | Arranca desarrollo. Abre `http://127.0.0.1:3000` en el navegador **de la VM**. Para pararlo, `Ctrl+C`. |
| `npm.cmd test` | Ejecuta las pruebas unitarias y de integración y termina. |
| `npm.cmd run test:e2e` | Arranca el servidor E2E, prueba y lo detiene. |
| `npm.cmd run verify` | Ejecuta las comprobaciones y pruebas previstas antes de subir cambios. |
| `npm.cmd run check:provision` | Prueba la lógica y la exportación a un ZIP temporal, sin instalar ni modificar servicios. |

Los datos de test y E2E son para pruebas y pueden ser limpiados por estas. Antes del push, registra las horas y fechas reales en la planificación, según lo acordado por el equipo.

Para pruebas con navegador visible, instala además el Chromium completo desde esa terminal:

```powershell
npx.cmd playwright install chromium
```

La instalación inicial descarga solamente el navegador sin interfaz necesario para los comandos automáticos. Las actualizaciones de dependencias pueden exigir volver a descargar su versión de Chromium.

## 12. Si un paso falla

| Mensaje o situación | Qué hacer |
| --- | --- |
| No es una VM VirtualBox | Ejecuta el instalador dentro de la VM, no en tu ordenador habitual. |
| Ruta, cuenta o puerto ocupados sin recibo | Usa una VM limpia. El script conserva lo existente y no detiene otro PostgreSQL. |
| Administrador / usuario normal incorrecto | Abre la terminal indicada en ese apartado con la misma cuenta Windows. |
| Falta una descarga o devuelve 404 | Comprueba Internet y conserva el error con la URL. No sustituyas versiones: debe revisarse la versión fijada antes de continuar. |
| Hash o firma incorrectos | No ejecutes ese archivo. Elimina únicamente ese archivo descargado de `%LOCALAPPDATA%\ReFindSetup\downloads` y repite el paso. |
| Instalación solicita reiniciar | Reinicia Windows de la VM y repite el apartado 6. |
| PostgreSQL tiene datos pero no servicio | El proceso no reinstala encima. Revisa `%LOCALAPPDATA%\ReFindSetup\postgres-install.log`; en una VM de prueba sin trabajo que conservar, puedes volver a la instantánea `Windows-limpio`. |
| Claves no descifrables | Vuelve a la misma cuenta Windows que ejecutó el apartado 6. No copies `secrets.xml` desde otro usuario o máquina. |
| `.env` diferente o rol/base con configuración inesperada | Se conserva. No borres ni regeneres claves: revisa qué cambió antes de repetir. |
| Proyecto no vacío sin recibo | Se conserva la copia parcial. Revisa el fallo al recuperar el proyecto; no ejecutes un borrado general ni clones encima. |
| Descarga Chromium bloqueada | Repite el apartado 7 con `-IPv4`. Si persiste, conserva el error de descarga para diagnosticarlo. |
| Aviso `allowScripts` de Argon2 | La comprobación posterior prueba Argon2. Si pasa, continúa; si falla, detente y revisa el error. No apruebes todos los scripts de instalación indiscriminadamente. |
| Pruebas de la aplicación fallan | La instalación no se declara validada. Conserva el nombre de la prueba y el error para corregir la causa. |

Puedes repetir los apartados 6 y 7 después de corregir un fallo recuperable: conservan las claves y las bases; las migraciones no se aplican dos veces. El apartado 7 vuelve a instalar las dependencias del lockfile. Una copia del proyecto interrumpida antes de crear su recibo requiere revisión, como indica la tabla.

## 13. Archivos y límites de la comprobación

| Archivo en `scripts/provision/windows` | Función |
| --- | --- |
| `Export-Bundle.ps1` | Empaquetar el proyecto en el anfitrión. |
| `Install-Machine.ps1` | Instalar herramientas y servicio PostgreSQL en la VM. |
| `Prepare-Project.ps1` | Preparar proyecto, tres entornos, migraciones, editor y ejecutores. |
| `Enter-Environment.ps1` | Seleccionar herramientas para la terminal actual. |
| `Test-Persistence.ps1` | Reiniciar el servicio y comprobar datos conservados. |
| `Test-Environment.ps1` | Repetir la verificación completa. |
| `Get-LocalPassword.ps1` | Consultar una clave local para introducirla en pgAdmin. |
| `Common.ps1`, `database-plan.mjs`, `database.mjs` | Funciones compartidas, configuración y comprobaciones de las bases. |
| `versions.json`, `playwright-ipv4.cjs` | Versiones auxiliares y alternativa de descarga IPv4. |

Las pruebas de estos scripts están documentadas en [tests/provision/README.md](../tests/provision/README.md). Las pruebas locales de lógica y sintaxis no sustituyen ejecutar los apartados 6–10 en Windows recién instalado. Hasta completar esa ejecución, la validación integral y la repetición en VM siguen pendientes.
