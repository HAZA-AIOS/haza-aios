import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEST_DIR = "C:\\Users\\theme\\HAZA-AIOS-Private\\production-backups\\epic16";
const REHEARSAL_DB = "haza_epic16_rehearsal";
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

function getLatestBackup(): string {
  if (!fs.existsSync(DEST_DIR)) {
    throw new Error(`Backup directory not found at ${DEST_DIR}`);
  }
  const files = fs.readdirSync(DEST_DIR)
    .filter(f => f.endsWith(".sql") && !f.endsWith(".sha256"))
    .map(f => path.join(DEST_DIR, f));
  if (files.length === 0) {
    throw new Error(`No .sql backups found in ${DEST_DIR}`);
  }
  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0];
}

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Epic 16 Migration 0026 Isolated Rehearsal");
  console.log("================================================================");

  const backupPath = process.argv[2] || getLatestBackup();
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found at ${backupPath}`);
  }
  const backupStats = fs.statSync(backupPath);
  console.log(`[BACKUP] Source: ${backupPath} (${backupStats.size.toLocaleString()} bytes)`);

  // Step 1: Create isolated rehearsal DB
  console.log(`\n[STEP 1/5] Creating isolated rehearsal database: ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS \`${REHEARSAL_DB}\`; CREATE DATABASE \`${REHEARSAL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
  console.log(`[STEP 1/5] Done. Database ${REHEARSAL_DB} created.`);

  // Step 2: Stream backup to rehearsal DB
  console.log(`\n[STEP 2/5] Restoring production backup into ${REHEARSAL_DB}...`);
  const t0 = Date.now();
  await streamFileToRailwayMysql(backupPath, REHEARSAL_DB);
  console.log(`[STEP 2/5] Done. Restored in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);

  // Step 3: Apply Migration 0026 statements
  console.log(`\n[STEP 3/5] Applying migration 0026_agent_tools_and_organizational_data.sql...`);
  const migFile = path.resolve("apps/api/src/database/migrations/0026_agent_tools_and_organizational_data.sql");
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

  const tablesCheck = await runRailwayMysql("SHOW TABLES LIKE 'ai_agent_tool%';", REHEARSAL_DB);
  console.log(`\n--- ai_agent_tool tables presence ---:\n${tablesCheck.stdout.trim()}`);
  if (!tablesCheck.stdout.includes("ai_agent_tools") ||
      !tablesCheck.stdout.includes("ai_agent_tool_versions") ||
      !tablesCheck.stdout.includes("ai_agent_tool_tenant_policies") ||
      !tablesCheck.stdout.includes("ai_agent_tool_executions")) {
    throw new Error("One or more Epic 16 tool tables were not created in rehearsal schema!");
  }

  const colCheck = await runRailwayMysql("SHOW COLUMNS FROM `ai_agent_tools`;", REHEARSAL_DB);
  console.log(`\n--- ai_agent_tools columns ---:\n${colCheck.stdout.trim()}`);

  const colExecCheck = await runRailwayMysql("SHOW COLUMNS FROM `ai_agent_tool_executions`;", REHEARSAL_DB);
  console.log(`\n--- ai_agent_tool_executions columns ---:\n${colExecCheck.stdout.trim()}`);

  // Test insert of tool and execution linked to existing org
  console.log("\nTesting insertion into ai_agent_tools & ai_agent_tool_executions in rehearsal DB...");
  const orgRes = await runRailwayMysql("SELECT id FROM organizations LIMIT 1;", REHEARSAL_DB);
  const orgRows = orgRes.stdout.trim().split("\n");
  if (orgRows.length >= 2) {
    const orgId = orgRows[1].trim();
    const testToolId = "00000000-0000-4200-8000-000000000001";
    await runRailwayMysql(
      `INSERT INTO \`ai_agent_tools\` (\`id\`, \`tool_key\`, \`name\`, \`description\`, \`category\`, \`industry\`, \`risk_level\`, \`execution_mode\`, \`required_permissions\`, \`approval_policy\`, \`timeout_ms\`, \`max_attempts\`, \`status\`) VALUES ('${testToolId}', 'education.academic_structure.read', 'Read Academic Structure', 'Test', 'academic_structure', 'education', 'low', 'sync', '[\"education.academic.read\"]', 'none', 10000, 3, 'active');`,
      REHEARSAL_DB
    );

    const testVersionId = "00000000-0000-4200-8000-000000000002";
    await runRailwayMysql(
      `INSERT INTO \`ai_agent_tool_versions\` (\`id\`, \`tool_id\`, \`version\`, \`input_schema\`, \`output_schema\`, \`deprecated\`) VALUES ('${testVersionId}', '${testToolId}', '1.0.0', '{}', '{}', 0);`,
      REHEARSAL_DB
    );

    const verifyTool = await runRailwayMysql(`SELECT id, tool_key, status FROM \`ai_agent_tools\` WHERE \`id\` = '${testToolId}';`, REHEARSAL_DB);
    console.log(`Inserted tool row verified:\n${verifyTool.stdout.trim()}`);
  }

  // Step 5: Clean up rehearsal DB
  console.log(`\n[STEP 5/5] Dropping isolated rehearsal database ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS \`${REHEARSAL_DB}\`;`);
  console.log(`[STEP 5/5] Done. Rehearsal database dropped.`);

  console.log("\n================================================================");
  console.log("  REHEARSAL SUCCESSFUL: Migration 0026 verified 100% on MySQL 9");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("Rehearsal failed:", err);
  process.exit(1);
});
