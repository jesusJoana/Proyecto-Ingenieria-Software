/* Mapas universitarios. La ubicación del dispositivo solo se pide al pulsar el botón. */
(() => {
  const form = document.querySelector('[data-location-form]');
  const detailMaps = document.querySelectorAll('[data-post-map]');
  const zones = document.querySelector('[data-zones-map]');
  function message(element, text) {
    if (element) element.textContent = text;
  }
  const formMessage = document.querySelector('#location-message');
  if (!window.L) {
    message(
      formMessage,
      'No se pudo cargar el mapa. Puedes introducir las coordenadas manualmente.',
    );
    return;
  }
  const L = window.L;
  function mapAt(element, center = [40, 0], zoom = 2) {
    const map = L.map(element, { scrollWheelZoom: false }).setView(
      center,
      zoom,
    );
    const notice = document.createElement('p');
    notice.className = 'form-text';
    notice.setAttribute('role', 'status');
    element.after(notice);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () =>
        message(
          notice,
          'No se pudo cargar el fondo del mapa. Las coordenadas y los datos del lugar siguen disponibles.',
        ),
      )
      .addTo(map);
    return map;
  }
  function icon(kind) {
    return L.divIcon({
      className: '',
      html: `<span class="location-pin ${kind === 'found' ? 'location-pin-found' : ''}">${kind === 'found' ? '✓' : '?'}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }
  function addPoint(map, lat, lng, mode, kind, label) {
    const text = document.createElement('span');
    text.textContent = label;
    const marker = L.marker([lat, lng], { icon: icon(kind), title: label })
      .addTo(map)
      .bindPopup(text);
    if (mode === 'campus')
      L.circle([lat, lng], {
        radius: 180,
        color: kind === 'found' ? '#247263' : '#9b661c',
        fillOpacity: 0.09,
      }).addTo(map);
    return marker;
  }
  // Los campos escritos permiten seleccionar un punto también sin ratón o sin mapa.
  if (form) {
    const lat = document.querySelector('#latitude');
    const lng = document.querySelector('#longitude');
    const mode = document.querySelector('#location_mode');
    const valid = () =>
      lat.value !== '' &&
      lng.value !== '' &&
      Number.isFinite(+lat.value) &&
      Number.isFinite(+lng.value) &&
      Math.abs(+lat.value) <= 85 &&
      Math.abs(+lng.value) <= 180;
    const map = mapAt(
      document.querySelector('#location-map'),
      valid() ? [+lat.value, +lng.value] : undefined,
      valid() ? 15 : 2,
    );
    let marker, circle;
    const sync = () => {
      if (marker) map.removeLayer(marker);
      if (circle) map.removeLayer(circle);
      if (!valid()) return;
      const point = [+lat.value, +lng.value];
      marker = L.marker(point, {
        draggable: true,
        title: 'Punto seleccionado',
      }).addTo(map);
      marker.on('dragend', () => select(marker.getLatLng()));
      if (mode.value === 'campus')
        circle = L.circle(point, {
          radius: 180,
          color: '#247263',
          fillOpacity: 0.1,
        }).addTo(map);
      message(
        formMessage,
        mode.value === 'campus'
          ? 'Referencia general del campus seleccionada. Comprueba que corresponde a la universidad indicada.'
          : 'Punto exacto seleccionado. Comprueba que corresponde al lugar del suceso.',
      );
    };
    const select = (point) => {
      lat.value = point.lat.toFixed(6);
      lng.value = point.lng.toFixed(6);
      sync();
    };
    map.on('click', (event) => select(event.latlng));
    [lat, lng, mode].forEach((input) => input.addEventListener('change', sync));
    document.querySelector('#center-location').addEventListener('click', () => {
      if (valid()) map.setView([+lat.value, +lng.value], 16);
      else
        message(
          formMessage,
          'Primero selecciona un punto o introduce coordenadas válidas.',
        );
    });
    document.querySelector('#use-position').addEventListener('click', () => {
      if (!navigator.geolocation)
        return message(
          formMessage,
          'Tu navegador no permite obtener la ubicación. Selecciónala manualmente.',
        );
      message(formMessage, 'Esperando permiso para consultar tu ubicación…');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          select({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          map.setView([+lat.value, +lng.value], 16);
        },
        () =>
          message(
            formMessage,
            'No se pudo obtener tu ubicación. Puedes seleccionar el punto manualmente.',
          ),
        { timeout: 10000, maximumAge: 0 },
      );
    });
    sync();
  }
  // La distinción hallazgo/depósito no depende de que se cargue el mapa.
  detailMaps.forEach((element) => {
    const map = mapAt(
      element,
      [+element.dataset.lat, +element.dataset.lng],
      15,
    );
    addPoint(
      map,
      +element.dataset.lat,
      +element.dataset.lng,
      element.dataset.mode,
      element.dataset.kind,
      element.dataset.label,
    );
  });
  if (zones) {
    const map = mapAt(zones);
    const markers = [];
    document.querySelectorAll('[data-zone-post]').forEach((card) => {
      const marker = addPoint(
        map,
        +card.dataset.lat,
        +card.dataset.lng,
        card.dataset.mode,
        card.dataset.kind,
        card.dataset.title,
      );
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = card.dataset.title;
      const place = document.createElement('p');
      place.textContent = card.dataset.place;
      const link = document.createElement('a');
      link.href = card.querySelector('h2 a').href;
      link.textContent = 'Ver publicación';
      popup.append(title, place, link);
      marker.bindPopup(popup);
      marker.on('click', () => {
        document
          .querySelectorAll('[data-zone-post]')
          .forEach((c) => c.removeAttribute('aria-current'));
        card.setAttribute('aria-current', 'true');
      });
      const button = card.querySelector('[data-show-location]');
      button.hidden = false;
      button.addEventListener('click', () => {
        map.setView(marker.getLatLng(), 16);
        marker.openPopup();
        zones.scrollIntoView({ block: 'center' });
      });
      markers.push(marker);
    });
    if (markers.length)
      map.fitBounds(L.featureGroup(markers).getBounds(), {
        padding: [30, 30],
        maxZoom: 16,
      });
  }
})();
