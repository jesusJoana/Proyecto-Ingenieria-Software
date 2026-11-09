import multer from "multer";
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
export const MAX_BYTES = 5 * 1024 * 1024,
  MAX_FILES = 3;
export class AttachmentError extends Error {}
const types = {
  ".jpg": ["image/jpeg", "jpeg"],
  ".jpeg": ["image/jpeg", "jpeg"],
  ".png": ["image/png", "png"],
  ".webp": ["image/webp", "webp"],
  ".pdf": ["application/pdf", "pdf"],
};
export function attachmentDirectory(mode) {
  if (!["development", "test", "e2e"].includes(mode))
    throw new Error("Entorno no válido.");
  return fileURLToPath(
    new URL(`../../storage/environments/${mode}/claims/`, import.meta.url),
  );
}
export function attachmentPath(key, mode) {
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(key))
    throw new AttachmentError("Archivo no válido.");
  return path.join(attachmentDirectory(mode), key);
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_FILES,
    fileSize: MAX_BYTES,
    fields: 12,
    fieldSize: 10000,
  },
}).array("attachments", MAX_FILES);
export function parseAttachments(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      if (!(error instanceof multer.MulterError)) return next(error);
      req.attachmentError =
        error.code === "LIMIT_FILE_SIZE"
          ? "Cada archivo admite hasta 5 MB."
          : "Adjunta como máximo tres archivos y respeta los límites del formulario.";
    }
    next();
  });
}
export async function validateAttachment(file) {
  const name =
    path
      .basename(file.originalname.replaceAll("\\", "/"))
      .replace(/[\x00-\x1f\x7f"<>]/g, "_")
      .slice(0, 160) || "archivo";
  const type = types[path.extname(name).toLowerCase()];
  if (!type || type[0] !== file.mimetype)
    throw new AttachmentError(
      "Solo se admiten JPG, PNG, WebP y PDF con su formato correcto.",
    );
  if (!file.buffer.length || file.buffer.length > MAX_BYTES)
    throw new AttachmentError(
      "Cada archivo debe contener datos y ocupar como máximo 5 MB.",
    );
  if (type[1] === "pdf") {
    if (
      !/^%PDF-1\.[0-9]|^%PDF-2\.0/.test(
        file.buffer.subarray(0, 8).toString("ascii"),
      ) ||
      !file.buffer.subarray(-1024).toString("ascii").includes("%%EOF")
    )
      throw new AttachmentError(
        "El archivo no tiene una estructura PDF reconocible.",
      );
    return {
      buffer: file.buffer,
      original_name: name,
      mime_type: "application/pdf",
    };
  }
  try {
    const meta = await sharp(file.buffer, {
      limitInputPixels: 20_000_000,
    }).metadata();
    if (meta.format !== type[1]) throw new Error("Formato");
    const buffer = await sharp(file.buffer, { limitInputPixels: 20_000_000 })
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return {
      buffer,
      original_name: name.replace(/\.[^.]+$/, ".webp"),
      mime_type: "image/webp",
    };
  } catch {
    throw new AttachmentError(
      "La imagen no es válida o supera 20 megapíxeles.",
    );
  }
}
export async function removeAttachments(files, mode) {
  await Promise.all(
    files.map((f) =>
      unlink(attachmentPath(f.storage_key, mode)).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      }),
    ),
  );
}
export async function saveAttachments(files = [], mode) {
  if (files.length > MAX_FILES)
    throw new AttachmentError("Adjunta como máximo tres archivos.");
  const validated = await Promise.all(files.map(validateAttachment)),
    saved = [];
  try {
    if (validated.length)
      await mkdir(attachmentDirectory(mode), { recursive: true });
    for (const f of validated) {
      const item = {
        storage_key: randomUUID(),
        original_name: f.original_name,
        mime_type: f.mime_type,
        byte_size: f.buffer.length,
      };
      saved.push(item);
      await writeFile(attachmentPath(item.storage_key, mode), f.buffer, {
        flag: "wx",
      });
    }
    return saved;
  } catch (e) {
    await removeAttachments(saved, mode);
    throw e;
  }
}
