# Ubicaciones universitarias: versión básica

Al publicar se introducen universidad, campus o sede, ciudad, país y dirección del campus. Son campos libres: no se restringen a España ni a un catálogo cerrado y no se verifican contra un registro oficial.

El autor elige qué representa el punto del mapa:

- **Campus:** referencia general seleccionada manualmente; el círculo es orientativo y no representa los límites reales del recinto.
- **Punto exacto:** lugar de la pérdida o del hallazgo indicado por el autor.

Se puede elegir el punto con un clic, arrastrar el marcador o introducir latitud y longitud. «Usar mi ubicación» solicita permiso únicamente al pulsarlo. El nombre y la dirección escritos no se convierten automáticamente en coordenadas: hay que confirmar el punto.

En objetos encontrados se guarda por separado dónde se encontró y dónde está depositado ahora. El mapa representa el hallazgo o el campus, no el depósito. No se deben introducir domicilios particulares como depósito.

Cada ficha muestra los datos del lugar y un mapa. El autor puede corregirlos mediante «Editar ubicación». Las publicaciones anteriores a esta función conservan su lugar original; pueden completar sus datos desde esa misma pantalla.

`/objetos-por-zonas` es público y permite buscar por universidad, campus y tipo. Muestra hasta 200 publicaciones activas con coordenadas, ordenadas por fecha de publicación. Las publicaciones sin coordenadas siguen disponibles en el listado general. Esta primera versión no tiene catálogo oficial, búsqueda automática de direcciones, agrupación de marcadores ni carga según el área visible.

## Preparación en otro equipo

Ejecutar `npm ci` y las migraciones del entorno: `npm run db:migrate`, `npm run db:migrate:test` o `npm run db:migrate:e2e`. La migración 009 añade columnas sin asignar datos geográficos inventados a las publicaciones existentes.

## Mapas y pruebas

Leaflet se sirve desde las dependencias locales. El fondo utiliza OpenStreetMap y requiere conexión; si falla, el texto y las coordenadas siguen disponibles. No hay geocodificación ni solicitudes a Nominatim. Se mantiene la atribución y no se descargan mapas para uso sin conexión. Antes de publicar un servicio de mayor tráfico, revisar la [política del proveedor de teselas](https://operations.osmfoundation.org/policies/tiles/).

`npm test` comprueba validación, persistencia, filtrado, permisos y corrección de ubicación. `npm run test:e2e -- tests/e2e/posts.spec.js` comprueba el flujo de publicación y edición, la conservación de campos tras errores y el mapa/lista en móvil. Las pruebas de navegador bloquean las teselas externas para no depender de la red ni consumir el servicio de mapas.
