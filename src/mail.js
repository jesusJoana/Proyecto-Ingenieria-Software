/**
 * Envío de correos de ReFind (de momento, solo el de recuperación de contraseña).
 *
 * Dos modos, según MAIL_MODE en el .env:
 *   console (por defecto) -> el correo se escribe en la terminal del servidor.
 *                            Es lo que se usa en desarrollo y en las pruebas.
 *   smtp                  -> se envía de verdad con nodemailer al servidor de
 *                            correo indicado (SMTP_HOST, SMTP_PORT, SMTP_USER,
 *                            SMTP_PASS y MAIL_FROM).
 *
 * El enlace se construye con APP_URL (por defecto http://localhost:<PORT>),
 * nunca con la cabecera Host de la petición: un atacante podría falsearla para
 * que el correo auténtico llevara un enlace a su propia web.
 */
import nodemailer from 'nodemailer';

export function createMailer(config, { log = console.log } = {}) {
  const appUrl = (config.APP_URL ?? `http://localhost:${config.PORT}`).replace(/\/+$/, '');
  const transport =
    config.MAIL_MODE === 'smtp'
      ? nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT ?? 587,
          secure: (config.SMTP_PORT ?? 587) === 465,
          auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
        })
      : null;

  async function send({ to, subject, text }) {
    if (transport) return transport.sendMail({ from: config.MAIL_FROM, to, subject, text });
    log(
      [
        '',
        '----- Correo (modo console: no se envía) -----',
        `Para: ${to}`,
        `Asunto: ${subject}`,
        '',
        text,
        '-----------------------------------------------',
        '',
      ].join('\n'),
    );
  }

  return {
    appUrl,
    sendPasswordReset({ to, firstName, link }) {
      return send({
        to,
        subject: 'Restablecer tu contraseña de ReFind',
        text: [
          `Hola, ${firstName}:`,
          '',
          'Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de ReFind.',
          'Para elegir una nueva, abre este enlace:',
          '',
          link,
          '',
          'El enlace vale durante 1 hora y solo se puede usar una vez.',
          'Si no has sido tú, ignora este correo: tu contraseña no cambiará.',
        ].join('\n'),
      });
    },
  };
}
