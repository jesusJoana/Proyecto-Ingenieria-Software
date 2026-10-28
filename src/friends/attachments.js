import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
export const MAX_UPLOAD_BYTES = MAX_FILE_BYTES * MAX_ATTACHMENTS;
export const ATTACHMENT_DIRECTORY = path.resolve(
  process.env.REFIND_PRIVATE_UPLOADS_DIR ||
    fileURLToPath(new URL('../../storage/message-attachments/', import.meta.url)),
);

const allowedTypes = {
  jpg: { kind: 'photo', mime: 'image/jpeg', format: 'jpeg' },
  jpeg: { kind: 'photo', mime: 'image/jpeg', format: 'jpeg' },
  png: { kind: 'photo', mime: 'image/png', format: 'png' },
  webp: { kind: 'photo', mime: 'image/webp', format: 'webp' },
  gif: { kind: 'photo', mime: 'image/gif', format: 'gif' },
  pdf: { kind: 'file', mime: 'application/pdf', signature: 'pdf' },
  doc: { kind: 'file', mime: 'application/msword', signature: 'ole' },
  xls: { kind: 'file', mime: 'application/vnd.ms-excel', signature: 'ole' },
  ppt: { kind: 'file', mime: 'application/vnd.ms-powerpoint', signature: 'ole' },
  docx: {
    kind: 'file',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signature: 'zip',
  },
  xlsx: {
    kind: 'file',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signature: 'zip',
  },
  pptx: {
    kind: 'file',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    signature: 'zip',
  },
  txt: { kind: 'file', mime: 'text/plain', signature: 'text' },
  csv: { kind: 'file', mime: 'text/csv', alternateMimes: ['application/vnd.ms-excel'], signature: 'text' },
  zip: { kind: 'file', mime: 'application/zip', alternateMimes: ['application/x-zip-compressed'], signature: 'zip' },
};

export class AttachmentError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.name = 'AttachmentError';
    this.status = status;
  }
}

export function safeOriginalName(name) {
  return path
    .basename(String(name || 'archivo').replaceAll('\\', '/'))
    .replace(/[\u0000-\u001f\u007f"\\/]/g, '_')
    .slice(0, 180) || 'archivo';
}

function fileType(file) {
  const extension = path.extname(safeOriginalName(file.originalname)).slice(1).toLowerCase();
  const type = allowedTypes[extension];
  if (!type) throw new AttachmentError('Tipo de archivo no permitido.');
  if (![type.mime, ...(type.alternateMimes || [])].includes(file.mimetype))
    throw new AttachmentError('El tipo MIME no coincide con la extensión del archivo.');
  const limit = type.kind === 'photo' ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (file.size > limit)
    throw new AttachmentError(
      type.kind === 'photo' ? 'La imagen supera el límite de 10 MB.' : 'El archivo supera el límite de 20 MB.',
    );
  return { ...type, extension };
}

function hasSignature(buffer, signature) {
  if (signature === 'pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (signature === 'ole')
    return buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  if (signature === 'zip')
    return ['504b0304', '504b0506', '504b0708'].includes(buffer.subarray(0, 4).toString('hex'));
  if (signature === 'text') {
    const text = buffer.toString('utf8');
    if (text.includes('\uFFFD') || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return false;
    return !/<\s*(?:!doctype\s+html|html|script|svg|iframe|object|embed)\b/i.test(text);
  }
  return false;
}

export async function validateAttachment(file) {
  const type = fileType(file);
  if (type.kind === 'photo') {
    let metadata;
    try {
      metadata = await sharp(file.buffer, { limitInputPixels: 40_000_000 }).metadata();
    } catch {
      throw new AttachmentError('El contenido no es una imagen válida.');
    }
    if (metadata.format !== type.format)
      throw new AttachmentError('El contenido de la imagen no coincide con su extensión.');
  } else if (!hasSignature(file.buffer, type.signature)) {
    throw new AttachmentError('El contenido no coincide con el tipo de archivo declarado.');
  }
  return { ...type, originalName: safeOriginalName(file.originalname) };
}

export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_ATTACHMENTS, fieldSize: 2048 },
  fileFilter(req, file, callback) {
    try {
      fileType({ ...file, size: 0 });
      return callback(null, true);
    } catch (error) {
      return callback(error);
    }
  },
}).array('attachments', MAX_ATTACHMENTS);

export function parseAttachments(req, res, next) {
  attachmentUpload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el límite permitido de 20 MB.'
        : error.code === 'LIMIT_FILE_COUNT'
          ? 'Puedes adjuntar como máximo 5 elementos.'
          : 'No se pudieron leer los adjuntos.';
      return res.status(422).json({ error: message });
    }
    if (error instanceof AttachmentError)
      return res.status(error.status).json({ error: error.message });
    return next(error);
  });
}

export async function saveAttachment(file) {
  const internalName = randomUUID();
  await mkdir(ATTACHMENT_DIRECTORY, { recursive: true });
  await writeFile(path.join(ATTACHMENT_DIRECTORY, internalName), file.buffer, { flag: 'wx' });
  if (file.mimetype.startsWith('image/')) {
    try {
      await sharp(file.buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(ATTACHMENT_DIRECTORY, `${internalName}.thumb.webp`));
    } catch (error) {
      await removeAttachment(internalName);
      throw error;
    }
  }
  return internalName;
}

export async function removeAttachment(internalName) {
  const safeName = path.basename(internalName);
  await Promise.all([
    safeName,
    `${safeName}.thumb.webp`,
  ].map(async (filename) => {
    try {
      await unlink(path.join(ATTACHMENT_DIRECTORY, filename));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }));
}