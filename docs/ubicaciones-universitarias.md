# Ubicaciones universitarias

Cada hallazgo tiene universidad, campus y zona general como texto público. Universidad y campus admiten de 2 a 180 caracteres; la zona general, de 2 a 150. Son campos libres y no se validan contra un catálogo oficial. No se publican ciudad, país, dirección exacta ni depósito como campos separados.

El mapa es opcional. Escribir el nombre del campus no asigna coordenadas: hay que desplegar «Referencia del campus en el mapa» y seleccionar un punto o introducir ambas coordenadas. El autor introduce ambas coordenadas o selecciona una referencia general del campus. El servidor las redondea a dos decimales antes de almacenarlas, con una resolución aproximada de un kilómetro que varía con la latitud. El círculo es orientativo: no representa el lugar exacto del hallazgo ni los límites oficiales del campus. No se solicita la ubicación del dispositivo ni se convierten direcciones en coordenadas.

El lugar exacto y dónde se guarda el objeto son textos privados opcionales de hasta 250 caracteres. Solo el autor puede consultarlos. No se utilizan para generar el mapa ni para buscar. La referencia pública puede corregirse junto al resto de datos mediante «Editar hallazgo», conservando las versiones anteriores.

`/objetos-por-zonas` es público y muestra hallazgos disponibles y reservados con referencia de campus. Comparte los filtros públicos del listado: texto general, categoría, universidad, campus, zona general y solapamiento de fechas. Presenta 20 resultados por página, del más reciente al más antiguo. Los hallazgos sin coordenadas siguen en `/publicaciones`. Si la búsqueda no encuentra hallazgos con referencia cartográfica, la pantalla lo indica expresamente y permite consultar los mismos filtros en el listado general. No hay búsqueda por cercanía, agrupación ni carga según el área visible.

## Preparación en otro equipo

Ejecutar `npm ci` y las migraciones de cada entorno: `npm run db:migrate`, `npm run db:migrate:test` y `npm run db:migrate:e2e`. La migración 013 añade la referencia pública opcional a `found_objects` y a la vista pública, sin inventar coordenadas. Si se necesitan bases limpias, seguir el apartado 5 del [manual de base de datos](Manual_base_datos_ReFind.md#5-reinicio-de-datos-de-desarrollo).

## Mapas y pruebas

Leaflet se sirve localmente. El fondo de OpenStreetMap requiere conexión; si falla, el texto y la referencia siguen disponibles. No se realizan solicitudes a Nominatim ni descargas para uso sin conexión. Se conserva la atribución del proveedor.

`npm test` comprueba límites, redondeo, persistencia, filtros, permisos y ausencia de información privada. `npm run test:e2e -- tests/e2e/posts.spec.js` comprueba publicación, corrección de errores, búsqueda y mapa en móvil. Las pruebas bloquean las teselas externas para no depender de la red.
