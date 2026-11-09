/* Solo referencias de campus redondeadas; no geolocalización ni puntos exactos. */
(() => {
  if (!window.L) return;
  const L = window.L;
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
      marker = L.circle(point, { radius: 700 }).addTo(map);
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
      points = [];
    for (const item of document.querySelectorAll("[data-map-point]")) {
      const point = [+item.dataset.lat, +item.dataset.lng];
      if (!point.every(Number.isFinite)) continue;
      points.push(point);
      const label = document.createElement("span");
      label.textContent = item.dataset.title;
      L.circle(point, { radius: 700 }).addTo(map).bindPopup(label);
    }
    if (points.length)
      map.fitBounds(points, { padding: [30, 30], maxZoom: 13 });
  }
})();
