# Revisión manual de I05 antes del commit

Estado: pendiente de ejecución y aceptación por Jesús. Las pruebas automáticas no sustituyen esta revisión.

## Preparación

Desde la carpeta del proyecto, ejecutar `npm run db:migrate` y `npm run dev`. Abrir la dirección de desarrollo que indique la terminal. La migración 013 ya se ha aplicado en el equipo de Jesús. No es necesario limpiar la base para esta revisión.

Utilizar una cuenta A como autora. Para revisar la privacidad, abrir una ventana privada sin sesión y, después, acceder en ella con una cuenta B distinta. Usar datos ficticios. Los datos de la prueba manual permanecen disponibles para que Jesús los revise; no se eliminan automáticamente.

Publicar dos hallazgos: uno con fotografía y referencia de campus y otro sin esos campos opcionales. Ejemplo para el primero:

| Campo | Valor de prueba |
| --- | --- |
| Categoría | Accesorios |
| Tipo general | Mochila |
| Universidad / campus / zona | Universidad de prueba / Campus central / Biblioteca |
| Fecha desde | Un día pasado o el día actual |
| Fecha hasta | Vacía para un solo día; después probar un intervalo |
| Detalles distintivos | Costura interior roja y tres bolsillos ocultos |
| Lugar exacto / depósito | Sala secreta 42 / Taquilla privada 17 |
| Referencia de campus | Latitud 40.413456 y longitud -3.712345 |
| Fotografía | JPG, PNG o WebP de prueba, inferior a 5 MB |

## Recorrido y resultados esperados

| ID | Pantalla y pasos | Resultado esperado |
| --- | --- | --- |
| M01 | Inicio `/`. Pulsar «Buscar mi objeto» y «Publicar objeto encontrado». Repetir sin sesión. | Buscar abre los hallazgos sin exigir acceso. Publicar requiere sesión. No existe formulario para anunciar pérdidas. Los objetos recientes proceden de la base. |
| M02 | «Publicar», `/publicaciones/nueva`. Revisar secciones y publicar el primer hallazgo. | Separación clara entre información pública y privada. Título generado con el tipo y campus. El autor aparece con su nombre de usuario; estado Disponible. |
| M03 | Antes de publicar, dejar un obligatorio vacío, poner detalles de menos de 10 caracteres, fecha futura o final anterior al inicio. Corregir y volver a enviar. | Mensaje de error, sin crear el hallazgo. Se conservan los textos para corregirlos. El archivo puede requerir seleccionarse otra vez por seguridad del navegador. |
| M04 | Publicar el segundo hallazgo sin foto, lugar exacto, depósito ni mapa; indicar solo fecha inicial. | Publicación correcta; esos datos son opcionales. Aparece en el listado aunque no figure en el mapa. |
| M05 | Abrir el primer detalle en la cuenta A, después en ventana privada y en cuenta B. Copiar la dirección de la foto y abrirla también allí. | A ve detalles, lugar exacto, depósito y foto. Visitante y B solo ven datos públicos, estado y nombre de usuario. Sin sesión la foto pide acceso; con B no se entrega. B tampoco puede editar, retirar ni consultar versiones de A mediante la URL. |
| M06 | «Publicaciones», `/publicaciones`. Combinar tipo, categoría, universidad, campus, zona y fechas. Buscar «Costura interior roja» y «Sala secreta 42». Limpiar filtros. | Los filtros se combinan y las fechas buscan intervalos que se solapan. Los textos privados no permiten localizar el objeto. Limpiar restaura el listado. Solo se muestran disponibles y reservados. |
| M07 | «Objetos por zonas», `/objetos-por-zonas`. Revisar el hallazgo con mapa y sus filtros. Volver a editarlo como A para revisar coordenadas. | Referencia de campus aproximada, guardada como 40.41 y -3.71. No aparece el lugar exacto ni el depósito. El segundo hallazgo sin referencia sigue accesible en Publicaciones. |
| M08 | «Mis publicaciones», abrir un hallazgo y «Editar hallazgo». Cambiar zona general y detalles privados. Cambiar la foto; después quitarla. Abrir «Consultar versiones». | Cambios guardados, autor y estado conservados. Las versiones anteriores mantienen sus datos y fotografías; solo A puede verlas. Quitar la foto actual no borra las anteriores. |
| M09 | «Retirar hallazgo». Volver sin confirmar; repetir con motivo y confirmación. Revisar Mis publicaciones y buscar como visitante. | Volver no cambia el objeto. Tras confirmar queda Retirado y desaparece de búsqueda y mapa públicos. A conserva detalle e historial; no puede editar ni reactivar. No se borra físicamente. |
| M10 | «Mi perfil» y navegación. Revisar a tamaño móvil, aproximadamente 390 px, formulario, detalle, lista y mapa. | Perfil con enlaces a buscar y gestionar hallazgos. Campos, mensajes y botones utilizables sin desplazamiento horizontal. No hay avisos que prometan publicar pérdidas. |
| M11 | Solo si se quiere comprobar manualmente la paginación: disponer de 21 hallazgos que cumplan el mismo filtro y pasar a «Siguiente» y «Anterior». | 20 resultados en la primera página y el restante en la segunda, sin duplicados y conservando filtros. Ya cubierto automáticamente; no es necesario crear 21 objetos para las demás pruebas. |
| M12 | Intentar subir un archivo que no sea imagen, una imagen superior a 5 MB o un archivo de texto renombrado como JPG. | Se rechaza con un error, sin crear ni alterar el hallazgo. Se conservan los campos de texto. |

## Fuera del recorrido manual de I05

Crear reclamaciones y conversar sobre ellas corresponde a I06. Aceptar/rechazar, reservar, cancelar y confirmar devolución corresponde a I07, que también completa la retirada con reclamaciones y la presentación de avisos. El muro corresponde a I08. Estos botones no deben darse por implementados en I05.

Las pruebas de integración comprueban edición de un reservado, bloqueo de edición de cerrados, acceso autorizado del reclamante y avisos persistidos utilizando fixtures de base de datos; no hace falta modificar estados directamente para esta revisión manual.

## Registro de la revisión

Anotar por cada M01–M12: **OK**, **Fallo** o **No ejecutada**, cuenta utilizada, fecha y observación. En un fallo, incluir pasos y resultado obtenido. La revisión de Jesús y su autorización del commit siguen pendientes hasta que las confirme expresamente.
