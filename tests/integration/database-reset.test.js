import { beforeAll, afterAll, expect, test } from "vitest";
import { mkdir, writeFile, readFile, cp } from "node:fs/promises";
import path from "node:path";
import { temporaryPostgres } from "../helpers/temporary-postgres.js";
import {
  rebuildDatabase,
  applyMigrations,
  migrationDirectory,
  checkResetConnection,
  resetTarget,
} from "../../scripts/lib/database-reset.js";
import { cleanDatabaseFiles } from "../../scripts/lib/clean-database-files.js";

let pg;
beforeAll(async () => {
  pg = await temporaryPostgres();
}, 60000);
afterAll(async () => {
  await pg?.close();
}, 30000);

test("reconstruye los tres entornos desde vacío y la segunda migración no hace nada", async () => {
  for (const [mode, name] of [
    ["development", "refind_dev"],
    ["test", "refind_test"],
    ["e2e", "refind_e2e"],
  ]) {
    const result = await rebuildDatabase(pg.config(mode), name);
    expect(result.migrations).toHaveLength(12);
    expect(result.repeated).toBe(true);
    const client = await pg.client(mode);
    try {
      expect(await applyMigrations(client)).toEqual([]);
    } finally {
      await client.end();
    }
  }
}, 60000);

test("descarta datos anteriores, repite el ciclo y no modifica otro entorno ni permisos", async () => {
  const dev = await pg.client("development");
  await dev.query(
    "CREATE TABLE keep_marker(value text); INSERT INTO keep_marker VALUES ('keep')",
  );
  await dev.end();
  const client = await pg.client();
  await client.query(
    "CREATE TABLE old_marker(value text); INSERT INTO old_marker VALUES ('old')",
  );
  const { rows: before } = await client.query(
    "SELECT nspacl::text FROM pg_namespace WHERE nspname='public'",
  );
  await client.end();
  for (let cycle = 0; cycle < 2; cycle++) {
    await rebuildDatabase(pg.config(), "refind_test");
    const c = await pg.client();
    try {
      expect(
        (await c.query("SELECT to_regclass('old_marker') AS t")).rows[0].t,
      ).toBeNull();
      expect(
        (
          await c.query(
            "SELECT nspacl::text FROM pg_namespace WHERE nspname='public'",
          )
        ).rows,
      ).toEqual(before);
      await c.query(
        "CREATE TABLE old_marker(value text); INSERT INTO old_marker VALUES ('again')",
      );
    } finally {
      await c.end();
    }
  }
  const other = await pg.client("development");
  try {
    expect((await other.query("SELECT * FROM keep_marker")).rows).toEqual([
      { value: "keep" },
    ]);
  } finally {
    await other.end();
  }
}, 60000);

test("rechaza otra conexión y deja los datos intactos", async () => {
  const busy = await pg.client();
  try {
    await expect(
      rebuildDatabase(pg.config(), "refind_test"),
    ).rejects.toMatchObject({ phase: "verificación" });
    expect((await busy.query("SELECT * FROM old_marker")).rows).toEqual([
      { value: "again" },
    ]);
    await expect(
      checkResetConnection(busy, {
        ...resetTarget(pg.config(), "refind_test"),
        role: "postgres",
      }),
    ).rejects.toThrow();
  } finally {
    await busy.end();
  }
});

test("un error de migración revierte limpieza e historial; se recupera repitiendo", async () => {
  const directory = path.join(pg.root, "failing-migrations");
  await mkdir(directory);
  await cp(migrationDirectory, directory, { recursive: true });
  await writeFile(
    path.join(directory, "013_fail.js"),
    "export const up = pgm => pgm.sql('SELECT missing_reset_function()');",
  );
  await expect(
    rebuildDatabase(pg.config(), "refind_test", { dir: directory }),
  ).rejects.toMatchObject({ phase: "migraciones" });
  const c = await pg.client();
  try {
    expect((await c.query("SELECT * FROM old_marker")).rows).toEqual([
      { value: "again" },
    ]);
    expect(
      (await c.query("SELECT count(*)::int AS n FROM pgmigrations")).rows[0].n,
    ).toBe(12);
  } finally {
    await c.end();
  }
  expect(
    (await rebuildDatabase(pg.config(), "refind_test")).migrations,
  ).toHaveLength(12);
}, 60000);

test("la limpieza global protege archivos mientras otra base tenga datos", async () => {
  const root = path.join(pg.root, "project");
  const filename = path.join(root, "public/uploads/posts/old.webp");
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, "foto ficticia");
  const configs = ["development", "test", "e2e"].map((mode) => pg.config(mode));
  await expect(cleanDatabaseFiles(configs.slice(1), root)).rejects.toThrow(
    "tres entornos",
  );
  await expect(cleanDatabaseFiles(configs, root)).rejects.toThrow(
    "contiene datos",
  );
  expect(await readFile(filename, "utf8")).toBe("foto ficticia");
  for (const [mode, name] of [
    ["development", "refind_dev"],
    ["test", "refind_test"],
    ["e2e", "refind_e2e"],
  ]) {
    await rebuildDatabase(pg.config(mode), name);
  }
  expect(await cleanDatabaseFiles(configs, root)).toBe(1);
  expect(await cleanDatabaseFiles(configs, root)).toBe(0);
}, 60000);
