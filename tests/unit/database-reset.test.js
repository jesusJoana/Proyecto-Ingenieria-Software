import { afterEach, describe, expect, test } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import {
  resetTarget,
  parseResetArguments,
} from "../../scripts/lib/database-reset.js";
import {
  cleanLocalFiles,
  collectLocalFiles,
} from "../../scripts/lib/local-files.js";
import { blockLegacyPostPhotos } from "../../src/posts/legacy-photo-privacy.js";

const roots = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(root) !== tmpdir() ||
      !path.basename(root).startsWith("refind-files-")
    )
      throw new Error("Ruta inesperada");
    await rm(root, { recursive: true, force: true });
  }
});
const config = {
  APP_ENV: "test",
  DATABASE_URL: "postgresql://refind_test_user:fake@127.0.0.1:5433/refind_test",
};
describe("destino del reinicio", () => {
  test("exige entorno explícito y confirmación de la base", () => {
    expect(resetTarget(config, "refind_test").database).toBe("refind_test");
    expect(parseResetArguments(["test", "--confirm", "refind_test"]).mode).toBe(
      "test",
    );
    for (const args of [
      [],
      ["test"],
      ["production", "--confirm", "refind_test"],
      ["test", "--confirm", "refind_test", "extra"],
    ]) {
      expect(() => parseResetArguments(args)).toThrow();
    }
    expect(() => resetTarget(config, "refind_dev")).toThrow();
  });
  test.each([
    "postgresql://refind_test_user:fake@remote:5433/refind_test",
    "postgresql://refind_dev_user:fake@127.0.0.1:5433/refind_test",
    "postgresql://refind_test_user:fake@127.0.0.1:5433/refind_dev",
    config.DATABASE_URL + "?host=remote",
    config.DATABASE_URL + "#other",
    "not-a-url",
  ])("rechaza destino alterado sin conectar: %s", (url) => {
    expect(() =>
      resetTarget({ ...config, DATABASE_URL: url }, "refind_test"),
    ).toThrow();
  });
});

test("limpia solo archivos previstos y conserva archivos ajenos y directorios", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "refind-files-"));
  roots.push(root);
  await mkdir(path.join(root, "public/uploads/posts"), { recursive: true });
  await writeFile(path.join(root, "public/uploads/posts/old.webp"), "fake");
  await writeFile(path.join(root, "public/keep.txt"), "keep");
  expect(await cleanLocalFiles(root)).toBe(1);
  expect(await collectLocalFiles(root)).toEqual([]);
  expect(await readFile(path.join(root, "public/keep.txt"), "utf8")).toBe(
    "keep",
  );
  expect(await cleanLocalFiles(root)).toBe(0);
});

test("rechaza una junction antes de borrar cualquier archivo", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "refind-files-"));
  roots.push(root);
  await mkdir(path.join(root, "public/uploads/posts"), { recursive: true });
  await mkdir(path.join(root, "outside"));
  await writeFile(path.join(root, "public/uploads/posts/keep.webp"), "keep");
  await symlink(
    path.join(root, "outside"),
    path.join(root, "public/uploads/avatars"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await expect(cleanLocalFiles(root)).rejects.toThrow();
  expect(
    await readFile(path.join(root, "public/uploads/posts/keep.webp"), "utf8"),
  ).toBe("keep");
});

test.each([
  "/uploads/posts/a.webp",
  "/UPLOADS/POSTS/a.webp",
  "/uploads/%70osts/a.webp",
  "/uploads%2fposts/a.webp",
  "/uploads/%2e/posts/a.webp",
  "/uploads%5cposts/a.webp",
])("foto antigua bloqueada aun existiendo: %s", async (url) => {
  const app = express();
  app.use(blockLegacyPostPhotos);
  app.use((req, res) => res.send("foto"));
  await request(app).get(url).expect(404);
});
