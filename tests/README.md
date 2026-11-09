# Pruebas de ReFind

## Objeto y referencias

La referencia del comportamiento que debe verificarse es [la especificación del sistema](../docs/Especificación%20del%20sistema.docx): subsistemas en el apartado 3, requisitos funcionales en el 4 y no funcionales en el 5. [Requisitos.xlsx](../docs/Requisitos.xlsx) recoge el catálogo, la planificación, el seguimiento y la trazabilidad. Las [tarjetas](../docs/Tarjeta.docx) complementan esa información. **Primero se documenta y revisa el comportamiento; después se modifican pruebas y código.** Este documento define las pruebas previstas y su cobertura; su inclusión no acredita que estén implementadas o superadas.

## Casos previstos

Todos los casos siguientes están **pendientes de implementación y ejecución**. Los identificadores son referencias documentales de I01; no identifican archivos que ya existan.

En esta tabla, R01–R10 identifican **reglas**, no las iteraciones residuales R01–R16 de la planificación. I01–I09 sí identifican iteraciones. Los identificadores I01-P01–I01-P13 se mantienen para conservar la trazabilidad con el Excel.

| ID | Reglas y requisitos | Comportamiento esperado | Tipo e iteración |
| --- | --- | --- | --- |
| I01-P01 | R01; RF8, RF14, RF21 | Un autor registra los campos acordados. Un visitante y otra cuenta solo obtienen los públicos, incluidos HTML, respuestas, búsquedas y mapas. Foto y ubicación exacta no son accesibles por usuarios no autorizados, tampoco mediante URL directa. | Unitaria, integración y E2E; I05 |
| I01-P02 | R01; RF8 | No existe alta de pérdida en la interfaz y se rechaza el envío directo de `lost`. Autoría tomada de sesión y título generado. Foto y depósito no obligatorios. | Unitaria, integración y E2E; I05 |
| I01-P03 | R02; RF13 | Formulario válido crea reclamación; falta de descripción, detalle distintivo o lugar la rechaza. La fecha permite «No lo recuerdo» y marca/modelo no son obligatorios independientes. Pruebas adjuntas opcionales y privadas. | Unitaria, integración y E2E; I06 |
| I01-P04 | R02, R05; RF13, RF17, RF25 | Rechazar reclamación propia, sin sesión, duplicada activa o sobre objeto reservado/devuelto/retirado. Dos interesados pueden reclamar el mismo objeto disponible sin ver sus respuestas. Verificar duplicados simultáneos. | Integración y concurrencia; I06–I07 |
| I01-P05 | R03, R04; RF14, RF15, RF26 | Enviar reclamación abre un chat sin amistad. Autor y reclamante acceden; tercero y otro reclamante no. Aceptar no revela los datos reservados. No hay decisión automática de propiedad. | Integración y E2E con tres cuentas; I06 |
| I01-P06 | R05; RF17, RF25 | Solo el autor acepta/rechaza. Dos aceptaciones simultáneas dejan una sola aceptada y una reserva. Las otras reclamaciones esperan sin rechazo; no entran nuevas. | Unitaria e integración; I07 |
| I01-P07 | R06; RF17, RF25, RF16 | Cualquiera de los participantes cancela una reserva indicando motivo; vuelve la disponibilidad y se avisa. Rechazar una cancelación por tercero. El caso de confirmación parcial requiere decisión previa. | Integración y E2E; I07 |
| I01-P08 | R07, R08; RF24, RF25 | Una confirmación no completa la devolución. Ambas la completan una sola vez; se retira de disponibles, se cierran otras reclamaciones por entrega a otra persona y se generan avisos. Reintentos no duplican la entrega. | Unitaria, integración concurrente y E2E; I07 |
| I01-P09 | R09; RF18, RF22, RF23 | Editar con reclamaciones conserva la información original. Retirar cierra y avisa sin borrar historial; otro usuario no puede hacerlo. Definir previamente retirada tras entrega y acceso al histórico. | Integración y E2E; I05–I07 |
| I01-P10 | R10; RF16 | Avisos de reclamación, mensaje, decisión, cancelación, devolución y retirada llegan solo a sus destinatarios. Lectura persistente y sin datos privados de otros interesados. | Integración; I07 |
| I01-P11 | RF3; modelo e integridad | Migrar desde v1.0.0 y desde base vacía en bases aisladas. Probar referencias, unicidad, transacciones y conservación; las fotos antiguas no deben permanecer públicas si pasan a reservadas. Tratamiento de pérdidas y datos antiguos según decisión previa. | Integración de migraciones; I04 |
| I01-P12 | MUR | Sin sesión no se lee ni escribe. Un usuario edita/elimina solo sus mensajes; el muro no publica automáticamente información de chats o reclamaciones. Moderación y adjuntos se probarán tras acordarlos. | Unitaria, integración y E2E; I08 |
| I01-P13 | R01–R10, MUR; RF19–RF20 | Recorrido con autor, reclamante y tercero, navegación y dispositivos acordados, errores, privacidad, historial y regresión. No se declara validado un comportamiento pendiente de decisión. | Aceptación, E2E y revisión; I09 |

Antes de implementar cada caso se concretarán precondiciones, datos, pasos, resultado esperado y archivo destino. Los límites, formatos y transiciones aún abiertos se resolverán primero en el requisito correspondiente de los apartados 4 y 5 de la especificación. No se tomarán los valores del código actual como decisiones aprobadas para el sistema definido.

## Cobertura de requisitos

Los trece casos anteriores agrupan los recorridos principales; no sustituyen la comprobación de los 27 requisitos vigentes (22 funcionales y 5 no funcionales). La hoja Trazabilidad relaciona cada requisito con su planificación y sus evidencias. Al detallar las pruebas en I03 se incluirá también:

| Requisitos | Comprobaciones que deben quedar cubiertas |
| --- | --- |
| RF1, RF2, RF4 | Registro, acceso, cierre de sesión, recuperación y cambio de contraseña; validación, errores, sesiones y permisos. El envío real de correo y su recorrido completo siguen la planificación residual R14–R15. |
| RF5, RF6 | Consulta y edición del perfil, campos permitidos, privacidad y rechazo de modificaciones de otra cuenta. |
| RF9, RF10, RF21 | Listado, detalle y búsqueda de hallazgos reales; resultados vacíos, filtros y combinaciones acordados, exclusión de datos privados y precisión pública del mapa. |
| RF8, RF13, RF14, RF15, RF17, RF22–RF26 | Casos I01-P01–I01-P09, incluidos errores, permisos, concurrencia y transiciones del hallazgo y de cada reclamación. RF26 requiere además comprobar el listado de conversaciones y su aislamiento entre usuarios. |
| RF16, RF18, RF19, MUR | Avisos, historial, navegación y muro: casos I01-P09, I01-P10, I01-P12 e I01-P13, con acceso limitado a la información autorizada. |
| RF3 | Persistencia, migraciones, integridad, sesiones, CSRF, consultas parametrizadas, escape de contenido y acceso a datos y adjuntos privados. Una comprobación de interfaz por sí sola no acredita la protección de rutas y archivos. |
| RF20 | Recorridos en los dispositivos y navegadores que se acuerden, formularios utilizables y ausencia de desbordamientos que impidan completar las acciones. |
| DOC16 | Validación en servidor, conservación de datos válidos ante errores, fallos controlados, reintentos y consistencia tras operaciones fallidas. |
| DOC18 | Medición de rendimiento y capacidad con volumen, concurrencia, entorno y umbrales definidos previamente. No hay aceptación verificable mientras esos criterios estén abiertos. |
| DOC21 | Ejecución reproducible, aislamiento de entornos, requisitos vinculados a pruebas y evidencias de los resultados. Las pruebas de herramientas no acreditan por sí solas una instalación completa en VM. |

## Preparación, ejecución y revisión

Las pruebas usarán bases aisladas y datos ficticios. Los casos de autorización distinguirán visitante, autor, reclamante, otro reclamante y tercero ajeno. Se introducirán datos privados reconocibles para comprobar su ausencia en respuestas, listados, búsquedas, mapas y descargas no autorizadas.

Cada caso detallado debe registrar: identificador, requisito y apartado de la especificación, iteración, precondiciones, datos, pasos, resultado esperado y archivo de prueba. Cada ejecución añadirá fecha, entorno, revisión del código, comando o procedimiento manual, resultado observado, evidencia e incidencia si corresponde.

Se distinguirá entre caso pendiente de definición, pendiente de implementación, no ejecutado, superado, fallido y bloqueado. Un resultado histórico no valida automáticamente una versión posterior. Las decisiones abiertas sobre campos y adjuntos, migración, edición con reclamaciones, confirmación parcial, cancelación concurrente, retirada tras entrega, historial, cierre del chat y moderación del muro deben resolverse antes de implementar sus expectativas.

Antes del commit, Jesús revisará documentación, código y pruebas, incluidas las eliminaciones y sus sustituciones. El commit requiere su autorización; Jesús realiza el push. El cierre de una iteración requiere comprobar también esa publicación.

## Comandos de ejecución

Ejecutar desde la raíz del proyecto, en la terminal de VS Code, después de instalar las dependencias. Estos comandos están disponibles; el contenido de las suites debe adaptarse a los casos previstos antes de acreditar la aceptación de los requisitos vigentes.

| Carpeta | Qué comprueba | Comando | Necesita |
| --- | --- | --- | --- |
| `unit/` | Validaciones y lógica con dependencias aisladas. | `npm run test:unit` | Node y dependencias; no necesita PostgreSQL ni navegador. |
| `integration/` | Express, sesiones y PostgreSQL trabajando juntos. | `npm run test:integration` | `.env.test`, PostgreSQL activo y migraciones de `refind_test` aplicadas. |
| `e2e/` | Recorridos de usuario desde Chromium. | `npm run test:e2e` | `.env.e2e`, PostgreSQL activo, migraciones de `refind_e2e` y Chromium instalado; puerto E2E libre. |
| `setup/` | Las herramientas de pruebas. | `npm run check:tests` | Dependencias y Chromium instalado. |
| `provision/` | Bootstrap, rutas de entrada, planificación de base de datos y exportación. | `npm run check:provision` | PowerShell, Node y los requisitos detallados en [provision/README.md](provision/README.md). |

`npm test` ejecuta unitarias e integración. `npm run verify` comprueba el entorno y ejecuta unitarias, integración y E2E. Las pruebas de sesiones de integración limpian la tabla `session` de **refind_test**; no ejecutarlas a la vez que un servidor manual que use esa base.

`verify` no incluye `check:tests` ni `check:provision`; se ejecutan por separado cuando proceda. En PowerShell puede utilizarse `npm.cmd` si la política de ejecución impide invocar `npm.ps1`.

## Procedimiento TDD

1. Escribir una prueba del comportamiento esperado.
2. Ejecutarla y comprobar que falla por ese comportamiento (rojo).
3. Implementar la corrección mínima y comprobar que pasa (verde).
4. Mejorar la organización si hace falta y repetir las pruebas afectadas.

## Histórico de revisión documental

### 09/11/2026 — Alineación con la especificación vigente

Se organiza el contenido principal por pruebas previstas y cobertura de requisitos. Se retiran de ese contenido las instrucciones de prueba del flujo anterior: publicaciones mixtas, exposición de información reservada, estados manuales, borrado físico y chat condicionado a amistad. El motivo es su incompatibilidad con la publicación de hallazgos, la verificación privada y la devolución vinculada a una reclamación. La revisión documental no ha eliminado ni modificado tests ejecutables.

Se mantienen los identificadores I01-P01–I01-P13. I01-P02 se vincula al requisito vigente RF8; la retirada de RF7 queda como antecedente histórico. Las decisiones sobre la conservación de Amigos y valoraciones siguen pendientes y no se presentan como pruebas del alcance vigente.

La adaptación de los tests se vincula a I03–I09 en la planificación de [Requisitos.xlsx](../docs/Requisitos.xlsx). La siguiente relación conserva el inventario de impacto para realizar las sustituciones sin perder cobertura válida; no acredita que se hayan ejecutado.

#### Inventario de impacto y sustituciones previstas

| Archivos o grupos existentes | Tratamiento previsto | Iteración |
| --- | --- | --- |
| `unit/config`, `unit/session`, `unit/auth-*`, `unit/account-password`, `unit/password-reset-validation`, `unit/mail`; sus pruebas de integración | Conservar la cobertura de configuración, autenticación, contraseñas y sesiones. Adaptar únicamente fixtures o rutas si el cambio lo exige. | Regresión en cada cambio afectado |
| `unit/posts-validation.test.js` | Sustituir aceptación de `lost`, título libre, descripción pública y depósito obligatorio por el esquema aprobado. Mantener identificadores, límites acordados, validación y descarte de campos manipulados. Separar obligatoriedad de características recordadas: marca/modelo no son obligatorios independientes. | I05 |
| `integration/posts.test.js` | Adaptar fixtures a hallazgos. Conservar sesión, CSRF, autoría, validación y persistencia. Sustituir comprobaciones de fotos públicas, descripción, marca/color y depósito visibles por ausencia de reservados y acceso exclusivo del autor. Adaptar mapa a la precisión pública acordada. | I05 |
| `integration/posts-manage.test.js` | Conservar permisos de edición/borrado y consultas parametrizadas. Adaptar filtros a campos públicos. Sustituir el cambio manual de estado y el borrado físico con reclamaciones por reserva/devolución y retirada con historial. Añadir conservación de la información original y conflictos concurrentes. | I05 e I07 |
| `e2e/posts.spec.js` | Sustituir formulario mixto perdido/encontrado y filtros por tipo antiguo. Probar hallazgo, título generado, campos públicos y privados y consulta desde otra cuenta sin revelar reservados. El autor puede comprobar su foto privada; otro usuario no. | I05 |
| `e2e/posts-manage.spec.js` | Mantener edición autorizada, errores y uso móvil. Sustituir reserva/resolución manual por acciones de reclamación y doble confirmación. Adaptar descarga de foto y retirada al nuevo modelo. | I05 e I07 |
| `e2e/server.spec.js` e `integration/server.test.js` | Conservar carga, navegación, errores y accesibilidad aplicable. Reemplazar búsqueda sobre tres ejemplos y acciones simuladas por consulta real de hallazgos y los dos recorridos aprobados. | I05 e I09 |
| `unit/friends-attachments`, `integration/friends-chat`, `e2e/friends-chat-attachments` | Conservar formatos, firmas, tamaños acordados, CSRF, descarga autorizada y exclusión de terceros. Crear cobertura de chat por reclamación sin amistad y separación entre interesados/objetos. No retirar el test del módulo Amigos hasta decidir su conservación o retirada. | I06 |
| `unit/exchange-service`, `unit/exchange-validation`, `unit/exchange-views`, `integration/exchange-ratings` | Revisar aceptación, confirmación y valoraciones frente a la entrega vinculada al hallazgo/reclamación. Sustituir casos incompatibles cuando se implemente la nueva entrega. Conservar pruebas de valoraciones hasta acordar su alcance. | I07 |
| `integration/auth.test.js` y `e2e/auth.spec.js` | Conservar registro, acceso, perfil privado y edición. Adaptar navegación e historial donde cambien, manteniendo las comprobaciones de autorización. | I07 e I09 |
| `setup/` y `provision/` | Conservar comprobaciones de herramientas, aislamiento, rutas y exportación. Revisar instalación y migraciones nuevas; sus pruebas locales no sustituyen la instalación real en VM. | I04 e I09 |

Los nombres abreviados de la tabla corresponden a los archivos `.test.js` o `.spec.js` existentes en las carpetas indicadas. No se eliminará una suite completa por contener casos obsoletos. Antes de retirar una prueba se registrará el requisito retirado o el caso sustituto y se comprobará que no desaparece cobertura vigente de seguridad, integridad o errores. No se ajustarán expectativas únicamente para hacer pasar un fallo.

#### Evidencias anteriores

Tras la corrección ENV01 se registraron 355 pruebas unitarias/de integración y 14 E2E superadas. Corresponden al sistema anterior y no acreditan los requisitos modificados ni una ejecución durante esta revisión documental.

Las pruebas de configuración detectaron cinco fallos: cuatro relacionados con parámetros adicionales en la URL y uno con un usuario mal codificado. Se corrigió `readConfig` para rechazar parámetros adicionales y devolver un error identificando `DATABASE_URL` ante una codificación inválida. No se modificaron los `.env` locales. Las pruebas incorporadas sobre código ya existente no se presentan como desarrollo previo mediante TDD.

La cobertura anterior de recuperación utilizaba correo simulado y, en E2E, sustitución del hash del token. No demuestra entrega por SMTP ni recuperación desde un buzón real; esas comprobaciones están previstas en las iteraciones residuales R14–R15.
