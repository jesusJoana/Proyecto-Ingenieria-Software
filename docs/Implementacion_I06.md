# Reclamaciones y conversación privada — I06

## Alcance

I06 parte de I05 publicada en `67b7c41ecb0fbce70fb514f0898a811c09866b57`. Incorpora el formulario para reclamar un hallazgo disponible ajeno, las evidencias opcionales y una conversación privada por reclamación. La identidad procede de la sesión; el autor se obtiene del objeto. No se requiere amistad. El módulo anterior de Amigos conserva su cobertura hasta resolver su destino.

Solo los dos participantes pueden consultar la reclamación, sus evidencias, mensajes y adjuntos. La información privada del hallazgo y las versiones del autor siguen siendo exclusivas del autor. El listado de conversaciones identifica objeto, reclamación, estado y nombre de usuario de la otra persona, sin datos personales adicionales.

Pendiente, en espera y aceptada permiten escribir. Los demás estados permiten únicamente consultar. No se implementan las decisiones de aceptación/rechazo, reserva, cancelación ni devolución: pertenecen a I07. Sus estados se preparan mediante fixtures aisladas para probar permisos y lectura sin modificar datos de desarrollo.

## Reglas ya validadas

Una persona no puede reclamar su propio objeto ni mantener dos reclamaciones activas del mismo hallazgo. El objeto debe estar disponible en el momento de guardar. Tras rechazo o cancelación se permite una nueva reclamación con explicación de la aportación adicional, sin obligar a adjuntar un archivo. El servidor vincula el antecedente de la misma persona y objeto. Los demás reclamantes no acceden a él.

Descripción, detalles distintivos y lugar de pérdida son obligatorios. Marca, modelo y color no son obligatorios por separado. La fecha admite «No lo recuerdo». No se solicitan contraseñas, PIN, documentos de identidad completos ni datos bancarios.

## Criterios validados por Jesús

- Descripción y detalles distintivos: 10–2000 caracteres cada uno.
- Lugar de pérdida: 2–250 caracteres.
- Información adicional al repetir reclamación: 10–2000 caracteres.
- Fecha: día o intervalo inclusivo sin fechas futuras; alternativamente, desconocida.
- Mensaje: texto de 1–2000 caracteres.
- Evidencias iniciales y adjuntos por mensaje: hasta 3 archivos opcionales JPG, PNG, WebP o PDF; máximo 5 MB por archivo.

Estos límites están validados y se incorporan a la especificación y al catálogo antes de modificar código funcional.

## Diseño y revisión de migraciones

La migración 012 ya contiene `claims`, `claim_evidence`, `claim_messages` y `claim_message_files`, con relaciones de participantes, antecedente y unicidad de reclamación activa. La conversación se identifica por la propia reclamación, sin necesitar una amistad ni una tabla de conversación adicional. Las pruebas confirman que no es necesaria una migración nueva. Se conservan 001–013 sin modificaciones.

El alta bloquea el hallazgo y comprobará disponibilidad, autoría y antecedentes dentro de una transacción. Se conserva la restricción única como protección adicional ante duplicados concurrentes. Las operaciones de mensajes comprueban pertenencia y estado con bloqueo compatible con las transiciones de I07.

Los adjuntos se almacenan fuera de `public`, separados por entorno y con claves aleatorias. Se comprueban formato declarado, contenido y tamaño antes de persistir. Las descargas vuelven a comprobar la participación y se sirven sin caché; no se expone el almacenamiento por rutas estáticas. Un fallo de persistencia limpia los archivos recién creados y evitar registros huérfanos.

## Pruebas definidas antes de implementar y ejecutadas

| Nivel | Casos y archivos previstos |
| --- | --- |
| Unitarias | `claims-validation.test.js`: obligatorios, límites validados, fechas conocidas/desconocidas, repetición y campos manipulados. `claims-service.test.js`: reglas de participante y estado, errores y permisos. Validación específica de adjuntos. |
| Integración | `claims.test.js`: sesión/CSRF, alta atómica, autor desde objeto, reclamante desde sesión, propia/duplicada/no disponible, repetición con antecedente y concurrencia. Archivos fallidos sin registros ni ficheros huérfanos. |
| Integración | `claim-chat.test.js`: conversación sin amistad, dos interesados aislados, terceros excluidos, descargas autorizadas, persistencia y estados cerrados de solo lectura. Privados del hallazgo nunca visibles al reclamante. |
| Navegador | Dos cuentas publican/reclaman/conversan; otro reclamante no accede al chat ni a las pruebas ajenas. Formularios conservan valores tras error; navegación desde detalle y listado de conversaciones; revisión móvil. |
| Regresión | Conservar autenticación, publicación, privacidad de fotos, Amigos y migraciones. Ejecutar las suites afectadas y la regresión completa antes de revisión. |

Trazabilidad: I01-P03, I01-P04 e I01-P05. Los dos últimos mantienen pendiente su parte de decisiones y ciclo de estados en I07. La aceptación manual, revisión de documentos/código/pruebas y autorización de Jesús preceden al commit; no se hace commit ni push automáticamente.

Los mensajes se recuperan en páginas de 50 mediante identificadores, sin omitir envíos al sondear. La conversación consulta novedades cada cinco segundos cuando está visible, conserva el borrador y ofrece mensajes anteriores. El listado de conversaciones pagina de 20 en 20.

Las imágenes se decodifican, admiten hasta 20 megapíxeles y se normalizan a WebP de un máximo de 1600 píxeles por lado sin metadatos. Los PDF se reconocen por cabecera y terminación y se sirven como descarga, sin ejecutar contenido en la página. Las ampliaciones de pruebas se aportan como mensajes y adjuntos de la conversación activa.

La guía de revisión manual está en [Pruebas manuales I06](Pruebas_manuales_I06.md). La implementación y ejecución de pruebas no equivalen a aceptación de Jesús ni autorizan commit/push.

Resultado: `npm run verify` superado con 433 pruebas unitarias/integración y 15 E2E. [Evidencia I06](../tests/evidence/I06-2026-11-09.md).
