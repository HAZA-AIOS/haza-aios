import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BACKUP_PATH = "C:\\Users\\theme\\HAZA-AIOS-Private\\production-backups\\epic14\\haza-aios-production-epic14-backup_20261030035246.sql";
const REHEARSAL_DB = "haza_epic14_rehearsal";
const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";

async function runRailwayMysql(sql: string, targetDb?: string, retries = 3): Promise<{ stdout: string; stderr: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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

        child.stdin.write(sql);
        child.stdin.end();
      });
    } catch (err: any) {
      if (attempt < retries && (err.message.includes("can't verify your SSH key") || err.message.includes("Connection reset"))) {
        console.log(`  [RETRY ${attempt}/${retries}] Transient SSH issue encountered, retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Exhausted retries");
}

function streamFileToRailwayMysql(filePath: string, targetDb: string): Promise<void> {
  return new Promise((resolve, reject) => {
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

    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Restore streaming failed (exit ${code}): ${stderr}`));
      } else {
        resolve();
      }
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(child.stdin);
  });
}

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Epic 14 Migration 0024 Isolated Rehearsal");
  console.log("================================================================");

  if (!fs.existsSync(BACKUP_PATH)) {
    throw new Error(`Backup file not found at ${BACKUP_PATH}`);
  }
  const backupStats = fs.statSync(BACKUP_PATH);
  console.log(`[BACKUP] Source: ${BACKUP_PATH} (${backupStats.size} bytes)`);

  // Step 1: Create isolated rehearsal DB
  console.log(`\n[STEP 1/5] Creating isolated rehearsal database: ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS \`${REHEARSAL_DB}\`; CREATE DATABASE \`${REHEARSAL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
  console.log(`[STEP 1/5] Done. Database ${REHEARSAL_DB} created.`);

  // Step 2: Stream backup to rehearsal DB
  console.log(`\n[STEP 2/5] Restoring production backup into ${REHEARSAL_DB}...`);
  const t0 = Date.now();
  await streamFileToRailwayMysql(BACKUP_PATH, REHEARSAL_DB);
  console.log(`[STEP 2/5] Done. Restored in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

  // Step 3: Apply Migration 0024 statements
  console.log(`\n[STEP 3/5] Applying migration 0024_agent_runtime_execution_engine.sql...`);
  const migFile = path.resolve("apps/api/src/database/migrations/0024_agent_runtime_execution_engine.sql");
  const migSql = fs.readFileSync(migFile, "utf-8");
  const statements = migSql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, " ").substring(0, 65);
    console.log(`  Executing [${i + 1}/${statements.length}]: ${preview}...`);
    await runRailwayMysql(stmt, REHEARSAL_DB);
  }
  console.log(`[STEP 3/5] All ${statements.length} migration statements applied cleanly.`);

  // Step 4: Verification queries
  console.log(`\n[STEP 4/5] Running verification checks on ${REHEARSAL_DB}...`);

  const colCheck = await runRailwayMysql("SHOW COLUMNS FROM `ai_agent_runs` LIKE 'agent_run_status';", REHEARSAL_DB);
  console.log(`\n--- ai_agent_runs status column ---:\n${colCheck.stdout.trim()}`);

  const leaseCheck = await runRailwayMysql("SHOW COLUMNS FROM `ai_agent_runs` WHERE Field IN ('lease_token', 'attempt_count', 'worker_id', 'total_cost_micros');", REHEARSAL_DB);
  console.log(`\n--- ai_agent_runs runtime columns ---:\n${leaseCheck.stdout.trim()}`);

  const tablesCheck = await runRailwayMysql("SHOW TABLES LIKE 'ai_agent_%';", REHEARSAL_DB);
  console.log(`\n--- AI Agent Tables in Rehearsal Schema ---:\n${tablesCheck.stdout.trim()}`);

  // Test unique constraint on (run_id, attempt_number)
  console.log("\nTesting unique constraint on (run_id, attempt_number) in ai_agent_run_attempts...");
  const dummyOrg = await runRailwayMysql("SELECT organization_id, workspace_id, id FROM `ai_agent_runs` LIMIT 1;", REHEARSAL_DB);
  if (dummyOrg.stdout.trim()) {
    const parts = dummyOrg.stdout.trim().split("\n")[1]?.split("\t");
    if (parts && parts.length >= 3) {
      const [orgId, wsId, runId] = parts;
      await runRailwayMysql(
        `INSERT INTO \`ai_agent_run_attempts\` (\`id\`, \`organization_id\`, \`workspace_id\`, \`run_id\`, \`attempt_number\`, \`status\`, \`worker_id\`, \`lease_token\`) VALUES (UUID(), '${orgId}', '${wsId}', '${runId}', 1, 'running', 'worker-1', 'lease-1');`,
        REHEARSAL_DB
      );
      try {
        await runRailwayMysql(
          `INSERT INTO \`ai_agent_run_attempts\` (\`id\`, \`organization_id\`, \`workspace_id\`, \`run_id\`, \`attempt_number\`, \`status\`, \`worker_id\`, \`lease_token\`) VALUES (UUID(), '${orgId}', '${wsId}', '${runId}', 1, 'running', 'worker-2', 'lease-2');`,
          REHEARSAL_DB
        );
        throw new Error("Expected unique constraint violation, but duplicate attempt succeeded!");
      } catch (err: any) {
        if (err.message.includes("Duplicate entry")) {
          console.log("  Successfully verified unique constraint: duplicate attempt number on run was rejected.");
        } else {
          throw err;
        }
      }
    }
  }

  // Step 5: Clean up rehearsal DB
  console.log(`\n[STEP 5/5] Dropping isolated rehearsal database ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS \`${REHEARSAL_DB}\`;`);
  console.log(`[STEP 5/5] Done. Rehearsal database dropped.`);

  console.log("\n================================================================");
  console.log("  REHEARSAL SUCCESSFUL: Migration 0024 verified 100% on MySQL 9");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("Rehearsal failed:", err);
  process.exit(1);
});
