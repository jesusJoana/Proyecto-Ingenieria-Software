# Pruebas de ReFind

Ejecutar desde la raíz del proyecto, en la terminal de VS Code, después de instalar las dependencias.

| Carpeta | Qué comprueba | Comando | Necesita |
| --- | --- | --- | --- |
| `unit/` | Configuración, sesiones, validación y servicio de autenticación aislados. | `npm run test:unit` | Node y dependencias; no necesita `.env`, PostgreSQL ni navegador. |
| `integration/` | Express, sesiones y PostgreSQL trabajando juntos. | `npm run test:integration` | `.env.test`, PostgreSQL activo y migraciones de `refind_test` aplicadas. |
| `e2e/` | Portada, registro, acceso, cierre de sesión y publicaciones desde Chromium. | `npm run test:e2e` | `.env.e2e`, PostgreSQL activo, migraciones de `refind_e2e` y Chromium instalado; puerto E2E libre. |
| `setup/` | Las herramientas de pruebas. | `npm run check:tests` | Dependencias y Chromium instalado. |

`npm test` ejecuta unitarias e integración. `npm run verify` comprueba el entorno y ejecuta unitarias, integración y E2E. Las pruebas de sesiones de integración limpian la tabla `session` de **refind_test**; no ejecutarlas a la vez que un servidor manual que use esa base.

## Pruebas unitarias

- `unit/config.test.js`: 51 casos. Entornos válidos, archivo correcto, datos ausentes o inválidos, límites, aislamiento de conexiones, errores sin secretos y configuración inmutable. Simula la lectura del archivo; no toca los `.env` locales.
- `unit/session.test.js`: 10 casos. Regeneración, guardado, cierre, propagación de errores y autorización. Simula petición, respuesta y callbacks; no crea usuarios ni conecta con PostgreSQL.
- `unit/auth-validation.test.js`: validación de registro/acceso y datos públicos del formulario.
- `unit/auth-service.test.js`: hash, SQL parametrizado, duplicados y credenciales, con dependencias simuladas.
- `unit/auth-security.test.js`: protección CSRF y límite de envíos, sin esperas reales.
- `unit/posts-validation.test.js`: validación de publicaciones (límites, tipo y categoría permitidos, fecha no futura) e identificadores, con fecha fija. También los esquemas de gestión: edición (mismas reglas y `remove_photo`), cambio de estado (solo activa, reservada y resuelta; página de vuelta) y filtros del listado (`parseSearch`: valores por defecto y descarte de valores no válidos).

Los flujos de autenticación se comprueban en `integration/auth.test.js` y `e2e/auth.spec.js`, con usuarios únicos que se eliminan al finalizar. Detalle y campos: [Registro y acceso](../docs/Registro_acceso_ReFind.md).

Las publicaciones de objetos se comprueban en `integration/posts.test.js` (acceso sin sesión, CSRF, publicación válida, errores de validación conservando lo escrito, foto válida y no permitida, listado, detalle y Mis publicaciones) y `e2e/posts.spec.js` (iniciar sesión, publicar y verlo en el detalle, el listado con el buscador y Mis publicaciones). Sus usuarios, publicaciones y fotos se eliminan al finalizar.

La gestión de publicaciones se comprueba en `integration/posts-manage.test.js`:

- Permisos: sin sesión redirige al acceso; otra cuenta recibe 403 en editar, cambiar el estado y eliminar, aunque envíe un token válido; sin CSRF responde 403; identificadores no válidos o inexistentes dan 404.
- Estados: reservar, anular la reserva, resolver y reactivar, con etiquetas y botones; estado no válido (422); las resueltas no salen en el listado por defecto y sí con los filtros Resueltas y Todas.
- Edición: formulario con los datos actuales; todos los campos, incluida la ubicación, sin poder cambiar autoría ni estado; errores conservando lo escrito; sustituir la foto (se borra el archivo anterior), conservarla, quitarla (se borra del disco) y rechazar una foto falsa sin tocar la actual.
- Eliminación: página de confirmación; borrado físico de la fila y del archivo de la foto.
- Búsqueda: texto en título y descripción, tipo, categoría, combinaciones, filtros conservados en el formulario GET, comodines `%` tratados como texto y filtros no válidos ignorados con aviso.

`e2e/posts-manage.spec.js` recorre el flujo completo en Chromium: publicar, buscar, reservar desde el detalle, resolver desde Mis publicaciones (sin desbordar en móvil), comprobar el filtro Resueltas, editar añadiendo una foto y eliminar tras confirmar (la foto deja de servirse).

Cada `test` o grupo `test.each` tiene una cabecera **Para qué sirve / Qué comprueba**. `test.each` ejecuta una prueba por cada caso de su tabla.

## Procedimiento TDD

1. Escribir una prueba del comportamiento esperado.
2. Ejecutarla y comprobar que falla por ese comportamiento (rojo).
3. Implementar la corrección mínima y comprobar que pasa (verde).
4. Mejorar la organización si hace falta y repetir las pruebas afectadas.

En esta incorporación, el código ya existía: las pruebas que pasaron inicialmente documentan su comportamiento actual; no se presentan como desarrollo previo mediante TDD.

Las pruebas nuevas de configuración detectaron cinco fallos: cuatro casos con parámetros adicionales en la URL y uno con un usuario mal codificado. Después se corrigió `readConfig` para rechazar parámetros adicionales y devolver un error identificando `DATABASE_URL` ante una codificación inválida. No se modificaron los `.env` locales.
