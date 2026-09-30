/**
 * Ejecutar con npm.cmd run check:tests:http.
 * Comprueba conjuntamente Vitest, Express y Supertest con una petición local.
 * La configuración asociada genera además el informe de cobertura.
 */
import { test, expect } from 'vitest';
import request from 'supertest';
import { createCheckApp } from './http.js';

test('el ejecutor y las peticiones HTTP funcionan', async () => {
  // Debe responder HTTP 200 a la ruta de comprobación.
  const response = await request(createCheckApp()).get('/check').expect(200);
  // Debe recibirse exactamente el JSON esperado, no solo una respuesta exitosa.
  expect(response.body).toEqual({ ok: true });
});
