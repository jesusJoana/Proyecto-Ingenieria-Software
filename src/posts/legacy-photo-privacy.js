import path from "node:path";

/** Impide servir fotos antiguas, incluso con escapes, barras o mayúsculas. */
export function blockLegacyPostPhotos(req, res, next) {
  let decoded;
  try {
    decoded = decodeURIComponent(req.path).replaceAll("\\", "/");
  } catch {
    return res.status(400).end();
  }
  const pathname = path.posix.normalize("/" + decoded).toLowerCase();
  if (pathname === "/uploads/posts" || pathname.startsWith("/uploads/posts/")) {
    return res.set("Cache-Control", "no-store").status(404).end();
  }
  next();
}
