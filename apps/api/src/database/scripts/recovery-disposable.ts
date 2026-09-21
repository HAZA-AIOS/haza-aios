import { createReadStream, existsSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import mysql from "mysql2/promise";
import { loadConfig } from "../../config/env.js";

const mode = process.argv[2];
const file = process.argv[3];
const config = loadConfig(process.env).database;

if (
  process.env.NODE_ENV !== "test" ||
  !["127.0.0.1", "localhost", "::1"].includes(config.host) ||
  !/^haza_aios_(test|db18_)[a-z0-9_]*$/.test(config.name)
) {
  throw new Error(
    "Recovery rehearsal requires NODE_ENV=test and a named local disposable database.",
  );
}
if (!file || !["backup", "restore"].includes(mode)) {
  throw new Error("Usage: recovery-disposable.ts backup|restore <absolute-output-or-input-path>");
}
const path = resolve(file);
const env = { ...process.env, MYSQL_PWD: config.password };
const connectionArgs = [`--host=${config.host}`, `--port=${config.port}`, `--user=${config.user}`];

async function run() {
  if (mode === "backup") {
    if (existsSync(path)) throw new Error("Backup output already exists.");
    const args = [
      ...connectionArgs,
      "--single-transaction",
      "--quick",
      "--hex-blob",
      `--result-file=${path}`,
      config.name,
    ];
    try {
      await execute(process.env.MYSQLDUMP_BIN || "mysqldump", args);
    } catch (error) {
      if (existsSync(path)) unlinkSync(path);
      throw error;
    }
    console.info(JSON.stringify({ action: "backup", database: config.name, file: path }));
    return;
  }

  if (!existsSync(path)) throw new Error("Backup input does not exist.");
  if (process.env.ALLOW_DISPOSABLE_RESTORE !== "yes") {
    throw new Error("Set ALLOW_DISPOSABLE_RESTORE=yes for a reviewed disposable restore.");
  }
  const db = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.name,
  });
  try {
    const [rows] = await db.query("show tables");
    if ((rows as unknown[]).length !== 0) {
      throw new Error("Restore target must be an empty disposable database.");
    }
  } finally {
    await db.end();
  }
  await execute(
    process.env.MYSQL_BIN || "mysql",
    [...connectionArgs, `--database=${config.name}`],
    path,
  );
  console.info(JSON.stringify({ action: "restore", database: config.name, file: path }));
}

function execute(command: string, args: string[], input?: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: [input ? "pipe" : "ignore", "ignore", "pipe"],
    });
    let errorText = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      errorText += chunk.toString().slice(0, 2000);
    });
    child.on("error", reject);
    if (input && child.stdin) createReadStream(input).pipe(child.stdin);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} failed (exit ${code}): ${errorText.trim()}`));
    });
  });
}

await run();
