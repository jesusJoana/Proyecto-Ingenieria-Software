# Pruebas de ReFind

Ejecutar desde la raíz del proyecto, en la terminal de VS Code, después de instalar las dependencias.

| Carpeta | Qué comprueba | Comando | Necesita |
| --- | --- | --- | --- |
| `unit/` | Configuración y funciones de sesión de forma aislada. | `npm run test:unit` | Node y dependencias; no necesita `.env`, PostgreSQL ni navegador. |
| `integration/` | Express, sesiones y PostgreSQL trabajando juntos. | `npm run test:integration` | `.env.test`, PostgreSQL activo y migraciones de `refind_test` aplicadas. |
| `e2e/` | La portada y sus interacciones desde Chromium. | `npm run test:e2e` | `.env.e2e`, PostgreSQL activo, migraciones de `refind_e2e` y Chromium instalado; puerto E2E libre. |
| `setup/` | Las herramientas de pruebas. | `npm run check:tests` | Dependencias y Chromium instalado. |

`npm test` ejecuta unitarias e integración. `npm run verify` comprueba el entorno y ejecuta unitarias, integración y E2E. Las pruebas de sesiones de integración limpian la tabla `session` de **refind_test**; no ejecutarlas a la vez que un servidor manual que use esa base.

## Pruebas unitarias

- `unit/config.test.js`: 51 casos. Entornos válidos, archivo correcto, datos ausentes o inválidos, límites, aislamiento de conexiones, errores sin secretos y configuración inmutable. Simula la lectura del archivo; no toca los `.env` locales.
- `unit/session.test.js`: 10 casos. Regeneración, guardado, cierre, propagación de errores y autorización. Simula petición, respuesta y callbacks; no crea usuarios ni conecta con PostgreSQL.

Cada `test` o grupo `test.each` tiene una cabecera **Para qué sirve / Qué comprueba**. `test.each` ejecuta una prueba por cada caso de su tabla.

## Procedimiento TDD

1. Escribir una prueba del comportamiento esperado.
2. Ejecutarla y comprobar que falla por ese comportamiento (rojo).
3. Implementar la corrección mínima y comprobar que pasa (verde).
4. Mejorar la organización si hace falta y repetir las pruebas afectadas.

En esta incorporación, el código ya existía: las pruebas que pasaron inicialmente documentan su comportamiento actual; no se presentan como desarrollo previo mediante TDD.

Las pruebas nuevas de configuración detectaron cinco fallos: cuatro casos con parámetros adicionales en la URL y uno con un usuario mal codificado. Después se corrigió `readConfig` para rechazar parámetros adicionales y devolver un error identificando `DATABASE_URL` ante una codificación inválida. No se modificaron los `.env` locales.
