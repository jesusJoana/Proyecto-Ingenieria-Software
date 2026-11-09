import path from "node:path";
export function protectAvatars(pool) {
  return async (req, res, next) => {
    let pathname;
    try {
      pathname = path.posix
        .normalize("/" + decodeURIComponent(req.path).replaceAll("\\", "/"))
        .split("/")
        .map((part) => part.replace(/[ .]+$/g, ""))
        .join("/")
        .toLowerCase();
    } catch {
      return res.status(400).end();
    }
    if (
      pathname !== "/uploads/avatars" &&
      !pathname.startsWith("/uploads/avatars/")
    )
      return next();
    res.set("Cache-Control", "private, no-store");
    const filename = pathname.slice("/uploads/avatars/".length);
    if (
      !req.session?.userId ||
      !/^\w{8}(-\w{4}){3}-\w{12}\.webp$/.test(filename)
    )
      return res.status(404).end();
    const found = await pool.query(
      "SELECT 1 FROM users WHERE id=$1 AND avatar_filename=$2",
      [req.session.userId, filename],
    );
    if (!found.rowCount) return res.status(404).end();
    next();
  };
}
