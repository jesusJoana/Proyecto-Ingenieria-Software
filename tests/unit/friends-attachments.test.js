import { describe, expect, test } from 'vitest';
import sharp from 'sharp';
import {
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  safeOriginalName,
  validateAttachment,
} from '../../src/friends/attachments.js';

describe('adjuntos del chat', () => {
  test('acepta foto por contenido real y aplica límites centralizados', async () => {
    const buffer = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
      .jpeg()
      .toBuffer();
    await expect(validateAttachment({
      originalname: 'foto.jpg',
      mimetype: 'image/jpeg',
      size: buffer.length,
      buffer,
    })).resolves.toMatchObject({ kind: 'photo', mime: 'image/jpeg' });
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_FILE_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_ATTACHMENTS).toBe(5);
  });

  test('rechaza extensión, MIME y contenido no permitidos', async () => {
    await expect(validateAttachment({
      originalname: 'payload.svg',
      mimetype: 'image/svg+xml',
      size: 10,
      buffer: Buffer.from('<svg/>'),
    })).rejects.toThrow('Tipo de archivo no permitido');
    await expect(validateAttachment({
      originalname: 'foto.jpg',
      mimetype: 'image/png',
      size: 10,
      buffer: Buffer.from('not an image'),
    })).rejects.toThrow('El tipo MIME no coincide');
    await expect(validateAttachment({
      originalname: 'nota.pdf',
      mimetype: 'application/pdf',
      size: 10,
      buffer: Buffer.from('<html>'),
    })).rejects.toThrow('El contenido no coincide');
  });

  test('rechaza archivos grandes y sanea nombres originales', async () => {
    await expect(validateAttachment({
      originalname: 'foto.jpg',
      mimetype: 'image/jpeg',
      size: MAX_IMAGE_BYTES + 1,
      buffer: Buffer.alloc(0),
    })).rejects.toThrow('supera el límite de 10 MB');
    expect(safeOriginalName('../inseguro\n.txt')).toBe('inseguro_.txt');
  });

  test('rechaza un archivo que supera los 20 MB', async () => {
    await expect(validateAttachment({
      originalname: 'manual.pdf',
      mimetype: 'application/pdf',
      size: MAX_FILE_BYTES + 1,
      buffer: Buffer.from('%PDF-1.7'),
    })).rejects.toThrow('supera el límite de 20 MB');
  });
});