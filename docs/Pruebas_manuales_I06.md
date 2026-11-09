# Revisión manual de I06 antes del commit

Estado: pendiente de revisión por Jesús. I06 añade reclamación y conversación privada; aceptar, rechazar, cancelar y devolver se implementan en I07.

## Preparación

Ejecutar `npm run dev` y abrir `http://localhost:3000`. No se necesita una migración nueva si I05 está aplicada. Utilizar datos ficticios y dos cuentas en ventanas separadas: A publica un hallazgo y B lo reclama. Una tercera cuenta C permite comprobar la separación entre interesados. No es necesario establecer amistad.

| ID | Pasos | Resultado esperado |
| --- | --- | --- |
| I06-M01 | B abre el detalle de un hallazgo disponible de A y pulsa «Reclamar objeto». Repetir sin sesión. | B ve el formulario de reclamación. Sin sesión se solicita acceso. A no puede reclamar su propio hallazgo. |
| I06-M02 | Completar descripción y detalle distintivo con al menos 10 caracteres y el lugar con al menos 2. Marcar «No lo recuerdo» o indicar día/intervalo pasado. | Formulario válido. No se exige marca, modelo ni color por separado y no aparecen los datos privados del autor. |
| I06-M03 | Enviar con campos vacíos, descripción corta, fecha futura o intervalo invertido. | Errores identifican el campo y se conservan los textos. No se crea una reclamación. Los archivos pueden requerir seleccionarse de nuevo. |
| I06-M04 | Adjuntar hasta tres imágenes JPG/PNG/WebP o PDF de hasta 5 MB; repetir con cuatro, un archivo mayor o formato no admitido. | Los válidos se guardan privadamente. Los inválidos impiden el envío. Las imágenes se normalizan a WebP y admiten hasta 20 megapíxeles. |
| I06-M05 | Enviar la reclamación válida y volver a pulsar «Reclamar objeto» en el mismo hallazgo. | Se abre su conversación. El segundo acceso lleva a la reclamación activa existente; no crea otra. |
| I06-M06 | A y B abren «Mis reclamaciones» y entran en la conversación. Enviar texto y un archivo desde ambas cuentas. | Cada entrada identifica hallazgo, reclamación, estado y otro participante. Texto y descargas solo son accesibles para A y B. No aparece correo, foto del hallazgo ni lugar reservado de A. |
| I06-M07 | Dejar un borrador sin enviar en B; A envía un mensaje. Esperar unos cinco segundos en la pestaña visible de B. | Llega el mensaje sin recargar ni borrar el borrador. Los mensajes persisten al recargar o volver a iniciar sesión. |
| I06-M08 | C reclama el mismo hallazgo. Comparar su conversación con la de B. Copiar la dirección del chat y de un adjunto de B y abrirlas con C y sin sesión. | C tiene su propia conversación. No puede consultar la de B ni descargar sus archivos. Sin sesión se exige acceso. A participa en ambas, separadas. |
| I06-M09 | Revisar formulario, listado y chat con una ventana de unos 390 px. | Campos y enlaces utilizables sin desbordamiento horizontal. La navegación lateral se convierte en una barra desplazable en móvil. |
| I06-M10 | Si la conversación supera 50 mensajes, consultar «Mensajes anteriores» y volver a los últimos. | Se mantienen orden y contexto sin omitir mensajes. El listado pagina cada 20 conversaciones. Estas cantidades también tienen pruebas automatizadas. |

Las reclamaciones rechazadas/canceladas permiten una nueva con aportación adicional y un enlace al antecedente privado. Los chats cerrados son de solo lectura. En I06 estos casos se verifican con fixtures de pruebas: sus botones de decisión todavía pertenecen a I07. No hace falta modificar la base de desarrollo para aceptarlos manualmente ahora.

Registrar cada comprobación como OK, Fallo o No ejecutada, indicando pasos y resultado de cualquier fallo. La autorización del commit se solicita después de revisar documentación, código y pruebas.
