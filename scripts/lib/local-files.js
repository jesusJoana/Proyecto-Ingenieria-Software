import { lstat, readdir, realpath, unlink } from "node:fs/promises";
import path from "node:path";

export const localFileDirectories = [
  "public/uploads/posts",
  "public/uploads/avatars",
  "storage/message-attachments",
  "storage/environments/development",
  "storage/environments/test",
  "storage/environments/e2e",
];

/** Primero valida el árbol completo; nunca sigue enlaces ni acepta rutas externas. */
export async function collectLocalFiles(root) {
  const base = await realpath(root);
  const files = [];
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      const info = await lstat(filename);
      if (info.isSymbolicLink())
        throw new Error(
          "Limpieza rechazada: enlace en una carpeta de archivos.",
        );
      if (info.isDirectory()) await inspect(filename);
      else if (info.isFile()) files.push(filename);
      else throw new Error("Limpieza rechazada: tipo de archivo inesperado.");
    }
  }
  for (const relative of localFileDirectories) {
    let current = base;
    let missing = false;
    for (const segment of relative.split("/")) {
      current = path.join(current, segment);
      const info = await lstat(current).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (!info) {
        missing = true;
        break;
      }
      if (info.isSymbolicLink() || !info.isDirectory())
        throw new Error("Ruta de archivos no permitida.");
      const resolved = await realpath(current);
      if (!resolved.startsWith(base + path.sep))
        throw new Error("Ruta fuera del proyecto.");
    }
    if (!missing) await inspect(current);
  }
  return files;
}

export async function cleanLocalFiles(root) {
  const files = await collectLocalFiles(root);
  for (const filename of files) await unlink(filename);
  return files.length;
}
