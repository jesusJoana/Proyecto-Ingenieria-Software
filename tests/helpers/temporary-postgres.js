/** PostgreSQL aislado: nunca lee .env ni conecta a las bases del desarrollador. */
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { randomBytes } from "node:crypto";
import pg from "pg";

const execute = promisify(execFile);
export async function temporaryPostgres() {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(path.join(parent, "refind-i04-"));
  const bin =
    process.env.REFIND_PG_BIN ||
    (process.platform === "win32" ? "C:/ReFind/PostgreSQL/17/bin" : "");
  const executable = (name) =>
    bin
      ? path.join(bin, name + (process.platform === "win32" ? ".exe" : ""))
      : name;
  // pg_ctl inicia un proceso duradero: no heredar las tuberías del runner.
  const control = (args) =>
    new Promise((resolve, reject) => {
      const process = spawn(executable("pg_ctl"), args, {
        windowsHide: true,
        stdio: "ignore",
      });
      process.once("error", reject);
      process.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`pg_ctl terminó con código ${code}`)),
      );
    });
  const data = path.join(root, "data");
  const password = randomBytes(24).toString("hex");
  const passwordFile = path.join(root, "password");
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const p = server.address().port;
      server.close(() => resolve(p));
    });
  });
  let started = false;
  async function close() {
    // Solo se elimina la carpeta creada por mkdtemp dentro de la carpeta temporal.
    const resolved = await realpath(root);
    if (
      path.dirname(resolved) !== parent ||
      !path.basename(resolved).startsWith("refind-i04-")
    ) {
      throw new Error("Ruta temporal de PostgreSQL inesperada.");
    }
    if (started) {
      await control(["-D", data, "-m", "immediate", "-w", "stop"]);
      started = false;
    }
    await rm(root, { recursive: true, force: true });
  }
  try {
    await writeFile(passwordFile, password, { mode: 0o600 });
    await execute(
      executable("initdb"),
      [
        "-D",
        data,
        "-U",
        "postgres",
        "--encoding=UTF8",
        "--locale=C",
        "--auth=scram-sha-256",
        `--pwfile=${passwordFile}`,
      ],
      { windowsHide: true },
    );
    await control([
      "-D",
      data,
      "-l",
      path.join(root, "server.log"),
      "-o",
      `-h 127.0.0.1 -p ${port}`,
      "-w",
      "start",
    ]);
    started = true;
    const admin = new pg.Client({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "postgres",
    });
    await admin.connect();
    try {
      for (const suffix of ["dev", "test", "e2e"]) {
        await admin.query(
          `CREATE ROLE refind_${suffix}_user LOGIN PASSWORD '${password}'`,
        );
        await admin.query(
          `CREATE DATABASE refind_${suffix} OWNER refind_${suffix}_user`,
        );
        await admin.query(
          `REVOKE ALL ON DATABASE refind_${suffix} FROM PUBLIC`,
        );
        await admin.query(
          `GRANT CONNECT,TEMPORARY ON DATABASE refind_${suffix} TO refind_${suffix}_user`,
        );
      }
    } finally {
      await admin.end();
    }
    return {
      root,
      close,
      config(mode = "test") {
        const suffix = { development: "dev", test: "test", e2e: "e2e" }[mode];
        return {
          APP_ENV: mode,
          DATABASE_URL: `postgresql://refind_${suffix}_user:${password}@127.0.0.1:${port}/refind_${suffix}`,
        };
      },
      async client(mode = "test") {
        const client = new pg.Client({
          connectionString: this.config(mode).DATABASE_URL,
        });
        await client.connect();
        return client;
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
