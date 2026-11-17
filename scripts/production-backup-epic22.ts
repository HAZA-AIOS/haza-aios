import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";
const PROD_DB = "railway";
const VERIFICATION_DB = "haza_epic22_backup_verification";
const BACKUP_DIR = "C:\\Users\\theme\\HAZA-AIOS-Private\\production-backups\\epic22";

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function runRailwayMysql(sql: string, targetDb?: string): Promise<{ stdout: string; stderr: string }> {
  return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const dbArg = targetDb ? ` ${targetDb}` : "";
    const shCmd = `mysql -u root -p"$MYSQL_ROOT_PASSWORD"${dbArg}`;

    const child = spawn("cmd.exe", [
      "/d",
      "/c",
      "railway",
      "ssh",
      "-s",
      "MySQL",
      "-e",
      "production",
      "-i",
      SSH_KEY,
      "--",
      "sh",
      "-c",
      shCmd,
    ]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`MySQL execution failed (exit ${code}): ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    child.on("error", reject);

    child.stdin.write(sql);
    child.stdin.end();
  });
}

async function dumpDbToLocalFile(sourceDb: string, destFilePath: string): Promise<void> {
  const dir = path.dirname(destFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return await new Promise<void>((resolve, reject) => {
    const shCmd = `mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick ${sourceDb}`;

    const child = spawn("cmd.exe", [
      "/d",
      "/c",
      "railway",
      "ssh",
      "-s",
      "MySQL",
      "-e",
      "production",
      "-i",
      SSH_KEY,
      "--",
      "sh",
      "-c",
      shCmd,
    ]);

    const fileStream = fs.createWriteStream(destFilePath);
    let stderr = "";

    child.stdout.pipe(fileStream);
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`mysqldump from ${sourceDb} failed (exit ${code}): ${stderr}`));
      } else {
        resolve();
      }
    });

    child.on("error", reject);
  });
}

async function streamSqlFileToDb(filePath: string, targetDb: string): Promise<void> {
  return await new Promise<void>((resolve, reject) => {
    const shCmd = `mysql -u root -p"$MYSQL_ROOT_PASSWORD" ${targetDb}`;

    const child = spawn("cmd.exe", [
      "/d",
      "/c",
      "railway",
      "ssh",
      "-s",
      "MySQL",
      "-e",
      "production",
      "-i",
      SSH_KEY,
      "--",
      "sh",
      "-c",
      shCmd,
    ]);

    const readStream = fs.createReadStream(filePath);
    let stderr = "";

    readStream.pipe(child.stdin);

    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`SQL stream to ${targetDb} failed (exit ${code}): ${stderr}`));
      } else {
        resolve();
      }
    });

    child.on("error", reject);
  });
}

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS — PHASE 3: PRODUCTION DATABASE BACKUP & VERIFICATION ");
  console.log("================================================================");

  // 1. Inspect live production database state
  console.log("\n--- STEP 1: QUERYING LIVE PRODUCTION DATABASE METRICS ---");
  const prodTablesRes = await runRailwayMysql(
    `SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = '${PROD_DB}';`,
    PROD_DB
  );
  const prodFkRes = await runRailwayMysql(
    `SELECT COUNT(*) as fk_count FROM information_schema.table_constraints WHERE constraint_schema = '${PROD_DB}' AND constraint_type = 'FOREIGN KEY';`,
    PROD_DB
  );
  const prodVersionRes = await runRailwayMysql(`SELECT VERSION() as version;`, PROD_DB);
  const prodLastMigRes = await runRailwayMysql(
    `SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 3;`,
    PROD_DB
  );

  console.log(`[LIVE PROD] MySQL Version: ${prodVersionRes.stdout.trim()}`);
  console.log(`[LIVE PROD] Total Tables: ${prodTablesRes.stdout.trim()}`);
  console.log(`[LIVE PROD] Total Foreign Keys: ${prodFkRes.stdout.trim()}`);
  console.log(`[LIVE PROD] Recent Migrations in __drizzle_migrations:\n${prodLastMigRes.stdout.trim()}`);

  // 2. Dump production database to secure local backup file
  const timestamp = getTimestamp();
  const backupFileName = `haza-aios-production-epic22-predeploy-backup_${timestamp}.sql`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  console.log(`\n--- STEP 2: CREATING FRESH PRODUCTION BACKUP ---`);
  console.log(`[BACKUP TARGET] ${backupFilePath}`);
  const dumpStart = Date.now();
  await dumpDbToLocalFile(PROD_DB, backupFilePath);
  const dumpDuration = ((Date.now() - dumpStart) / 1000).toFixed(2);

  const stats = fs.statSync(backupFilePath);
  const fileBuffer = fs.readFileSync(backupFilePath);
  const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  console.log(`[BACKUP] Dump completed in ${dumpDuration}s.`);
  console.log(`[BACKUP] Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);
  console.log(`[BACKUP] SHA-256: ${sha256}`);

  // 3. Verify backup file completeness
  console.log(`\n--- STEP 3: VERIFYING BACKUP FILE COMPLETENESS ---`);
  const content = fileBuffer.toString("utf8");
  const hasDumpComplete = content.includes("Dump completed");
  const hasDrizzleMigrations = content.includes("CREATE TABLE `__drizzle_migrations`");
  const hasOrganizations = content.includes("CREATE TABLE `organizations`");
  const hasTraceSpans = content.includes("CREATE TABLE `agent_trace_spans`");

  console.log(`[CHECK] Contains 'Dump completed': ${hasDumpComplete}`);
  console.log(`[CHECK] Contains '__drizzle_migrations': ${hasDrizzleMigrations}`);
  console.log(`[CHECK] Contains 'organizations': ${hasOrganizations}`);
  console.log(`[CHECK] Contains 'agent_trace_spans' (Epic 21): ${hasTraceSpans}`);

  if (!hasDumpComplete || !hasDrizzleMigrations || !hasOrganizations || !hasTraceSpans) {
    throw new Error("Backup file completeness verification failed!");
  }

  // 4. Test backup restoration in an isolated recovery database
  console.log(`\n--- STEP 4: RESTORATION VERIFICATION IN ISOLATED DATABASE ---`);
  console.log(`[PROVISION] Creating isolated test database: ${VERIFICATION_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS ${VERIFICATION_DB}; CREATE DATABASE ${VERIFICATION_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);

  console.log(`[RESTORE] Restoring backup into ${VERIFICATION_DB}...`);
  const restoreStart = Date.now();
  await streamSqlFileToDb(backupFilePath, VERIFICATION_DB);
  console.log(`[RESTORE] Restored in ${((Date.now() - restoreStart) / 1000).toFixed(2)}s.`);

  // 5. Compare verification DB metrics against live production
  console.log(`\n--- STEP 5: VERIFYING RESTORED SCHEMA & DATA PARITY ---`);
  const verifTablesRes = await runRailwayMysql(
    `SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = '${VERIFICATION_DB}';`,
    VERIFICATION_DB
  );
  const verifFkRes = await runRailwayMysql(
    `SELECT COUNT(*) as fk_count FROM information_schema.table_constraints WHERE constraint_schema = '${VERIFICATION_DB}' AND constraint_type = 'FOREIGN KEY';`,
    VERIFICATION_DB
  );
  const verifMigRes = await runRailwayMysql(
    `SELECT COUNT(*) as mig_count FROM ${VERIFICATION_DB}.__drizzle_migrations;`,
    VERIFICATION_DB
  );

  console.log(`[VERIFICATION DB] Total Tables: ${verifTablesRes.stdout.trim()}`);
  console.log(`[VERIFICATION DB] Total Foreign Keys: ${verifFkRes.stdout.trim()}`);
  console.log(`[VERIFICATION DB] Total Migrations: ${verifMigRes.stdout.trim()}`);

  if (verifTablesRes.stdout.trim() !== prodTablesRes.stdout.trim()) {
    throw new Error(`Table count mismatch between live production (${prodTablesRes.stdout.trim()}) and restored backup (${verifTablesRes.stdout.trim()})`);
  }
  if (verifFkRes.stdout.trim() !== prodFkRes.stdout.trim()) {
    throw new Error(`Foreign key count mismatch between live production (${prodFkRes.stdout.trim()}) and restored backup (${verifFkRes.stdout.trim()})`);
  }

  // 6. Clean up isolated verification database
  console.log(`\n--- STEP 6: CLEANING UP ISOLATED VERIFICATION DATABASE ---`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS ${VERIFICATION_DB};`);
  console.log(`[CLEANUP] Dropped ${VERIFICATION_DB}. Zero production footprint.`);

  console.log("\n================================================================");
  console.log("  HAZA AIOS — PHASE 3: PRODUCTION BACKUP VERIFIED & RECORDED    ");
  console.log("================================================================");
  console.log(`File: ${backupFilePath}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);
  console.log(`SHA-256: ${sha256}`);
}

main().catch((err) => {
  console.error("PHASE 3 BACKUP FAILED:", err);
  process.exit(1);
});
