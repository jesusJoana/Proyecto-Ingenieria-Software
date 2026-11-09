# Pruebas manuales de I07

## Preparación

Inicia la aplicación con `npm.cmd run dev` y abre `http://localhost:3000`. Usa tres cuentas en sesiones separadas: A encuentra/publica, B reclama y C presenta otra reclamación del mismo objeto. Puedes usar navegadores distintos o perfiles separados; dos pestañas de incógnito del mismo navegador pueden compartir sesión.

Prepara al menos cuatro hallazgos disponibles de A para probar devolución, cancelación, incidencia y retirada sin reutilizar un objeto ya cerrado. No necesitas limpiar la base ni ejecutar migraciones nuevas para I07.

## Comprobaciones

| Caso | Pasos | Resultado esperado |
| --- | --- | --- |
| M01 Rechazo y nueva reclamación | B y C reclaman un hallazgo. A abre la reclamación de B en Mis reclamaciones y la rechaza indicando el motivo. B vuelve a reclamar aportando información adicional. | Solo se rechaza la de B; C sigue pendiente. B ve el motivo, conserva el chat anterior de consulta y abre otro vinculado al antecedente. El objeto sigue disponible. |
| M02 Reserva única | A acepta una reclamación de B. C abre la suya sobre el mismo hallazgo. | Objeto reservado, B aceptada y C en espera. No puede entrar una nueva reclamación. C no conoce la identidad ni las pruebas de B. |
| M03 Cancelar solicitud | C cancela su reclamación en espera indicando motivo. | Solo se cancela la de C; la reserva de B continúa. Repite en otro hallazgo con una solicitud pendiente. |
| M04 Liberar reserva | Con B aceptada y C en espera, sin confirmaciones, A o B cancela la reserva con motivo. | B queda cancelada, el objeto vuelve a disponible y C pasa a pendiente. Los afectados reciben avisos. A puede aceptar después la de C. |
| M05 Devolución | A acepta a B. A marca «Confirmo que he entregado el objeto» y pulsa Confirmar entrega. Después B marca que lo ha recibido y confirma recepción. | Con la primera confirmación sigue reservado. Con ambas queda devuelto y la reclamación completada; las demás activas se cierran por entrega a otra persona. El objeto desaparece de búsquedas públicas y sigue en el historial autorizado. |
| M06 Orden inverso | En otro hallazgo reservado, B confirma recepción antes de que A confirme entrega. | La primera confirmación mantiene la reserva; ambas completan una sola devolución, con independencia del orden. |
| M07 Incidencia | Tras una sola confirmación, registra una incidencia con motivo. Una parte acepta anular la confirmación; después lo hace la otra. | No hay cancelación unilateral. Un acuerdo no basta. Con los dos se anula la confirmación, pero la reserva se mantiene hasta cancelarla expresamente con motivo. La incidencia y los acuerdos constan en el historial. |
| M08 Aclarar sin anular | Tras una confirmación y una incidencia, la otra parte confirma su entrega/recepción. | Se completa la devolución. La incidencia no permite deshacer después una devolución completada. |
| M09 Retirada | A retira un hallazgo disponible con reclamaciones, indicando motivo y marcando la confirmación. Intenta retirar otro que está reservado. | El disponible se retira, cierra las solicitudes abiertas, avisa y conserva conversaciones. El reservado exige cancelar antes la reserva. Un devuelto o retirado no se reactiva. |
| M10 Avisos e historial | Abre Mis avisos y Mi historial en las tres cuentas. Envía un mensaje, cambia datos públicos de un hallazgo y consulta los avisos. Marca uno como leído y recarga. | Cada cuenta ve solo su actividad autorizada. Los cambios públicos y mensajes generan avisos sin exponer detalles de otro reclamante. La lectura persiste. Las modificaciones privadas no notifican ni muestran versiones al reclamante. |
| M11 Cambios con pantalla abierta | B escribe un borrador en el chat sin enviarlo. A cambia el estado de esa reclamación. Espera unos cinco segundos en B. | Se conserva el borrador, se actualiza el estado y se avisa de que hay que actualizar las acciones. Los controles antiguos dejan de estar disponibles. Si se cierra, no puede enviarse el mensaje. |
| M12 Privacidad del perfil | Completa datos personales y foto en A. Desde B o sin sesión abre `/u/<usuario-de-A>`. Busca A en Amigos por usuario y por correo. Prueba desde B la dirección de la foto de A. | Solo aparece el nombre de usuario. El correo no sirve para localizarlo. Los datos y el avatar son privados; la descarga ajena devuelve 404. A sigue viendo y editando su propio perfil. |
| M13 Perfil y funciones retiradas | Abre Mi perfil y un perfil público. | El perfil propio resume publicaciones, reclamaciones activas y devoluciones. No hay propuestas de intercambio independiente ni valoraciones. Amigos conserva solicitudes y conversación. |
| M14 Validación y móvil | Deja vacíos motivos obligatorios y casillas de confirmación; revisa un ancho de 390 px. | No se ejecutan acciones incompletas, los errores se entienden y los formularios se pueden utilizar sin desbordamiento horizontal del contenido. |

La concurrencia, los reintentos, los fallos transaccionales y las peticiones manipuladas se comprueban automáticamente; no necesitas alterar registros a mano.

## Antes del commit

Ejecuta `npm.cmd run verify`. Revisa los cambios de especificación, Excel, código y pruebas, y registra cualquier incidencia encontrada. La ejecución automática y esta guía no sustituyen tu aceptación. I07 se entrega preparada para revisión, sin commit ni push automáticos.
