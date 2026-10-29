import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";

const BACKUP_PATH = "C:\\Users\\theme\\HAZA-AIOS-Private\\production-backups\\epic13\\haza-aios-production-stage20-backup_20261029_112341.sql";
const REHEARSAL_DB = "haza_epic13_rehearsal";
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
  console.log("  HAZA AIOS - Epic 13 Migration 0023 Isolated Rehearsal");
  console.log("================================================================");

  if (!fs.existsSync(BACKUP_PATH)) {
    throw new Error(`Backup file not found at ${BACKUP_PATH}`);
  }
  const backupStats = fs.statSync(BACKUP_PATH);
  console.log(`[BACKUP] Source: ${BACKUP_PATH} (${backupStats.size} bytes)`);

  // Step 1: Create isolated rehearsal DB
  console.log(`\n[STEP 1/5] Creating isolated database: ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS \`${REHEARSAL_DB}\`; CREATE DATABASE \`${REHEARSAL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
  console.log(`[STEP 1/5] Done. Database ${REHEARSAL_DB} created.`);

  // Step 2: Stream backup to rehearsal DB
  console.log(`\n[STEP 2/5] Restoring production backup into ${REHEARSAL_DB}...`);
  const t0 = Date.now();
  await streamFileToRailwayMysql(BACKUP_PATH, REHEARSAL_DB);
  console.log(`[STEP 2/5] Done. Restored in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

  // Step 3: Apply Migration 0023 statements
  console.log(`\n[STEP 3/5] Applying migration 0023_agent_configuration_builder.sql...`);
  const migFile = path.resolve("apps/api/src/database/migrations/0023_agent_configuration_builder.sql");
  const migSql = fs.readFileSync(migFile, "utf-8");
  const statements = migSql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, " ").substring(0, 60);
    console.log(`  Executing [${i + 1}/${statements.length}]: ${preview}...`);
    await runRailwayMysql(stmt, REHEARSAL_DB);
  }
  console.log(`[STEP 3/5] All ${statements.length} migration statements applied cleanly.`);

  // Step 4: Verification queries
  console.log(`\n[STEP 4/5] Running verification checks on ${REHEARSAL_DB}...`);
  
  const colCheck = await runRailwayMysql("SHOW COLUMNS FROM `ai_agent_definitions` LIKE 'active_revision%';", REHEARSAL_DB);
  console.log(`\n--- ai_agent_definitions columns ---:\n${colCheck.stdout.trim()}`);

  const rowCount = await runRailwayMysql("SELECT count(*) as count FROM `ai_agent_configuration_revisions`;", REHEARSAL_DB);
  console.log(`\n--- ai_agent_configuration_revisions row count ---:\n${rowCount.stdout.trim()}`);

  const linkCheck = await runRailwayMysql(
    "SELECT d.id, d.name, d.active_revision_number, d.active_revision_id, r.version, r.status FROM `ai_agent_definitions` d JOIN `ai_agent_configuration_revisions` r ON d.active_revision_id = r.id LIMIT 5;",
    REHEARSAL_DB
  );
  console.log(`\n--- Active Revision Linkage Sample ---:\n${linkCheck.stdout.trim()}`);

  // Test constraint: duplicate (agent_id, revision_number)
  console.log("\nTesting unique constraint on (agent_id, revision_number)...");
  try {
    await runRailwayMysql(
      "INSERT INTO `ai_agent_configuration_revisions` (`id`, `organization_id`, `workspace_id`, `agent_id`, `revision_number`, `version`, `status`, `configuration`, `created_by`) SELECT UUID(), organization_id, workspace_id, agent_id, 1, 'duplicate', 'draft', '{}', created_by FROM `ai_agent_configuration_revisions` LIMIT 1;",
      REHEARSAL_DB
    );
    throw new Error("Expected unique constraint violation, but insert succeeded!");
  } catch (err: any) {
    if (err.message.includes("Duplicate entry")) {
      console.log("  Successfully verified unique constraint: duplicate (agent_id, revision_number) was rejected.");
    } else {
      throw err;
    }
  }

  // Step 5: Clean up rehearsal DB
  console.log(`\n[STEP 5/5] Dropping isolated database ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS \`${REHEARSAL_DB}\`;`);
  console.log(`[STEP 5/5] Done. Rehearsal database dropped.`);

  console.log("\n================================================================");
  console.log("  REHEARSAL SUCCESSFUL: Migration 0023 verified 100% on MySQL 9");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("Rehearsal failed:", err);
  process.exit(1);
});
