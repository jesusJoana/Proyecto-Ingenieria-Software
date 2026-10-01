/**
 * Pruebas del servidor base contra la base de datos refind_test.
 * Requiere haber ejecutado antes: npm.cmd run db:migrate:test
 */
import { afterAll, describe, expect, test } from "vitest";
import request from "supertest";
import { readConfig } from "../../src/config.js";
import { createApp } from "../../src/app.js";

const { app, pool, close } = createApp(readConfig("test"));
afterAll(close);

describe("Servidor base", () => {
  /**
   * Para qué sirve: Evitar que estas pruebas trabajen sobre otra base de datos.
   * Qué comprueba: Consulta PostgreSQL y exige que la base actual se llame refind_test.
   */
  test("usa la base de datos de pruebas", async () => {
    const { rows } = await pool.query("SELECT current_database() AS db");
    expect(rows[0].db).toBe("refind_test");
  });

  /**
   * Para qué sirve: Comprobar la comunicación entre la aplicación y PostgreSQL.
   * Qué comprueba: GET /health devuelve HTTP 200 y exactamente { status: "ok" }.
   */
  test("/health responde ok cuando PostgreSQL funciona", async () => {
    await request(app).get("/health").expect(200, { status: "ok" });
  });

  /**
   * Para qué sirve: Comprobar que el servidor entrega la nueva portada y sus estilos.
   * Qué comprueba: GET / devuelve HTTP 200 y los textos de la portada; el CSS y JS de Bootstrap
   * y refind.css responden HTTP 200. No comprueba el aspecto visual.
   */
  test("la página de inicio se muestra con Bootstrap", async () => {
    const response = await request(app).get("/").expect(200);
    expect(response.text).toContain("Encuéntralo con");
    expect(response.text).toContain("Objetos recientes");
    await request(app)
      .get("/vendor/bootstrap/css/bootstrap.min.css")
      .expect(200);
    await request(app)
      .get("/vendor/bootstrap/js/bootstrap.bundle.min.js")
      .expect(200);
    await request(app).get("/css/refind.css").expect(200);
  });

  /**
   * Para qué sirve: Comprobar la respuesta ante una dirección que no existe.
   * Qué comprueba: GET /no-existe devuelve HTTP 404 y el texto Página no encontrada. No
   * inspecciona por separado la ausencia de todos los posibles detalles internos.
   */
  test("una dirección inexistente devuelve 404 sin detalles internos", async () => {
    const response = await request(app).get("/no-existe").expect(404);
    expect(response.text).toContain("Página no encontrada");
  });

  /**
   * Para qué sirve: Comprobar que la respuesta no anuncia el uso de Express.
   * Qué comprueba: GET / no incluye la cabecera X-Powered-By.
   */
  test("no revela que usa Express", async () => {
    const response = await request(app).get("/");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  /**
   * Para qué sirve: Comprobar que visitar la portada sin iniciar sesión no envía una cookie.
   * Qué comprueba: La respuesta de GET / no incluye Set-Cookie. Esta prueba no consulta si se
   * ha guardado una sesión en PostgreSQL.
   */
  test("sin sesión iniciada no crea cookie ni guarda sesión", async () => {
    const response = await request(app).get("/");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});
