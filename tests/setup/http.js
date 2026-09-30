/** Aplicación mínima de comprobación; no implementa funcionalidades de ReFind.
 * Supertest la utiliza sin necesitar un servidor del producto ni PostgreSQL.
 */
import express from 'express';

/** Crea una aplicación nueva con una respuesta conocida para verificar HTTP y JSON. */
export function createCheckApp() {
  const app = express();
  app.get('/check', (req, res) => res.json({ ok: true }));
  return app;
}
