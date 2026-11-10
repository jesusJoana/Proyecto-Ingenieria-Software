# Ubicaciones universitarias

Cada hallazgo tiene universidad, campus y zona general como texto público. Universidad y campus admiten de 2 a 180 caracteres; la zona general, de 2 a 150. Son campos libres y no se validan contra un catálogo oficial. No se publican ciudad, país, dirección exacta ni depósito como campos separados.

El mapa público es opcional. Escribir el nombre del campus no asigna coordenadas. Puede seleccionarse una referencia general en «Referencia del campus en el mapa». Al capturar la ubicación privada del hallazgo, si no se ha indicado referencia pública, el servidor genera una referencia redondeada a dos decimales (aproximadamente un kilómetro, variable con la latitud). La posición precisa nunca se sirve en respuestas públicas. El círculo público es orientativo: no representa el lugar exacto ni los límites oficiales del campus. Las ubicaciones próximas a los polos, fuera del rango admitido por el mapa público, se guardan solo en privado.

El lugar exacto y dónde se guarda el objeto son textos privados opcionales de hasta 250 caracteres. Solo el autor puede consultarlos, junto con sus coordenadas y precisión. Las descripciones no se utilizan para buscar ni se publican. La referencia pública puede corregirse mediante «Editar hallazgo», conservando versiones anteriores. La ubicación original del hallazgo se conserva; la custodia se actualiza por separado mientras el objeto está disponible o reservado.

## Usar mi ubicación actual — UBI-01 a UBI-10

El botón solicita una sola captura del dispositivo después de pulsarlo, sin seguimiento continuo. La persona debe estar junto al objeto y comprobar el resultado. El mapa privado permite mover el marcador o pulsar un punto. La precisión indicada procede del dispositivo; si supera 100 metros se avisa para que se revise. Ajustar un punto manualmente elimina la precisión de GPS, que ya no corresponde a ese punto.

«Introducir manualmente» permite escribir el lugar incluso si falla Leaflet, la red o el permiso del navegador. «Quitar punto» elimina las coordenadas y conserva el texto. Publicar o guardar confirma las ubicaciones indicadas. Ni un fallo de dirección ni una respuesta tardía deben sobrescribir texto en preparación.

La captura requiere un contexto seguro: localhost/loopback en desarrollo o HTTPS al acceder desde otros dispositivos. HTTP mediante una IP de la red local puede bloquearla. Se muestra una alternativa manual, sin solicitar permisos al cargar la página.

### Dirección orientativa opcional

`GEOCODER_URL` configura el endpoint `/reverse` de una instancia Nominatim propia o un proveedor compatible autorizado para recibir las coordenadas privadas. Ejemplo: `GEOCODER_URL=http://127.0.0.1:8080/reverse`. Se configura en el `.env` del entorno y requiere reiniciar el servidor. No se cambia ningún `.env` del desarrollador automáticamente.

No se configura un proveedor externo por defecto: la política del Nominatim público prohíbe enviar material confidencial. La búsqueda pasa por una ruta POST con sesión y CSRF, sin caché HTTP ni coordenadas en la URL del navegador. Hay un límite de una petición cada 1,1 segundos por proceso y cuatro segundos de espera; no se registran coordenadas ni respuestas en logs. Si no hay proveedor, este falla o se alcanza el límite, se conserva la ubicación y se permite escribir el lugar. El límite es por proceso; un despliegue con varios procesos necesita un límite compartido adecuado al proveedor.

La respuesta `display_name` se limita a 250 caracteres y solo completa descripciones vacías. El usuario debe revisarla. Las pruebas usan respuestas simuladas; no acreditan que haya un servicio de direcciones desplegado.

Referencias: [Geolocalización del navegador](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition), [política del Nominatim público](https://operations.osmfoundation.org/policies/nominatim/).

`/objetos-por-zonas` es público y muestra hallazgos disponibles y reservados con referencia de campus. Comparte los filtros públicos del listado: texto general, categoría, universidad, campus, zona general y solapamiento de fechas. Presenta 20 resultados por página, del más reciente al más antiguo. Los hallazgos sin coordenadas siguen en `/publicaciones`. Si la búsqueda no encuentra hallazgos con referencia cartográfica, la pantalla lo indica expresamente y permite consultar los mismos filtros en el listado general. No hay búsqueda por cercanía, agrupación ni carga según el área visible.

## Preparación en otro equipo

Ejecutar `npm.cmd ci` y las migraciones de cada entorno: `npm.cmd run db:migrate`, `npm.cmd run db:migrate:test` y `npm.cmd run db:migrate:e2e`. La migración 013 añade la referencia pública; la 014 añade coordenadas y precisión privadas de hallazgo y custodia, sin inventar posiciones para datos anteriores. No es necesario reiniciar ni borrar bases. Las versiones nuevas conservan ambas posiciones en `private_data`.

## Mapas y pruebas

Leaflet se sirve localmente. El fondo de OpenStreetMap requiere conexión; si falla, el texto y la referencia siguen disponibles. Las teselas del mapa se solicitan al proveedor, también al abrir el mapa privado; no se envían descripciones privadas. No se realizan descargas para uso sin conexión. Se conserva la atribución del proveedor.

`npm test` comprueba límites, redondeo, persistencia, filtros, permisos y ausencia de información privada. `npm run test:e2e -- tests/e2e/posts.spec.js` comprueba publicación, corrección de errores, búsqueda y mapa en móvil. Las pruebas bloquean las teselas externas para no depender de la red.
