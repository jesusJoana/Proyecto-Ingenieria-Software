/** Intercambios y reseñas reales con refind_test. Requiere las migraciones actuales. */
import { afterAll, describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { readConfig } from '../../src/config.js';

const { app, pool, close } = createApp(readConfig('test'));
const password = 'Una frase segura 42';
const suffix = randomUUID().slice(0, 8);
const people = ['ana', 'bea', 'cora'].map((name) => ({
  username: `ratings-${name}-${suffix}`,
  email: `ratings-${name}-${suffix}@example.test`,
  first_name: name,
  last_name: 'ReFind',
  id: null,
  agent: null,
}));
const csrfTokens = [];
const exchanges = [];

async function getCsrf(agent, path) {
  const response = await agent.get(path).expect(200);
  const token = response.text.match(/name="_csrf" value="([a-f0-9]+)"/)?.[1];
  expect(token).toBeTruthy();
  csrfTokens.push(token);
  return token;
}

async function login(person) {
  person.agent = request.agent(app);
  const csrf = await getCsrf(person.agent, '/iniciar-sesion');
  await person.agent
    .post('/iniciar-sesion')
    .type('form')
    .send({ email: person.email, password, _csrf: csrf })
    .expect(303);
}

async function completeAndReview(reviewer, recipient, rating, comment) {
  const proposalCsrf = await getCsrf(reviewer.agent, '/perfil');
  await reviewer.agent
    .post(`/u/${recipient.username}/intercambios`)
    .type('form')
    .send({ description: `Entrega ${reviewer.username}`, _csrf: proposalCsrf })
    .expect(303)
    .expect('Location', '/perfil?intercambio=solicitado');

  const {
    rows: [exchange],
  } = await pool.query(
    `SELECT id FROM object_exchanges
     WHERE giver_id = $1 AND receiver_id = $2`,
    [reviewer.id, recipient.id],
  );
  exchanges.push(exchange.id);

  const acceptCsrf = await getCsrf(recipient.agent, '/perfil');
  await recipient.agent
    .post(`/intercambios/${exchange.id}/aceptar`)
    .type('form')
    .send({ _csrf: acceptCsrf })
    .expect(303)
    .expect('Location', '/perfil?intercambio=aceptado');

  const prematureCsrf = await getCsrf(reviewer.agent, '/perfil');
  await reviewer.agent
    .post(`/intercambios/${exchange.id}/valoraciones`)
    .type('form')
    .send({ rating, comment, _csrf: prematureCsrf })
    .expect(403);

  const reviewerConfirmCsrf = await getCsrf(reviewer.agent, '/perfil');
  await reviewer.agent
    .post(`/intercambios/${exchange.id}/confirmar`)
    .type('form')
    .send({ _csrf: reviewerConfirmCsrf })
    .expect(303)
    .expect('Location', '/perfil?intercambio=confirmacion-pendiente');

  const recipientConfirmCsrf = await getCsrf(recipient.agent, '/perfil');
  await recipient.agent
    .post(`/intercambios/${exchange.id}/confirmar`)
    .type('form')
    .send({ _csrf: recipientConfirmCsrf })
    .expect(303)
    .expect('Location', '/perfil?intercambio=completado');

  const reviewCsrf = await getCsrf(reviewer.agent, '/perfil');
  await reviewer.agent
    .post(`/intercambios/${exchange.id}/valoraciones`)
    .type('form')
    .send({ rating, comment, _csrf: reviewCsrf })
    .expect(303)
    .expect('Location', '/perfil?valoracion=publicada');

  return exchange.id;
}

afterAll(async () => {
  const ids = people.map((person) => person.id).filter(Boolean);
  if (exchanges.length)
    await pool.query('DELETE FROM user_ratings WHERE exchange_id = ANY($1::bigint[])', [
      exchanges,
    ]);
  if (exchanges.length)
    await pool.query('DELETE FROM object_exchanges WHERE id = ANY($1::bigint[])', [
      exchanges,
    ]);
  await pool.query(
    `DELETE FROM session
     WHERE sess->>'userId' = ANY($1::text[])
        OR sess->>'csrfToken' = ANY($2::text[])`,
    [ids.map(String), csrfTokens],
  );
  if (ids.length)
    await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids]);
  await close();
});

describe('Intercambios y valoraciones', () => {
  test('exige confirmación mutua, calcula la media y conserva reseñas inmutables', async () => {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    for (const person of people) {
      const {
        rows: [user],
      } = await pool.query(
        `INSERT INTO users
           (username, first_name, last_name, email, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          person.username,
          person.first_name,
          person.last_name,
          person.email,
          passwordHash,
        ],
      );
      person.id = user.id;
      await login(person);
    }

    const firstExchange = await completeAndReview(
      people[0],
      people[1],
      4,
      'Entrega rápida y buena comunicación.',
    );
    const secondExchange = await completeAndReview(
      people[2],
      people[1],
      2,
      'El objeto llegó en condiciones acordadas.',
    );

    const profile = await request(app)
      .get(`/u/${people[1].username}`)
      .expect(200);
    expect(profile.text).toContain('3.0');
    expect(profile.text).toContain('Entrega rápida y buena comunicación.');
    expect(profile.text).toContain('El objeto llegó en condiciones acordadas.');
    expect(profile.text).toContain(`@${people[0].username}`);
    expect(profile.text).toContain(`@${people[2].username}`);

    const duplicateCsrf = await getCsrf(people[0].agent, '/perfil');
    await people[0].agent
      .post(`/intercambios/${firstExchange}/valoraciones`)
      .type('form')
      .send({ rating: 1, comment: 'Intento de cambio.', _csrf: duplicateCsrf })
      .expect(303)
      .expect('Location', '/perfil?valoracion=ya-enviada');

    await expect(
      pool.query('UPDATE user_ratings SET stars = 1 WHERE exchange_id = $1', [
        firstExchange,
      ]),
    ).rejects.toMatchObject({ code: '55000' });
    expect(secondExchange).not.toBe(firstExchange);
  });
});