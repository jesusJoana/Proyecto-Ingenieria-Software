# Modelo de datos y reconstrucción local — I04

Actualización I05: la migración 013 añade la referencia pública opcional de campus. Publicación, consulta, versiones y fotografías privadas ya utilizan el esquema descrito aquí. El detalle vigente está en [Implementación I05](Implementacion_I05.md); las atribuciones de trabajo pendiente de los apartados siguientes describen la entrega original de I04.

Diseño del 09/11/2026. Referencia: Especificación del sistema, apartados 4 y 5; caso I01-P11. La verificación de las máquinas se registra en Requisitos.xlsx.

## Alcance

La migración 012 añade el modelo de hallazgos, reclamaciones y comunicaciones. Las migraciones 001–011 se conservan. Las tablas anteriores siguen disponibles para la aplicación durante la transición; no se convierten sus datos ni se conectan sus publicaciones con reclamaciones nuevas. I05 adapta publicaciones y consulta; I06, reclamaciones y chat; I07, acciones de reserva e historial; I08, muro. La existencia del esquema no acredita esos recorridos de usuario.

## Entidades y privacidad

| Tabla | Contenido y relaciones |
| --- | --- |
| `found_objects` | Autor obligatorio, categoría, tipo general, universidad, campus, zona general, intervalo de fecha aproximada y estado. Título compuesto al consultar; sin título libre. |
| `found_object_private` | Una fila por hallazgo: detalles distintivos obligatorios, lugar exacto, depósito y fotografía opcionales. Solo el autor en la aplicación. |
| `found_object_versions` | Instantáneas públicas y privadas separadas, número de versión único por objeto. Consulta reservada al autor. |
| `claims` | Hallazgo, autor y reclamante diferentes, descripción, detalle distintivo, lugar, fecha opcional explícitamente desconocida, información adicional, antecedente y estado. |
| `claim_evidence` | Archivo privado y metadatos vinculados a una reclamación. |
| `claim_messages` | Conversación identificada por la reclamación; emisor limitado a sus participantes. No requiere amistad. |
| `claim_message_files` | Metadatos de archivos privados del mensaje. |
| `claim_incidents` | Incidencia, participante que la abre y constancia del acuerdo de ambos para anular confirmaciones. |
| `activity_events` | Historial del hallazgo y, cuando corresponde, de una reclamación, actor, acción y datos del evento. |
| `notifications` | Destinatario, evento, fecha y lectura. Un aviso por evento y destinatario. |
| `wall_messages` | Autor y contenido del muro, separado de las conversaciones privadas. |

`public_found_objects` proyecta solo datos públicos, estado y nombre de usuario del autor; excluye devueltos y retirados. La autorización HTTP y la selección de información del historial se implementan en I05–I08: una vista SQL no sustituye los permisos de la aplicación. Los archivos nuevos se almacenarán fuera de `public`, bajo `storage/environments/<entorno>`, con nombres UUID. Las URL antiguas `/uploads/posts/` dejan de servir fotos desde I04. La visualización privada del autor se completa en I05.

Las fechas aproximadas se almacenan mediante inicio y fin inclusivos. Una fecha única usa el mismo día; una fecha desconocida en reclamación usa ambos nulos y `date_unknown=true`. La precisión de entrada y filtros se concreta en I05/I06. Categorías, formatos y límites de formularios siguen pendientes en esas iteraciones; el esquema exige texto no vacío sin inventar listas adicionales.

## Integridad

- Claves foráneas sin borrado en cascada en las nuevas entidades históricas. No se elimina un usuario con hallazgos o reclamaciones.
- Unicidad parcial de reclamación activa por objeto y reclamante (`pending`, `waiting`, `accepted`), y de aceptación/completado por objeto.
- Antecedente de la misma persona y objeto. Una repetición exige explicación y antecedente rechazado o cancelado; sin archivo obligatorio.
- Una reclamación nueva exige objeto disponible ajeno. Se bloquea la fila del objeto al crearla para coordinar operaciones concurrentes.
- Estados de hallazgo: `available`, `reserved`, `returned`, `withdrawn`. Reclamación: `pending`, `waiting`, `accepted`, `completed`, `rejected`, `cancelled`, `closed_withdrawn`, `closed_delivered`.
- Una comprobación diferida al final de la transacción vincula reservado con una aceptada y devuelto con una completada. Disponible no admite aceptadas ni en espera; retirado/devuelto no admiten activas. Las dos confirmaciones solo corresponden a completada; una confirmación mantiene aceptada. Rechazo, cancelación y retirada requieren motivo.
- Las claves de autoría y participantes se mantienen inmutables. Mensajes y evidencias cerrados no admiten nuevas altas. Las transiciones autorizadas, avisos, conservación de versiones, acuerdo de anulación y reintentos de entrega se implementan transaccionalmente en I05–I07, sin atribuir a I04 esa funcionalidad pendiente.

## Reinicio y pruebas

`db:reset -- <entorno> --confirm <base>` reconstruye únicamente el esquema público de una base local autorizada. Comprueba URL, identidad real, rol sin privilegios administrativos, aislamiento y ausencia de otras conexiones; no termina sesiones ajenas. Conserva base, roles y permisos. La sustitución del esquema y todas las migraciones forman una transacción: un fallo revierte el conjunto. La aplicación debe permanecer detenida durante todo el proceso.

La limpieza de archivos es independiente: el reinicio de una base no borra carpetas compartidas. `db:clean-files -- --confirm all-local-files` exige las tres bases vacías, sin otras conexiones, y valida rutas y ausencia de enlaces antes de borrar archivos de prueba. También elimina los archivos privados de los tres entornos. No acepta rutas arbitrarias ni elimina directorios completos recursivamente.

Pruebas unitarias: selección de destino, rol, argumentos y rutas, enlaces y propagación de errores. Integración: PostgreSQL temporal independiente con las tres bases y roles, migraciones desde vacío y datos anteriores, repetición, fallo con reversión, aislamiento, conexiones ocupadas, restricciones, privacidad de la vista, mensajes y concurrencia. Las pruebas nunca reinician las bases configuradas en `.env`.

Cada desarrollador ejecuta después el procedimiento del manual en sus tres bases. La comprobación automatizada en PostgreSQL temporal se registra separadamente y no completa ninguna de esas 18 verificaciones.
