/**
 * Pruebas del servidor base contra la base de datos refind_test.
 * Requiere haber ejecutado antes: npm.cmd run db:migrate:test
 */
import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { readConfig } from '../../src/config.js';
import { createApp } from '../../src/app.js';

const { app, pool, close } = createApp(readConfig('test'));
afterAll(close);

describe('Servidor base', () => {
  test('usa la base de datos de pruebas', async () => {
    const { rows } = await pool.query('SELECT current_database() AS db');
    expect(rows[0].db).toBe('refind_test');
  });

  test('/health responde ok cuando PostgreSQL funciona', async () => {
    await request(app).get('/health').expect(200, { status: 'ok' });
  });

  test('la página de inicio se muestra con Bootstrap', async () => {
    const response = await request(app).get('/').expect(200);
    expect(response.text).toContain('<h1>ReFind</h1>');
    await request(app).get('/vendor/bootstrap/css/bootstrap.min.css').expect(200);
    await request(app).get('/vendor/bootstrap/js/bootstrap.bundle.min.js').expect(200);
    await request(app).get('/css/refind.css').expect(200);
  });

  test('una dirección inexistente devuelve 404 sin detalles internos', async () => {
    const response = await request(app).get('/no-existe').expect(404);
    expect(response.text).toContain('Página no encontrada');
  });

  test('no revela que usa Express', async () => {
    const response = await request(app).get('/');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  test('sin sesión iniciada no crea cookie ni guarda sesión', async () => {
    const response = await request(app).get('/');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
