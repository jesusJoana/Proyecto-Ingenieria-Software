/**
 * Configuración y envío del correo de recuperación: sin .env reales, PostgreSQL ni servidor de correo.
 * Se simula la lectura del .env (como en config.test.js) y nodemailer.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import nodemailer from 'nodemailer';
import { readConfig } from '../../src/config.js';
import { createMailer } from '../../src/mail.js';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal()),
  readFileSync: vi.fn(),
}));
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn() } }));

const base = {
  APP_ENV: 'test',
  DATABASE_URL: 'postgresql://refind_test_user:clave-ficticia@127.0.0.1:5432/refind_test',
  SESSION_SECRET: 'secreto-ficticio-'.repeat(4),
  PORT: '3002',
};
const fileWith = (values) =>
  readFileSync.mockReturnValue(
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
const smtp = {
  MAIL_MODE: 'smtp',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_USER: 'refind@example.test',
  SMTP_PASS: 'clave-ficticia-smtp',
  MAIL_FROM: 'ReFind <refind@example.test>',
};
const message = {
  to: 'ana@example.test',
  firstName: 'Ana',
  link: 'http://localhost:3002/restablecer-contrasena/' + 'a'.repeat(64),
};

beforeEach(() => vi.resetAllMocks());

describe('Configuración opcional del correo', () => {
  /** Para qué sirve: que los .env actuales del equipo sigan funcionando sin cambios.
   * Qué comprueba: sin variables de correo, readConfig no añade ningún campo nuevo. */
  test('los .env sin variables de correo siguen siendo válidos', () => {
    fileWith(base);
    expect(Object.keys(readConfig('test')).sort()).toEqual(
      ['APP_ENV', 'DATABASE_URL', 'PORT', 'SESSION_SECRET'],
    );
  });

  /** Para qué sirve: poder enviar correos reales cuando se configure un servidor SMTP.
   * Qué comprueba: acepta el modo smtp con sus datos y convierte el puerto en número. */
  test('acepta el modo smtp completo', () => {
    fileWith({ ...base, ...smtp, APP_URL: 'https://refind.example.test' });
    expect(readConfig('test')).toMatchObject({
      MAIL_MODE: 'smtp',
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: 587,
      APP_URL: 'https://refind.example.test',
    });
  });

  /** Para qué sirve: fallar al arrancar si el modo smtp está a medias, no al primer envío.
   * Qué comprueba: rechaza un modo desconocido, smtp sin servidor o sin remitente y una
   * APP_URL que no es http(s); el mensaje nombra el campo y nunca muestra valores. */
  test.each([
    [{ MAIL_MODE: 'paloma' }, 'MAIL_MODE'],
    [{ MAIL_MODE: 'smtp', MAIL_FROM: 'r@example.test' }, 'SMTP_HOST'],
    [{ MAIL_MODE: 'smtp', SMTP_HOST: 'smtp.example.test' }, 'MAIL_FROM'],
    [{ APP_URL: 'ftp://refind.example.test' }, 'APP_URL'],
  ])('rechaza %j', (extra, field) => {
    fileWith({ ...base, ...extra });
    expect(() => readConfig('test')).toThrow(field);
    try {
      readConfig('test');
    } catch (error) {
      expect(error.message).not.toContain('clave-ficticia');
    }
  });
});

describe('Envío del correo de recuperación', () => {
  /** Para qué sirve: construir el enlace sin fiarse de la cabecera Host de la petición.
   * Qué comprueba: por defecto usa http://localhost:<PORT>; con APP_URL usa esa dirección sin barra final. */
  test('la dirección base sale de la configuración', () => {
    expect(createMailer({ PORT: 3000 }).appUrl).toBe('http://localhost:3000');
    expect(createMailer({ PORT: 3000, APP_URL: 'https://refind.example.test/' }).appUrl).toBe(
      'https://refind.example.test',
    );
  });

  /** Para qué sirve: probar la recuperación en desarrollo sin servidor de correo.
   * Qué comprueba: en el modo por defecto escribe destinatario y enlace en la terminal y no usa SMTP. */
  test('en modo console escribe el correo en la terminal', async () => {
    const log = vi.fn();
    await createMailer({ PORT: 3000 }, { log }).sendPasswordReset(message);
    const printed = log.mock.calls.flat().join('\n');
    expect(printed).toContain('ana@example.test');
    expect(printed).toContain(message.link);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  /** Para qué sirve: enviar el correo de verdad cuando hay un servidor configurado.
   * Qué comprueba: crea el transporte con los datos del .env y envía asunto, destinatario y enlace. */
  test('en modo smtp envía el correo con nodemailer', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    nodemailer.createTransport.mockReturnValue({ sendMail });
    const config = { PORT: 3000, ...smtp, SMTP_PORT: 587 };
    await createMailer(config).sendPasswordReset(message);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 587,
      secure: false,
      auth: { user: 'refind@example.test', pass: 'clave-ficticia-smtp' },
    });
    const sent = sendMail.mock.calls[0][0];
    expect(sent).toMatchObject({ from: smtp.MAIL_FROM, to: 'ana@example.test' });
    expect(sent.subject).toMatch(/contraseña/i);
    expect(sent.text).toContain(message.link);
    expect(sent.text).toContain('1 hora');
  });
});
