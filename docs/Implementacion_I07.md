# Devolución, estados y actividad personal — I07

## Alcance y punto de partida

I07 integra el ciclo de recuperación sobre las reclamaciones de I06: decisión del autor, reserva única, cancelación, doble confirmación, incidencias, retirada, avisos e historial privado. I06 está publicada en `06d577d7ff2669e0be482d93f0a8049f865973be`; la referencia local `origin/main` coincide con HEAD. Jesús ha validado la revisión previa. Los datos de esfuerzo no imputados en el seguimiento permanecen pendientes.

La especificación y este diseño se actualizaron antes del código. La implementación aplica las reglas siguientes; los resultados se registran en la evidencia de I07 y no equivalen a aceptación de Jesús.

## Reglas de implementación

| Acción | Actor y condición | Resultado atómico |
| --- | --- | --- |
| Aceptar | Autor, reclamación pendiente y objeto disponible | Reclamación aceptada, objeto reservado y otras pendientes en espera. |
| Rechazar | Autor, reclamación pendiente, motivo obligatorio | Solo esa reclamación se rechaza; el hallazgo permanece disponible. |
| Cancelar solicitud | Reclamante, pendiente o en espera, motivo obligatorio | Se cierra solo esa solicitud. |
| Cancelar reserva | Cualquiera de sus dos participantes, sin confirmaciones, motivo obligatorio | Aceptada pasa a cancelada, objeto disponible y reclamaciones en espera vuelven a pendientes. |
| Confirmar entrega o recepción | Autor confirma entrega; reclamante confirma recepción | Primera confirmación mantiene reserva; segunda completa reclamación y devolución, y cierra otras activas por entrega a otra persona. |
| Registrar incidencia | Participante de reserva con una confirmación | Conserva reserva y deja constancia privada del motivo. No permite cancelación unilateral. |
| Acordar anulación | Ambos participantes, cada uno por separado | Solo el acuerdo de ambos permite anular la confirmación. Después puede cancelarse la reserva con motivo. |
| Retirar hallazgo | Autor, disponible, motivo y confirmación explícita | Retirada y cierre de reclamaciones abiertas; se conservan conversaciones, evidencias e historial. |

Una devolución completada no se cancela ni se reactiva. Los reintentos de confirmación no duplican entrega, eventos ni avisos. Las solicitudes antiguas o simultáneas se contrastan con el estado vigente. No hay caducidad automática, resolución administrativa ni acceso de otros reclamantes a las pruebas o identidades ajenas.

## Diseño y revisión del modelo de datos

La migración 012 contiene los estados, confirmaciones individuales, incidencias con acuerdos separados, eventos y notificaciones. Sus índices impiden más de una reserva o devolución por objeto; sus restricciones diferidas comprueban la coherencia entre hallazgo y reclamaciones. No se ha identificado la necesidad de una nueva migración para este alcance. Se conservarán las migraciones publicadas y se comprobará el modelo mediante integración real.

Las transiciones bloquean primero el hallazgo y después sus reclamaciones en orden estable, dentro de una transacción. El alta de reclamaciones bloquea el hallazgo; el envío de mensajes bloquea la reclamación. Los cambios de estado, eventos y notificaciones se confirman o revierten juntos. Las pruebas provocan aceptaciones simultáneas, confirmaciones simultáneas y conflictos con cancelaciones; comprueban la reversión al fallar un aviso.

Cada acción comprobará sesión, CSRF, participante, actor autorizado y estado en servidor. Los acuerdos de incidencia identificarán la incidencia concreta para impedir que una petición antigua afecte a una nueva. La interfaz distinguirá entrega y recepción; una confirmación parcial deberá explicar qué falta y por qué no se puede cancelar unilateralmente.

Los avisos mostrarán mensajes adecuados a su destinatario y enlaces autorizados. No se expondrá a un reclamante el evento completo de otra reclamación. El historial del autor podrá reunir sus publicaciones y decisiones; el de un reclamante incluirá únicamente su proceso y los cambios públicos del hallazgo. Las versiones privadas seguirán siendo exclusivas del autor.

## Decisión validada sobre el módulo anterior

Jesús ha validado sustituir el intercambio independiente por la devolución vinculada a la reclamación, retirar las valoraciones de las interfaces y conservar los datos históricos. Se deshabilitarán las rutas anteriores de escritura; las tablas históricas no se borrarán ni se convertirán en devoluciones ficticias.

Esta decisión afecta a las rutas de intercambios de `src/auth/routes.js`, `src/exchanges/`, las vistas de perfil privado y público, `views/partials/reviews.ejs`, la documentación de registro/perfil y las suites `exchange-*`. La funcionalidad de Amigos no se retira como consecuencia de esta decisión.

La revisión de RF5 detecta que el perfil público y Amigos aún muestran datos personales ajenos. Se limitarán sus consultas y vistas al nombre de usuario, incluida la búsqueda de Amigos, y la descarga de avatares se autorizará solo para su propietario. Se conserva la edición y visualización del perfil propio, las amistades y su conversación. Antes de modificar estas rutas se prevén pruebas de perfil público sin datos personales, descarga propia y bloqueo a terceros/anónimos, y regresión de búsqueda, solicitudes y chat de Amigos.

## Plan de pruebas previo al código

| Cobertura | Casos necesarios | Destino |
| --- | --- | --- |
| Reglas unitarias | Actor, estado de origen/destino, motivo, confirmaciones independientes, cancelación parcial prohibida y acuerdos de incidencia | `tests/unit/claim-state.test.js`; idempotencia transaccional en integración `delivery.test.js` |
| Avisos unitarios | Destinatarios por acción y presentación sin datos ajenos | `tests/unit/notifications.test.js` |
| Integración de devolución | Aceptaciones concurrentes, reserva única, confirmaciones en ambos órdenes y simultáneas, reintentos, cancelación frente a confirmación, doble acuerdo y petición antigua, fallos con rollback | `tests/integration/delivery.test.js` |
| Integración de actividad | Avisos por reclamación y mensaje, decisiones y liberación; lectura persistente propia; historial con motivos/fechas; terceros excluidos y aislamiento de reclamantes | `tests/integration/activity.test.js` |
| Publicaciones | Retirada con reclamaciones, reserva bloqueada, devolución irreversible, edición pública notificada, versiones privadas, acceso autorizado tras cierre | Adaptar `tests/integration/posts-manage.test.js` y cobertura de privacidad |
| Navegador | Autor y dos reclamantes: rechazo/repetición, aceptación/espera, liberación, devolución, incidencia/acuerdos, avisos, historial y uso móvil | Nueva cobertura E2E de devolución/actividad y regresión de perfiles |
| Regresión | Registro, sesión, perfil, publicación, reclamación, chat, descargas privadas, migraciones y aislamiento entre entornos | `npm.cmd run verify` |

Trazabilidad: RF14, RF16–RF18 y RF22–RF26; privacidad RF3/RF5; evidencia DOC16/DOC21. Casos I01-P04 y P06–P10. La parte de conversación de I01-P05 conserva las comprobaciones de escritura según estado.

Las pruebas del servicio y validación de intercambios se sustituirán por reglas y transacciones de devolución; la integración HTTP anterior se sustituirá por comprobaciones de rutas retiradas sin escrituras ni pérdida de datos. Las pruebas de vistas comprobarán actividad vigente y ausencia de valoraciones. Se conservarán las pruebas de permisos, CSRF y aislamiento aplicables. El antiguo caso de retirada bloqueada por cualquier reclamación deberá sustituirse por retirada con cierre e historial, manteniendo el bloqueo cuando exista reserva.

## Condiciones de revisión y cierre

Antes de presentar I07 para revisión: completar implementación, ejecutar pruebas unitarias/integración y E2E afectadas, realizar regresión, preparar guía manual y registrar resultados reales. Actualizar especificación si se aprueba un cambio de alcance, catálogo, Planning, Seguimiento y Trazabilidad; ajustar README y documentación de perfil afectada. Las tarjetas siguen aplazadas a I09.

Jesús revisará documentación, código y pruebas antes del commit. Iniciar I07 no autoriza commit ni push ni acredita su cierre. Las comprobaciones locales pendientes de otros desarrolladores en I04 y los datos de esfuerzo sin imputar siguen identificados por separado.

## Implementación y uso

`src/delivery/` concentra permisos y transacciones; `src/activity/` registra y presenta avisos e historial. La conversación incorpora formularios de decisión, cancelación, confirmación e incidencia. Los motivos de rechazo, cancelación e incidencia admiten de 1 a 1000 caracteres. Entrega/recepción y acuerdo de anulación exigen casilla expresa. Los acuerdos identifican una incidencia concreta; las confirmaciones identifican el ciclo posterior a la última anulación, evitando aplicar formularios antiguos.

Avisos e historial paginan de 20 en 20. Las descargas de avatar comprueban el propietario antes de servir el archivo, también con variantes de ruta codificadas. Amigos conserva su flujo, con búsqueda e identidad por nombre de usuario. Las tablas de intercambios y valoraciones se mantienen; sus rutas de escritura responden 410 tras comprobar sesión y CSRF. Se retiran los servicios, formularios y pruebas unitarias que ya no corresponden al sistema vigente.

El sondeo del chat actualiza el estado y deshabilita acciones antiguas sin reemplazar el borrador. El usuario decide cuándo recargar los formularios; no se descarta automáticamente el texto en preparación. El servidor vuelve a validar cada acción aunque la pantalla aún no haya detectado el cambio.

Guía de revisión: [Pruebas manuales I07](Pruebas_manuales_I07.md). Evidencia: [Resultados I07](../tests/evidence/I07-2026-11-09.md). No se modifica ninguna migración ni se reinician bases de desarrollo.

Resultado final: `npm.cmd run verify` superado con 494 pruebas unitarias/integración y 18 E2E. Planning marca I07 como preparada y mantiene pendientes la revisión y autorización de Jesús, el commit/push y los datos de esfuerzo no imputados.

## Mejora visual posterior

Tras publicar I07 en `7528238`, Jesús solicita mejorar la presentación de las páginas. Se mantienen las reglas y los datos: se refuerza la visibilidad de botones principales y secundarios, se presentan estados con etiquetas, se organizan las acciones y mensajes en tarjetas y se añaden accesos explícitos a conversaciones e historial. El diseño conserva los colores de ReFind y permite el uso en móvil y con teclado. Antes de entregar se ejecutan los E2E afectados y se inspeccionan vistas de escritorio y móvil; no se requieren migraciones ni cambios de requisitos funcionales.

Validación de esta mejora: 36 pruebas de integración de reclamaciones, actividad y devolución, y 7 E2E de reclamaciones, devolución y publicaciones superadas. Inspección visual de formularios y gestión de incidencia, listados y avisos en escritorio y móvil; sin desbordamiento horizontal del contenido a 390 px. Los estados actualizados por sondeo mantienen también el color de su etiqueta. Sin commit de esta mejora visual; pendiente de revisión de Jesús.
