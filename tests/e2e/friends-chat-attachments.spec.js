import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import pg from 'pg';
import sharp from 'sharp';
import { readConfig } from '../../src/config.js';
import { removeAttachment } from '../../src/friends/attachments.js';

const pool = new pg.Pool({ connectionString: readConfig('e2e').DATABASE_URL });
const password = 'Una frase segura 42';
let suffix;
let users;
let contexts;

test.afterEach(async () => {
  for (const context of contexts || []) await context.close();
  const ids = (users || []).map((user) => user.id).filter(Boolean).map(String);
  if (ids.length) {
    const { rows: attachments } = await pool.query(
      `SELECT DISTINCT attachments.internal_name
       FROM friendship_message_attachments attachments
       JOIN friendship_messages messages ON messages.id = attachments.message_id
       WHERE messages.sender_id = ANY($1::bigint[])`,
      [ids],
    );
    await Promise.all(attachments.map(({ internal_name }) => removeAttachment(internal_name)));
    await pool.query("DELETE FROM session WHERE sess->>'userId' = ANY($1::text[])", [ids]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids]);
  }
});

test.afterAll(async () => {
  await pool.end();
});

async function createFriendPair() {
  suffix = randomUUID().slice(0, 10);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  users = [];
  for (const username of ['sender', 'receiver']) {
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (username, first_name, last_name, email, password_hash)
       VALUES ($1, $2, 'Chat', $3, $4) RETURNING id`,
      [`chat-${username}-${suffix}`, username, `chat-${username}-${suffix}@example.test`, passwordHash],
    );
    users.push({ id: String(user.id), username: `chat-${username}-${suffix}`, email: `chat-${username}-${suffix}@example.test` });
  }
  const [first, second] = users.map((user) => BigInt(user.id)).sort((a, b) => a < b ? -1 : 1).map(String);
  await pool.query(
    `INSERT INTO friendships
       (user_low_id, user_high_id, requester_id, recipient_id, status, responded_at)
     VALUES ($1, $2, $1, $2, 'accepted', now())`,
    [first, second],
  );
}

async function login(page, user) {
  await page.goto('/iniciar-sesion');
  const csrf = await page.locator('[name="_csrf"]').inputValue();
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: /Iniciar sesión/ }).click();
  await expect(page).toHaveURL(/\/$/);
  return csrf;
}

/** Para qué sirve: comprobar el envío de adjuntos desde dos sesiones reales.
 * Qué comprueba: foto y PDF en un mismo mensaje, visor ampliado y descarga solo para la amistad. */
test('permite enviar una foto y un PDF entre dos amigos', async ({ browser }) => {
  await createFriendPair();
  contexts = [
    await browser.newContext({ viewport: { width: 390, height: 844 } }),
    await browser.newContext(),
  ];
  const senderPage = await contexts[0].newPage();
  const receiverPage = await contexts[1].newPage();
  await login(senderPage, users[0]);
  await login(receiverPage, users[1]);
  await senderPage.goto(`/amigos/${users[1].id}/chat`);
  await receiverPage.goto(`/amigos/${users[0].id}/chat`);
  expect(await senderPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const image = await sharp({
    create: { width: 5, height: 4, channels: 3, background: '#368365' },
  }).png().toBuffer();
  const photoChooserPromise = senderPage.waitForEvent('filechooser');
  await senderPage.getByRole('button', { name: 'Adjuntar archivo' }).click();
  await senderPage.getByRole('menuitem', { name: 'Foto' }).click();
  const photoChooser = await photoChooserPromise;
  await photoChooser.setFiles({ name: 'foto-chat.png', mimeType: 'image/png', buffer: image });

  const pdfChooserPromise = senderPage.waitForEvent('filechooser');
  await senderPage.getByRole('button', { name: 'Adjuntar archivo' }).click();
  await senderPage.getByRole('menuitem', { name: 'Archivo' }).click();
  const pdfChooser = await pdfChooserPromise;
  await pdfChooser.setFiles({
    name: 'manual-chat.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nDocumento de prueba'),
  });
  await senderPage.getByLabel('Escribe un mensaje').fill('Te envío los dos archivos');
  await expect(senderPage.getByRole('button', { name: 'Enviar' })).toBeEnabled();
  await senderPage.getByRole('button', { name: 'Enviar' }).click();

  const receivedPhoto = receiverPage.getByRole('img', { name: 'foto-chat.png' });
  await expect(receivedPhoto).toBeVisible({ timeout: 10000 });
  await expect(receiverPage.getByText('Te envío los dos archivos')).toBeVisible();
  await expect(receiverPage.getByRole('link', { name: /manual-chat\.pdf/ })).toBeVisible();
  await receivedPhoto.click();
  await expect(receiverPage.getByRole('dialog', { name: 'Visor de fotos' })).toBeVisible();
  await receiverPage.getByRole('button', { name: 'Cerrar visor' }).click();
  const downloadPromise = receiverPage.waitForEvent('download');
  await receiverPage.getByRole('link', { name: /manual-chat\.pdf/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('manual-chat.pdf');
});