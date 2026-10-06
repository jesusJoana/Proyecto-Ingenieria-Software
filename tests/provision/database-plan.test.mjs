import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEnvironments,
  assertInstance,
  roleStatements,
} from "../../scripts/provision/windows/database-plan.mjs";
const secrets = {
  dev: "a".repeat(64),
  test: "b".repeat(64),
  e2e: "c".repeat(64),
  "session-development": "d".repeat(64),
  "session-test": "e".repeat(64),
  "session-e2e": "f".repeat(64),
};
// Para que: impedir que una URL de pruebas apunte a desarrollo.
// Comprueba: base, rol, puerto y secreto distintos para los tres entornos.
test("genera tres conexiones aisladas compatibles con config.js", () => {
  const envs = buildEnvironments(secrets);
  assert.equal(envs.length, 3);
  assert.equal(new Set(envs.map((e) => e.url)).size, 3);
  assert.deepEqual(
    envs.map((e) => e.port),
    [3000, 3002, 3001],
  );
  for (const e of envs) {
    const u = new URL(e.url);
    assert.equal(u.username, e.role);
    assert.equal(u.pathname, "/" + e.database);
    assert.equal(u.port, "5433");
    assert.equal(e.secret.length, 64);
  }
});
// Para que: fallar antes de crear archivos/roles con claves invalidas.
test("rechaza secretos ausentes, repetidos o no generados", () => {
  assert.throws(() => buildEnvironments({}));
  assert.throws(() => buildEnvironments({ ...secrets, test: secrets.dev }));
  assert.throws(() =>
    buildEnvironments({ ...secrets, dev: "'; DROP ROLE postgres;--" }),
  );
});
// Para que: no aplicar preparacion a una instalacion ajena.
test("exige version, puerto, nombre y carpeta de la instancia", () => {
  const good = {
    version: "170011",
    port: 5433,
    cluster: "refind-local",
    data: "C:/ReFind/datos/postgresql17",
  };
  assertInstance(good, "C:\\ReFind\\datos\\postgresql17");
  for (const bad of [
    { version: "180000" },
    { port: 5432 },
    { cluster: "otra" },
    { data: "C:/otro" },
  ])
    assert.throws(() => assertInstance({ ...good, ...bad }, good.data));
});
// Para que: no interpolar identificadores o claves arbitrarios en DDL.
test("DDL limitado a los roles ReFind con contrasenas hexadecimales", () => {
  const sql = roleStatements("refind_dev_user", "a".repeat(64));
  assert.match(sql, /NOSUPERUSER NOCREATEDB NOCREATEROLE/);
  assert.throws(() => roleStatements("postgres", "a".repeat(64)));
  assert.throws(() => roleStatements("refind_dev_user", "x';"));
});
