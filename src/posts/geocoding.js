/** Instancia Nominatim propia o proveedor autorizado; sin coordenadas en logs ni caché persistente. */
export function createReverseGeocoder(
  endpoint,
  { fetcher = fetch, now = Date.now } = {},
) {
  let nextRequest = 0;
  return async (latitude, longitude) => {
    if (!endpoint || now() < nextRequest) return null;
    nextRequest = now() + 1100;
    try {
      const url = new URL(endpoint);
      url.search = new URLSearchParams({
        format: "jsonv2",
        lat: String(latitude),
        lon: String(longitude),
        "accept-language": "es",
      }).toString();
      const response = await fetcher(url, {
        headers: {
          "User-Agent": "ReFind/1.0 (private object location)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(4000),
        redirect: "error",
      });
      if (!response.ok) return null;
      const data = await response.json();
      return typeof data.display_name === "string"
        ? data.display_name.slice(0, 250)
        : null;
    } catch {
      return null;
    }
  };
}
