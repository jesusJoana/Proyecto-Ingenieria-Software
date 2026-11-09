# Pruebas de ReFind

## Objeto y referencias

La referencia del comportamiento que debe verificarse es [la especificación del sistema](../docs/Especificación%20del%20sistema.docx): subsistemas en el apartado 3, requisitos funcionales en el 4 y no funcionales en el 5. [Requisitos.xlsx](../docs/Requisitos.xlsx) recoge el catálogo, la planificación, el seguimiento y la trazabilidad. Las [tarjetas](../docs/Tarjeta.docx) complementan esa información. **Primero se documenta y revisa el comportamiento; después se modifican pruebas y código.** Este documento define las pruebas previstas y su cobertura; su inclusión no acredita que estén implementadas o superadas.

## Casos previstos

Los casos siguientes describen la cobertura prevista. Su estado y sus evidencias se indican en las secciones de verificación de cada iteración y en el Excel. Los identificadores son referencias documentales de I01; no son nombres de archivos.

En esta tabla, R01–R10 identifican **reglas**, no las iteraciones residuales R01–R16 de la planificación. I01–I09 sí identifican iteraciones. Los identificadores I01-P01–I01-P13 se mantienen para conservar la trazabilidad con el Excel.

| ID | Reglas y requisitos | Comportamiento esperado | Tipo e iteración |
| --- | --- | --- | --- |
| I01-P01 | R01; RF8, RF14, RF21 | Un autor registra los campos acordados. Un visitante y otra cuenta solo obtienen los públicos, incluidos HTML, respuestas, búsquedas y mapas. Foto y ubicación exacta no son accesibles por usuarios no autorizados, tampoco mediante URL directa. | Unitaria, integración y E2E; I05 |
| I01-P02 | R01; RF8 | No existe alta de pérdida en la interfaz y se rechaza el envío directo de `lost`. Autoría tomada de sesión y título generado. Foto y depósito no obligatorios. | Unitaria, integración y E2E; I05 |
| I01-P03 | R02; RF13 | Formulario válido crea reclamación; falta de descripción, detalle distintivo o lugar la rechaza. La fecha permite «No lo recuerdo» y marca/modelo no son obligatorios independientes. Pruebas adjuntas opcionales y privadas. | Unitaria, integración y E2E; I06 |
| I01-P04 | R02, R05; RF13, RF17, RF25 | Rechazar reclamación propia, anónima, duplicada activa o sobre objeto no disponible. Pendiente, en espera y aceptada cuentan como activas. Tras rechazo/cancelación, permitir otra sobre objeto disponible con explicación de la aportación adicional, sin exigir archivo. Conservar antecedente; duplicados concurrentes dejan una activa. | Unitaria, integración y concurrencia; I06–I07 |
| I01-P05 | R03, R04; RF14, RF15, RF26 | Cada reclamación abre chat sin amistad, solo para autor y reclamante. Rechazar con motivo cierra esa reclamación sin bloquear el objeto ni las otras. Chats y pruebas cerrados son de solo consulta; una nueva reclamación abre otro chat con antecedente autorizado. Aceptar no revela reservados ni acredita propiedad automáticamente. | Unitaria, integración y E2E; I06–I07 |
| I01-P06 | R05; RF17, RF25 | Solo el autor acepta/rechaza. Dos aceptaciones simultáneas dejan una sola aceptada y una reserva. Las otras reclamaciones esperan sin rechazo; no entran nuevas. | Unitaria e integración; I07 |
| I01-P07 | R06; RF17, RF25, RF16 | Sin confirmaciones, cualquiera de los participantes cancela con motivo: reclamación cancelada, objeto disponible, reclamaciones en espera vuelven a pendientes y se avisa. Con una confirmación, rechazar cancelación unilateral; registrar incidencia y exigir acuerdo de ambos para anularla antes de liberar. Rechazar terceros y cancelación tras devolución. | Unitaria, integración concurrente y E2E; I07 |
| I01-P08 | R07, R08; RF24, RF25 | Cada participante confirma solo su parte. Una confirmación mantiene la reserva sin cierre por tiempo; ambas completan una sola entrega, retiran el objeto de búsqueda pública y cierran las otras reclamaciones activas con aviso. Reintentos y acciones simultáneas no duplican ni deshacen una devolución completada. | Unitaria, integración concurrente y E2E; I07 |
| I01-P09 | R09; RF18, RF22, RF23 | Edición por autor conserva versiones privadas y avisa de cambios públicos a reclamantes activos. Retirada de disponible exige motivo/confirmación y cierra reclamaciones sin borrar historial. Reservado exige cancelar antes; devuelto no admite edición, retirada ni reactivación; retirado no se reactiva. Historial accesible solo según participación, con conversaciones cerradas de consulta. | Unitaria, integración y E2E; I05–I07 |
| I01-P10 | R10; RF16 | Avisos de reclamación, mensaje, decisión, cancelación, devolución, retirada y cambios públicos llegan solo a sus destinatarios. Liberar reserva avisa a quienes vuelven a pendientes. Lectura persistente; sin identidades, pruebas ni datos privados de otros interesados. | Unitaria e integración; I07 |
| I01-P11 | RF3, DOC21; modelo e integridad | Reconstruir bases locales desde vacío y desde un esquema anterior con datos ficticios desechables. Verificar destino/rol, aislamiento, limpieza, aplicación completa y repetición sin pendientes, restricciones y recuperación ante fallo. Las URL antiguas no deben servir fotos privadas. Registrar cada equipo y entorno por separado. | Unitaria e integración real de reinicio y migraciones; I04 |
| I01-P12 | MUR | Sin sesión no se lee ni escribe. Un usuario edita/elimina solo sus mensajes; no existen permisos de moderación administrativa en esta versión. El muro no publica información privada de chats o reclamaciones. Adjuntos y límites se probarán tras acordarlos. | Unitaria, integración y E2E; I08 |
| I01-P13 | R01–R10, MUR; RF19–RF20 | Recorrido con autor, reclamante y tercero, navegación y dispositivos acordados, errores, privacidad, historial y regresión. No se declara validado un comportamiento pendiente de decisión. | Aceptación, E2E y revisión; I09 |

Antes de implementar cada caso se concretarán precondiciones, datos, pasos, resultado esperado y archivo destino. Los límites, formatos y transiciones aún abiertos se resolverán primero en el requisito correspondiente de los apartados 4 y 5 de la especificación. No se tomarán los valores del código actual como decisiones aprobadas para el sistema definido.

## Cobertura de requisitos

Los trece casos anteriores agrupan los recorridos principales; no sustituyen la comprobación de los 27 requisitos vigentes (22 funcionales y 5 no funcionales). La hoja Trazabilidad relaciona cada requisito con su planificación y sus evidencias. Al detallar las pruebas en I03 se incluirá también:

| Requisitos | Comprobaciones que deben quedar cubiertas |
| --- | --- |
| RF1, RF2, RF4 | Registro, acceso, cierre de sesión, recuperación y cambio de contraseña; validación, errores, sesiones y permisos. El envío real de correo y su recorrido completo siguen la planificación residual R14–R15. |
| RF5, RF6 | Consulta y edición del perfil propio; ante otros usuarios solo nombre de usuario, sin correo ni otros datos del perfil. Rechazo de modificaciones ajenas. |
| RF9, RF10, RF21 | Listado, detalle y búsqueda de hallazgos reales; resultados vacíos, filtros y combinaciones acordados, exclusión de datos privados y precisión pública del mapa. |
| RF8, RF13, RF14, RF15, RF17, RF22–RF26 | Casos I01-P01–I01-P09, incluidos errores, permisos, concurrencia y transiciones del hallazgo y de cada reclamación. RF26 requiere además comprobar el listado de conversaciones y su aislamiento entre usuarios. |
| RF16, RF18, RF19, MUR | Avisos, historial, navegación y muro: casos I01-P09, I01-P10, I01-P12 e I01-P13, con acceso limitado a la información autorizada. |
| RF3 | Persistencia, migraciones, integridad, sesiones, CSRF, consultas parametrizadas, escape de contenido y acceso a datos y adjuntos privados. Una comprobación de interfaz por sí sola no acredita la protección de rutas y archivos. |
| RF20 | Recorridos en los dispositivos y navegadores que se acuerden, formularios utilizables y ausencia de desbordamientos que impidan completar las acciones. |
| DOC16 | Validación en servidor, conservación de datos válidos ante errores, fallos controlados, reintentos y consistencia tras operaciones fallidas. |
| DOC18 | Medición de rendimiento y capacidad con volumen, concurrencia, entorno y umbrales definidos previamente. No hay aceptación verificable mientras esos criterios estén abiertos. |
| DOC21 | Ejecución reproducible, aislamiento de entornos, requisitos vinculados a pruebas y evidencias de los resultados. Las pruebas de herramientas no acreditan por sí solas una instalación completa en VM. |

## Detalle de planificación de pruebas de I03

Propuesta pendiente de revisión. Las actividades siguientes forman parte de I03–I09; no crean iteraciones adicionales. Los archivos nuevos indicados son destinos propuestos, todavía no implementados. Las decisiones pendientes de I01/I02 deben quedar documentadas antes de fijar las expectativas afectadas.

### Trabajo, dependencias y estimación del remanente

Estimaciones iniciales en horas de trabajo, no horas reales ni compromisos de calendario. Incluyen documentación, implementación, pruebas y correcciones; se revisarán al resolver las decisiones abiertas y asignar responsables. No incluyen el trabajo histórico ya realizado, las tarjetas aplazadas ni las iteraciones residuales R01–R16. Las columnas de horas acordadas del Excel se completarán tras aprobar estas propuestas.

| Iteración | Trabajo pendiente y orden | Dependencia para implementar | Propuesta de esfuerzo | Riesgo principal |
| --- | --- | --- | --- | --- |
| I03 | Concretar casos y archivos; conciliar dependencias; acordar responsables, estimaciones y fechas; revisar el plan. | Se puede planificar con I01/I02 en curso; aprobación final condicionada a decisiones que afecten al trabajo. | 6–10 h: detalle 2–4, planificación 2–3, revisión 2–3. | Planificar sobre criterios todavía abiertos. |
| I04 | Modelo y migración 012, reinicio y limpieza implementados. Verificación en PostgreSQL temporal y en los tres entornos de Jesús. | Pendientes revisión, comprobaciones de los otros cinco equipos, commit y push. | 18–28 h anteriores: revisar estimación por reinicio y verificación de equipos; nuevo esfuerzo pendiente de estimar. | No cerrar sin las 15 verificaciones restantes. |
| I05 | Adaptar validación y servicio; separar datos públicos/privados; actualizar formularios, detalle, búsqueda y mapa; edición y retirada sin reclamaciones. | I04; campos, límites, filtros y precisión pública acordados. Retirada con reclamaciones se completa en I07. | 24–36 h: documentación 3–4, código/UI 10–16, unitarias/integración 7–10, E2E/revisión 4–6. | Filtración de datos por respuestas, búsquedas o archivos. |
| I06 | Crear reclamación y evidencias; vincular conversación; autorizar participantes; adaptar listado de chats y adjuntos. | I05; concretar límites/formatos de adjuntos. Reclamación activa/repetida y acceso al chat ya validados. | 28–42 h: documentación 3–5, código 12–18, unitarias/integración 9–13, E2E/revisión 4–6. | Duplicados y acceso entre reclamantes ajenos. |
| I07 | Implementar decisión y reserva; cancelación; doble confirmación; coordinar retirada, avisos e historial; regresión de perfil. | I06. Aplicar las reglas validadas de confirmación parcial, conflictos, edición/retirada e historial. | 30–46 h: documentación 4–6, código 12–18, unitarias/integración 10–16, E2E/revisión 4–6. | Doble reserva/entrega o estados incoherentes. |
| I08 | Crear muro autenticado; mensajes propios; validación y permisos; integración con navegación. | I07 según secuencia acordada; concretar adjuntos y límites. Sin moderación administrativa en esta versión. | 16–26 h: documentación 2–4, código 6–10, unitarias/integración 5–8, E2E/revisión 3–4. | Escritura ajena, XSS y exposición de conversaciones. |
| I09 | Ejecutar regresión y aceptación; medir condiciones no funcionales; corregir incidencias; conciliar evidencias y documentación final. | I04–I08 comprobadas; dispositivos y umbrales medibles acordados. | 18–30 h: documentación 3–5, regresión unitaria/integración 4–6, E2E/no funcionales 7–11, correcciones/revisión 4–8. | Confundir cobertura histórica con aceptación vigente. |

Responsable de I01–I09: Jesús. Objetivo de trabajo comunicado: 09/11/2026; no acredita fechas reales ni finalización. Las estimaciones anteriores de I03–I09 sumaban 140–218 h; I04 debe reestimarse al incluir reinicio y comprobación por equipo, por lo que el objetivo de completar todo ese día presenta riesgo de incumplimiento y debe revisarse con el avance real. Prioridad propuesta: alta para I03–I07 e I09; media para I08. El esfuerzo de I09 cubre regresión conjunta, no vuelve a contabilizar la creación de pruebas asignada a I04–I08. SMTP real, instalación limpia en VM y verificaciones por desarrollador permanecen en sus iteraciones residuales.

Las tarjetas y los ajustes editoriales sin cambio de requisitos se aplazan expresamente a I09 y no bloquean la implementación. La privacidad, los permisos, los estados y el ciclo de devolución ya están acordados y deben implementarse con las expectativas de este documento. Los límites, formatos, filtros, precisión del mapa y condiciones no funcionales aún abiertos se concretan antes de implementar el caso dependiente. El plazo definitivo de conservación y la eliminación se definen antes de usar datos personales reales. Los datos de prueba locales se pueden descartar al reconstruir las bases; procedimiento y ficha por equipo en el apartado 5 del manual de base de datos.

### Pruebas unitarias y de integración por iteración

| Iteración y casos | Unitarias: reglas aisladas | Integración: componentes y PostgreSQL reales | Archivos previstos |
| --- | --- | --- | --- |
| I04 · I01-P11 | Selección de entorno, rechazo de destino/rol ajenos, rutas de archivos y URL antiguas privadas. | PostgreSQL temporal: esquema vacío y anterior, reconstrucción, repetición, recuperación de fallo, conexiones ocupadas, aislamiento, restricciones, participantes y concurrencia. Limpieza de archivos rechazada si otra base tiene datos. | Implementadas `unit/database-reset.test.js`, `integration/database-reset.test.js` e `integration/migrations.test.js`. Evidencia en `evidence/I04-2026-11-09.md`; verificación de los otros cinco equipos pendiente. |
| I05 · I01-P01, P02, P09 | Campos obligatorios/opcionales; rechazo de `lost`; título generado; proyección pública; identificadores y filtros; límites acordados y valores frontera. | Publicar por HTTP con sesión y CSRF; comprobar autor en BD; consultar como visitante y otra cuenta; intentar descargar foto privada; buscar un dato reservado y comprobar que no se filtra. Editar/retirar como autor y tercero; comprobar persistencia y errores sin cambios parciales. | Adaptar `unit/posts-validation.test.js`, `integration/posts.test.js`, `integration/posts-manage.test.js`; crear `unit/posts-privacy.test.js`. |
| I06 · I01-P03, P04, P05 | Validación de reclamación, «No lo recuerdo», campos opcionales, saneado y límites de evidencias; reglas de participantes y apertura del chat. | Reclamación válida crea registro y conversación relacionados sin amistad. Rechazar propia, anónima y duplicada; dos envíos simultáneos crean una activa. Dos reclamantes no ven mensajes ni evidencias ajenas; tercero tampoco. Fallo durante creación no deja registros huérfanos. | Crear `unit/claims-validation.test.js`, `unit/claims-service.test.js`, `integration/claims.test.js`, `integration/claim-chat.test.js`; adaptar pruebas de adjuntos vigentes. |
| I07 · I01-P04, P06–P10 | Tabla de transiciones, actor permitido, motivo de cancelación, confirmación individual y doble, destinatarios de avisos e idempotencia. | Dos aceptaciones concurrentes dejan una reserva. Confirmaciones/reintentos completan una sola entrega. Cancelación libera reserva; retirada cierra reclamaciones y notifica. Avisos e historial sobreviven a una nueva sesión y excluyen terceros. Fallos intermedios mantienen estados consistentes. | Crear `unit/claim-state.test.js`, `unit/delivery.test.js`, `unit/notifications.test.js`, `integration/delivery.test.js`, `integration/activity.test.js`; adaptar gestión de publicaciones y regresión de `integration/auth.test.js`. |
| I08 · I01-P12 | Validación de mensajes, límites y reglas de autoría; decisiones adicionales solo tras concretarlas. | Sin sesión no se lee ni escribe; autor edita/elimina; tercero rechazado incluso con CSRF válido. Persistencia, contenido escapado y ausencia de datos de chat/reclamación. Errores no alteran mensajes existentes. | Crear `unit/wall-validation.test.js`, `integration/wall.test.js`. |
| I09 · I01-P13 y catálogo completo | Ejecutar la regresión de validaciones, configuración, sesiones, autenticación y servicios afectados; completar huecos del catálogo vigente. | Ejecutar todas las suites de integración, incluidas migración, permisos y concurrencia. Verificar los contratos entre hallazgos, reclamaciones, chat, entrega y actividad. Registrar las limitaciones de correo simulado y entornos no comprobados. | Suites de `unit/` e `integration/`; E2E y mediciones no funcionales complementarias según criterios acordados. |

### Datos, pasos y resultados comunes

Para integración se preparan cuentas ficticias A (autor), B y C (reclamantes) y D (tercero), además de acceso sin sesión. Se crea un hallazgo disponible de A con un dato privado reconocible, y objetos separados reservados, devueltos y retirados. Cada prueba crea sus datos y limpia únicamente lo que le pertenece; la migración utiliza bases desechables aisladas, nunca desarrollo ni datos reales.

1. Preparar estado, actores y datos del caso, incluyendo sesión y CSRF cuando correspondan.
2. Ejecutar la acción o petición; en concurrencia usar conexiones independientes y una barrera de inicio, sin depender de esperas arbitrarias.
3. Comprobar respuesta y estado persistido: filas, relaciones, estados, mensajes, avisos y archivos afectados.
4. Repetir desde una cuenta no autorizada y comprobar rechazo sin modificación ni filtración. Comprobar también el dato privado en el cuerpo de la respuesta y en descargas directas.
5. Registrar resultado y limpiar los datos. Un error esperado debe dejar intacto el estado previo, salvo efectos expresamente definidos.

Las unitarias usarán dependencias simuladas solo para aislar lógica y provocar errores controlados. Las de integración comprobarán las restricciones y transacciones sobre PostgreSQL; los mocks no acreditan persistencia ni concurrencia. Las fechas serán controladas y los identificadores únicos para evitar casos interdependientes.

En cada iteración se ejecutarán `npm run test:unit` y `npm run test:integration` tras las pruebas focalizadas. Los recorridos E2E afectados se ejecutarán antes de presentar la entrega; en I09 se ejecutará además `npm run verify`. Un fallo se investiga y documenta; no se elimina su prueba para obtener un resultado verde. Cada retirada tendrá requisito, motivo y sustituto registrado en el histórico. Los criterios aún abiertos permanecen pendientes de definición y no cuentan como pruebas superadas.

## Preparación, ejecución y revisión

Las pruebas usarán bases aisladas y datos ficticios. Los casos de autorización distinguirán visitante, autor, reclamante, otro reclamante y tercero ajeno. Se introducirán datos privados reconocibles para comprobar su ausencia en respuestas, listados, búsquedas, mapas y descargas no autorizadas.

Cada caso detallado debe registrar: identificador, requisito y apartado de la especificación, iteración, precondiciones, datos, pasos, resultado esperado y archivo de prueba. Cada ejecución añadirá fecha, entorno, revisión del código, comando o procedimiento manual, resultado observado, evidencia e incidencia si corresponde.

Se distinguirá entre caso pendiente de definición, pendiente de implementación, no ejecutado, superado, fallido y bloqueado. Un resultado histórico no valida automáticamente una versión posterior. Siguen pendientes los límites de campos y adjuntos, filtros, precisión del mapa y condiciones medibles de aceptación. El acceso al historial, el cierre del chat, la edición/retirada y la confirmación parcial tienen reglas validadas; se comprobarán también por peticiones directas y con cuentas ajenas.

Para la confirmación parcial se probarán: intento unilateral rechazado sin cambio de estado; incidencia persistida; acuerdo de una sola parte insuficiente; acuerdo de ambas que permite anular la confirmación y cancelar; cancelación concurrente con segunda confirmación sin estados incompatibles. Para una reclamación repetida se comprobarán ausencia de aportación adicional, aportación textual sin archivo, conservación del antecedente, nueva conversación y rechazo de escritura en la cerrada. Para el historial se verificarán versiones exclusivas del autor, acceso de cada reclamante solo a su proceso y ausencia de borrado automático por antigüedad en esta versión.

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

### 09/11/2026 — Bases locales reconstruibles

I01-P11 sustituye la conversión y conservación de datos de prueba anteriores por su descarte y reconstrucción controlada. Se añaden pruebas unitarias del destino y las fases, integración real del reinicio y registro individual de los seis desarrolladores en sus tres entornos. Motivo: los datos de desarrollo son desechables y todos los equipos deben poder reproducir el esquema vigente. No se ha implementado ni ejecutado todavía la limpieza.


### 09/11/2026 — Validación de privacidad y ciclo de reclamación

Se actualizan I01-P04, P05 y P07–P10 para recoger rechazo con motivo, reclamación repetida con aportación adicional, consulta de chats cerrados, cancelación de reserva, incidencia tras confirmación parcial, acuerdo bilateral, edición con versiones y retirada sin pérdida del historial. I01-P12 recoge la exclusión de moderación administrativa. Se mantiene la identificación de los trece casos y se sincroniza su contenido con el Excel. Motivo: convertir las decisiones validadas en expectativas verificables mediante pruebas unitarias, de integración y E2E, sin presentarlas como implementadas.

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

## Verificación de I04 del 09/11/2026

Modelo, migración 012 y reinicio implementados. `npm run test:i04`: 39 pruebas; regresión posterior al reinicio local: 394 unitarias/integración y 14 E2E, todas superadas. Los tres entornos de Jesús se reconstruyeron dos veces y conservan el aislamiento. I04 fue publicada posteriormente en b2b1bfc. Quedan 15 verificaciones de los otros cinco equipos, que se realizan tras el push. [Evidencia y límites](evidence/I04-2026-11-09.md).

## Preparación de I05

I04 se ha publicado en `b2b1bfc5dafb9ecbc0227e77454d4f09cf902ade`, verificado en `origin/main`. Las comprobaciones de los otros cinco desarrolladores se realizan después del push y no bloquean el inicio local de I05. Siguen pendientes de aportar sus resultados para cerrar I04.

I05 adapta el alta y la consulta de hallazgos al modelo nuevo, incluidos portada, búsqueda, mapa, detalle, fotografía privada, edición y retirada sin reclamaciones. El formulario de reclamación y el chat corresponden a I06; las acciones de reserva, devolución y retirada con reclamaciones se completan en I07. Los límites de entrada, filtros, paginación y precisión del mapa fueron validados y recogidos en la especificación antes de implementar los casos afectados.

### Cambios previstos en las pruebas

| Archivo | Cobertura que se conserva | Sustitución o ampliación |
| --- | --- | --- |
| `unit/posts-validation.test.js` | Identificadores, normalización, fechas reales, valores frontera, errores de filtros y conservación de campos | Alta exclusiva de hallazgo, título generado, campos privados, foto y depósito opcionales, intervalo de fecha y paginación. Sustituir cambio manual de estado por rechazo de esa operación. |
| `unit/posts-privacy.test.js` | Archivo nuevo | Proyección pública explícita: excluir detalles, depósito, fotografía, ubicación exacta e identidad personal distinta del nombre de usuario. |
| `integration/posts.test.js` | Sesión, CSRF, autoría, validación, persistencia, XSS, orden y pertenencia de Mis publicaciones | Usar `found_objects` y `found_object_private`. Verificar autor, visitante y otra cuenta; foto accesible solo al autor, incluidas URL directas. Rechazar `lost` enviado manualmente. |
| `integration/posts-manage.test.js` | Permisos de gestión, CSRF, errores sin cambios, filtros y tratamiento literal de comodines | Sustituir borrado físico por retirada con motivo y confirmación; preservar versiones y fotos históricas privadas. Rechazar modificación manual del estado, edición de cerrados y retirada de reservado o con reclamaciones. Buscar exclusivamente campos públicos. |
| `e2e/posts.spec.js` | Publicación real, errores y corrección, conservación de campos, uso móvil y ubicación | Formulario con secciones pública y privada, título generado, foto opcional y comprobación desde una cuenta ajena. Mapas sin datos exactos. |
| `e2e/posts-manage.spec.js` | Publicación, búsqueda, edición y permisos desde navegador | Sustituir reserva/resolución manual y eliminación por edición y retirada del hallazgo sin reclamaciones. Reserva y devolución mediante reclamación quedan en I07. |
| `integration/server.test.js` y `e2e/server.spec.js` | Portada, navegación, errores, ausencia de información interna y sesión anónima | Sustituir los ejemplos de la portada por hallazgos reales y la acción de publicar pérdidas por consultar. Comprobar resultados vacíos y acceso al listado. |

Las pruebas del modelo y del reinicio de I04 se conservan. Si I05 necesita una migración adicional, se amplían sus comprobaciones de reconstrucción y repetición sin modificar las migraciones compartidas. No se borran pruebas de seguridad para compensar fallos del cambio de modelo.


## Verificación de I05 del 09/11/2026

359 pruebas unitarias/integración y 14 E2E superadas. Incluyen 75 casos específicos de publicación y privacidad, más la regresión del modelo y reinicio de I04 adaptada a la migración 013. `check:env` y `check:db` correctos. [Evidencia y límites](evidence/I05-2026-11-09.md).

I01-P01/P02 están implementados y superados localmente. I01-P09 queda parcial: se prueban versiones, privacidad, concurrencia, restricciones de estados y retirada sin reclamaciones; I07 completa el proceso con reclamaciones. No se considera completado el conjunto de RF21/RF23 por haber terminado su parte de I05.

Se han ejecutado las sustituciones previstas para publicación y búsqueda. El caso de portada de `unit/exchange-views` recibe el listado real como entrada, manteniendo la comprobación de identidad del menú. Las suites de migraciones y reinicio calculan el número de migraciones del inventario y conservan la comprobación de proyección pública. Las pruebas anteriores de reserva manual y borrado no se presentan como cobertura de devolución: se sustituyen por bloqueo de esas rutas y se mantiene I07 pendiente.

La revisión manual de Jesús sigue pendiente. [Pantallas, pasos y resultados esperados M01–M12](../docs/Pruebas_manuales_I05.md). I05 está preparada para revisión, sin commit ni push.

Revisión posterior de Objetos por zonas: aviso específico para búsquedas sin coordenadas y enlace al listado conservando filtros. Un caso nuevo de integración (20 en la suite) y comprobación E2E del círculo visible y su título; 2 E2E superados. Véase la ampliación de la evidencia I05.

## Preparación de I06

I05 publicada en 67b7c41. Criterios de textos, fechas y adjuntos validados por Jesús. La especificación y docs/Implementacion_I06.md recogen el alcance y el diseño antes de modificar código. Se definieron antes del código las suites de validación/adjuntos, reglas, reclamación y chat, con concurrencia, aislamiento de dos reclamantes, descargas, conversación cerrada, repetición y limpieza ante errores. Se mantiene la regresión de Amigos; las decisiones y devolución siguen en I07. Resultados de I06 en el apartado siguiente.


## Verificación de I06 del 09/11/2026

`npm run verify` superado: entorno correcto, 433 pruebas unitarias/integración y 15 E2E. Los 73 casos nuevos de I06 se distribuyen en `unit/claims-validation.test.js`, `unit/claims-service.test.js`, `unit/claims-attachments.test.js`, `integration/claims.test.js` e `integration/claim-chat.test.js`. `e2e/claims.spec.js` recorre publicación, reclamación con errores y adjunto, conversación sin amistad, sondeo con borrador, exclusión de terceros y consulta tras cierre.

Se conserva la cobertura anterior de Amigos y de publicación. La limpieza compartida de fixtures incorpora los adjuntos de reclamaciones y mensajes. Las migraciones 001–013 se mantienen sin cambios y sus pruebas forman parte de la regresión. No se reutilizan las pruebas de Amigos como evidencia del aislamiento del nuevo chat: este dispone de sus propias suites.

I01-P03 superado localmente. La parte de I06 de I01-P04/P05 está verificada; decisiones y transiciones se completan en I07. [Evidencia y límites](evidence/I06-2026-11-09.md). [Guion de revisión manual](../docs/Pruebas_manuales_I06.md). Revisión de Jesús, commit y push pendientes.
