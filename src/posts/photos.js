/**
 * Foto opcional de las publicaciones. Mismo enfoque que los avatares:
 * multer en memoria (5 MB, una foto, JPG/PNG/WebP), comprobación y
 * conversión con sharp y nombre aleatorio .webp.
 */
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import sharp from 'sharp';

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PIXELS = 20_000_000;

const photoDirectory = fileURLToPath(
  new URL('../../public/uploads/posts/', import.meta.url),
);

function invalidPhoto() {
  return Object.assign(new Error('Formato de imagen no admitido.'), {
    code: 'INVALID_PHOTO',
  });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    if (PHOTO_TYPES.includes(file.mimetype)) return callback(null, true);
    return callback(invalidPhoto());
  },
}).single('photo');

/**
 * Lee el formulario multipart. Los errores de la foto no cortan la petición:
 * se guardan en req.photoError para mostrarlos en el formulario junto al resto.
 */
export function parsePhoto(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      req.photoError =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'La foto debe ocupar como máximo 5 MB.'
          : 'Solo puedes subir una foto.';
      return next();
    }
    if (error.code === 'INVALID_PHOTO') {
      req.photoError = 'Sube una imagen JPG, PNG o WebP.';
      return next();
    }
    return next(error);
  });
}

/** Comprueba que el archivo es una imagen real y la guarda como WebP. */
export async function savePhoto(file) {
  let image;
  try {
    image = await sharp(file.buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw invalidPhoto();
  }
  if (!['jpeg', 'png', 'webp'].includes(image.format)) throw invalidPhoto();
  const filename = `${randomUUID()}.webp`;
  const contents = await sharp(file.buffer, { limitInputPixels: MAX_PIXELS })
    .rotate()
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await mkdir(photoDirectory, { recursive: true });
  await writeFile(path.join(photoDirectory, filename), contents, { flag: 'wx' });
  return filename;
}

export async function removePhoto(filename) {
  if (!filename) return;
  try {
    await unlink(path.join(photoDirectory, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
  }
}
