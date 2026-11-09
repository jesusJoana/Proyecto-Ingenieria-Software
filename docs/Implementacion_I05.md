# Publicación y consulta de hallazgos — I05

Los criterios del formulario, filtros, fechas, fotografías y mapa han sido validados por Jesús y recogidos en el apartado 4.2 de la especificación antes de modificar código. I05 adopta `found_objects`, `found_object_private` y sus versiones. Las publicaciones anteriores de `object_posts` no se convierten ni se muestran en el nuevo recorrido.

La portada ofrece consultar hallazgos a quien ha perdido algo y publicar a quien ha encontrado un objeto. Muestra hallazgos reales. El formulario separa datos públicos y privados, genera el título y no permite publicar pérdidas ni cambiar autoría o estado mediante campos manipulados.

La búsqueda combina filtros públicos, incluido solapamiento de fechas, y pagina de 20 en 20. Lista y mapa muestran disponibles y reservados. El detalle de retirados y devueltos solo es accesible para autor y reclamantes del objeto. Ante otros usuarios, la identidad del autor se limita al nombre de usuario. La imagen pública es un icono genérico, nunca la fotografía del objeto.

La fotografía se comprueba por contenido, se convierte en WebP sin metadatos y se almacena por entorno fuera de `public`. Una ruta autenticada verifica la autoría antes de servir cada foto, incluso las anteriores, sin caché. Ninguna aceptación de reclamación concede acceso a la fotografía reservada del autor.

Cada alta y edición guarda una versión pública y privada. El autor consulta esas versiones; reemplazar o quitar una fotografía actual conserva la antigua para su historial. La edición bloquea la fila del hallazgo, comprueba su estado y conserva la autoría; los cambios públicos notifican a los reclamantes activos. La retirada exige motivo y confirmación, conserva el objeto e historial y se admite solo si está disponible y no tiene reclamaciones. La retirada con reclamaciones se completa en I07. Las rutas antiguas de cambio manual de estado y borrado físico quedan inhabilitadas.

La migración 013 añade una referencia opcional de campus, con coordenadas públicas redondeadas por el servidor a dos decimales y restricciones de pareja y rango. La precisión depende de la latitud; el círculo es orientativo, no un límite del campus ni una garantía de distancia al objeto. El lugar exacto se introduce como texto privado y no genera la referencia pública. No se geocodifican direcciones ni se solicita la ubicación del dispositivo.

Universidad/campus conservan el límite de 180 caracteres y zona general el de 150. Se validan fechas del calendario de cuatro cifras; el intervalo puede representar un solo día y no admite fechas futuras. Texto de búsqueda hasta 100 caracteres; motivo de retirada de 2 a 1000. Estas limitaciones técnicas se aplican en servidor y formulario, conservando valores tras errores.

El detalle de casos y sustituciones está en «Preparación de I05» de `tests/README.md`. Se comprueban fugas por respuestas, filtros y descargas, transacciones fallidas, privacidad tras reserva, fotografías anteriores, permisos, estados cerrados y navegación móvil. I06 e I07 implementan reclamaciones, conversaciones y decisiones de devolución.

El perfil sustituye sus avisos de futuras publicaciones por enlaces a la búsqueda y a Mis publicaciones. Se eliminan plantillas y scripts del formulario mixto que ya no tienen rutas activas. No se modifica el módulo anterior de intercambios, pendiente de I07.
