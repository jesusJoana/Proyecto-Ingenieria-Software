/* Captura puntual. Las coordenadas privadas nunca alimentan el mapa público. */
(() => {
  for (const section of document.querySelectorAll("[data-private-location]")) {
    const lat = section.querySelector("[data-private-lat]"),
      lng = section.querySelector("[data-private-lng]");
    const accuracy = section.querySelector("[data-private-accuracy]");
    const description = section.querySelector("[data-location-description]");
    const status = section.querySelector("[data-location-status]");
    const addressStatus = section.querySelector("[data-address-status]");
    const button = section.querySelector("[data-locate]");
    const element = section.querySelector("[data-private-map]");
    const form = section.closest("form");
    const campusLat = form.querySelector("#campus_latitude"),
      campusLng = form.querySelector("#campus_longitude");
    let map,
      marker,
      circle,
      revision = 0,
      request,
      addressTimer,
      geocoderAvailable = true,
      autoDescription = null;
    const message = (text) => {
      status.textContent = text;
    };
    const invalidate = () => {
      revision++;
      request?.abort();
      clearTimeout(addressTimer);
      button.disabled = false;
    };
    const campusPoint = () =>
      campusLat?.value && campusLng?.value
        ? [+campusLat.value, +campusLng.value]
        : null;
    // El servidor genera la referencia pública desde el punto del hallazgo si el campus queda vacío.
    const publicNotice = () =>
      section.dataset.prefix === "found" && !campusPoint()
        ? " Como no has indicado referencia del campus, se publicará una aproximada (unos 1 km) a partir de este punto; nunca el punto exacto."
        : "";
    async function address(version) {
      if (!geocoderAvailable) return;
      request?.abort();
      request = new AbortController();
      const originalText = description.value;
      addressStatus.textContent = "Buscando una dirección orientativa…";
      try {
        const response = await fetch("/publicaciones/ubicacion/direccion", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            _csrf: form.elements._csrf.value,
            latitude: lat.value,
            longitude: lng.value,
          }),
          signal: request.signal,
        });
        if (!response.ok) throw new Error("Dirección no disponible");
        const data = await response.json();
        if (data.available === false) {
          geocoderAvailable = false;
          addressStatus.textContent = "";
          return;
        }
        if (version !== revision || description.value !== originalText) return;
        if (data.address && !originalText) {
          description.value = data.address;
          autoDescription = data.address;
        }
        addressStatus.textContent = data.address
          ? "Revisa la dirección y corrígela si es necesario."
          : "No se ha podido identificar la dirección. Puedes escribir el lugar y continuar.";
      } catch {
        if (version === revision)
          addressStatus.textContent =
            "No se ha podido identificar la dirección. Puedes escribir el lugar y continuar.";
      }
    }
    function display(recenter = true) {
      if (!window.L) {
        message(
          "El mapa no está disponible. Puedes escribir el lugar manualmente.",
        );
        return;
      }
      element.hidden = false;
      if (!map) {
        const campus = campusPoint();
        map = L.map(element, { scrollWheelZoom: false }).setView(
          campus ?? [40, -3],
          campus ? 15 : 5,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
        map.on("click", (e) => select(e.latlng.lat, e.latlng.lng));
      }
      map.invalidateSize();
      if (lat.value === "" || lng.value === "") return;
      const point = [+lat.value, +lng.value];
      if (marker) marker.setLatLng(point);
      else {
        marker = L.marker(point, { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          select(p.lat, p.lng);
        });
      }
      if (circle) {
        circle.remove();
        circle = null;
      }
      if (accuracy.value !== "")
        circle = L.circle(point, { radius: +accuracy.value }).addTo(map);
      // Un ajuste manual conserva el zoom elegido; una captura nueva acerca al punto.
      if (recenter) map.setView(point, 17);
      else map.panTo(point);
    }
    function select(latitude, longitude, precision = "") {
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180
      )
        return;
      invalidate();
      if (autoDescription !== null && description.value === autoDescription)
        description.value = "";
      autoDescription = null;
      lat.value = latitude.toFixed(7);
      lng.value = longitude.toFixed(7);
      accuracy.value = precision === "" ? "" : String(precision);
      const poor = precision !== "" && precision > 100;
      const manual = precision === "";
      message(
        (poor
          ? `Precisión baja: aproximadamente ${Math.ceil(precision)} metros. Corrige el punto o escribe el lugar antes de publicar.`
          : manual
            ? "Punto ajustado manualmente. ¿El objeto está aquí? Puedes completar la descripción."
            : `Precisión estimada: ${Math.ceil(precision)} metros. ¿El objeto está aquí? Puedes mover el marcador o corregir el lugar.`) +
          publicNotice(),
      );
      display(!manual);
      // Una corrección nunca sustituye texto que el usuario ya ha escrito.
      // Los ajustes manuales esperan a que el marcador se detenga para no saturar el proveedor.
      const version = revision;
      addressTimer = setTimeout(() => void address(version), manual ? 600 : 0);
    }
    button.addEventListener("click", () => {
      invalidate();
      if (!window.isSecureContext || !navigator.geolocation) {
        message(
          "La ubicación automática no está disponible. Usa una conexión segura o introduce el lugar manualmente.",
        );
        return;
      }
      const version = revision;
      button.disabled = true;
      message("Obteniendo tu ubicación…");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (version !== revision) return;
          if (
            ![
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy,
            ].every(Number.isFinite) ||
            Math.abs(position.coords.latitude) > 90 ||
            Math.abs(position.coords.longitude) > 180 ||
            position.coords.accuracy < 0 ||
            position.coords.accuracy > 40075000
          ) {
            button.disabled = false;
            message(
              "No se ha obtenido una ubicación válida. Puedes indicar el lugar manualmente.",
            );
            return;
          }
          select(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
          );
        },
        (error) => {
          if (version !== revision) return;
          button.disabled = false;
          message(
            error.code === 1
              ? "Permiso de ubicación denegado. Puedes indicar el lugar manualmente."
              : error.code === 3
                ? "La localización ha tardado demasiado. Inténtalo de nuevo o indica el lugar manualmente."
                : "No se ha podido obtener la ubicación. Puedes indicar el lugar manualmente.",
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
    section
      .querySelector("[data-manual-location]")
      .addEventListener("click", () => {
        invalidate();
        display();
        description.focus();
        message(
          "Pulsa en el mapa, mueve el marcador o escribe el lugar. No necesitas indicar coordenadas.",
        );
      });
    section
      .querySelector("[data-clear-location]")
      .addEventListener("click", () => {
        invalidate();
        lat.value = "";
        lng.value = "";
        accuracy.value = "";
        addressStatus.textContent = "";
        marker?.remove();
        circle?.remove();
        marker = circle = null;
        message(
          "Punto eliminado. Puedes conservar o cambiar la descripción escrita.",
        );
      });
    description.addEventListener("input", () => {
      request?.abort();
      autoDescription = null;
      addressStatus.textContent = "";
    });
    if (lat.value !== "" && lng.value !== "") {
      display();
      message("Ubicación guardada. Puedes actualizarla o escribir el lugar.");
    }
  }
})();
