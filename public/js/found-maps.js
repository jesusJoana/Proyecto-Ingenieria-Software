/* Solo referencias de campus redondeadas; no geolocalización ni puntos exactos. */
(() => {
  if (!window.L) return;
  const L = window.L;
  // Redondear a 0,01° desplaza hasta ~790 m en diagonal; 800 m garantiza que el círculo contiene el punto.
  const RADIUS = 800;
  function create(element) {
    const m = L.map(element, { scrollWheelZoom: false }).setView([40, 0], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 16,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);
    return m;
  }
  const picker = document.querySelector("[data-campus-picker]");
  if (picker) {
    const map = create(picker),
      lat = document.querySelector("#campus_latitude"),
      lng = document.querySelector("#campus_longitude");
    let marker;
    const sync = () => {
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      if (
        lat.value === "" ||
        lng.value === "" ||
        !Number.isFinite(+lat.value) ||
        !Number.isFinite(+lng.value) ||
        Math.abs(+lat.value) > 85 ||
        Math.abs(+lng.value) > 180
      )
        return;
      const point = [
        Math.round(+lat.value * 100) / 100,
        Math.round(+lng.value * 100) / 100,
      ];
      marker = L.circle(point, { radius: RADIUS }).addTo(map);
      map.setView(point, 13);
    };
    map.on("click", (e) => {
      lat.value = (Math.round(e.latlng.lat * 100) / 100).toFixed(2);
      lng.value = (Math.round(e.latlng.lng * 100) / 100).toFixed(2);
      sync();
    });
    lat.addEventListener("change", sync);
    lng.addEventListener("change", sync);
    document
      .querySelector("[data-clear-campus]")
      .addEventListener("click", () => {
        lat.value = "";
        lng.value = "";
        sync();
      });
    picker.closest("details").addEventListener("toggle", () => {
      map.invalidateSize();
      sync();
    });
    sync();
  }
  for (const element of document.querySelectorAll("[data-found-map]")) {
    const map = create(element),
      groups = new Map();
    // Los hallazgos del mismo campus comparten referencia redondeada: un solo círculo con todos ellos.
    for (const item of document.querySelectorAll("[data-map-point]")) {
      const point = [+item.dataset.lat, +item.dataset.lng];
      if (!point.every(Number.isFinite)) continue;
      const key = point.join(",");
      if (!groups.has(key)) groups.set(key, { point, items: [] });
      groups.get(key).items.push(item.dataset);
    }
    const points = [];
    for (const { point, items } of groups.values()) {
      points.push(point);
      const content = document.createElement("div");
      if (items.length > 1) {
        const heading = document.createElement("strong");
        heading.textContent = `${items.length} hallazgos en esta zona`;
        content.append(heading);
      }
      const list = document.createElement(items.length > 1 ? "ul" : "div");
      if (items.length > 1) list.className = "map-popup-list";
      for (const { title, url } of items) {
        const entry = document.createElement(items.length > 1 ? "li" : "span");
        const label = document.createElement(url ? "a" : "span");
        label.textContent = title;
        if (url) label.href = url;
        entry.append(label);
        list.append(entry);
      }
      content.append(list);
      L.circle(point, { radius: RADIUS }).addTo(map).bindPopup(content);
    }
    if (points.length)
      map.fitBounds(points, { padding: [30, 30], maxZoom: 13 });
  }
})();
