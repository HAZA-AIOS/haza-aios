import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";

async function runRailwayMysql(sql: string, retries = 3): Promise<{ stdout: string; stderr: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const shCmd = `mysql -u root -p"$MYSQL_ROOT_PASSWORD" railway`;

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
      if (attempt < retries && (err.message.includes("can't verify your SSH key") || err.message.includes("Connection reset") || err.message.includes("Broken pipe"))) {
        console.log(`  [RETRY ${attempt}/${retries}] Transient SSH issue encountered, retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Exhausted retries");
}

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Production Database Migration 0024 Check & Apply   ");
  console.log("================================================================");

  // 1. Inspect recent migrations
  const migRows = await runRailwayMysql("SELECT id, hash, FROM_UNIXTIME(created_at/1000) as applied_at FROM `__drizzle_migrations` ORDER BY id DESC LIMIT 5;");
  console.log("\n[PROD] Latest applied migrations in __drizzle_migrations:\n" + migRows.stdout.trim());

  // 2. Check if 0024 is already applied
  const checkCol = await runRailwayMysql("SHOW COLUMNS FROM `ai_agent_runs` LIKE 'lease_token';");
  console.log("\n[PROD] Checking ai_agent_runs lease_token column:\n" + checkCol.stdout.trim());

  if (!checkCol.stdout.includes("lease_token")) {
    console.log("\n[PROD] Migration 0024 NOT yet applied in production. Applying statements now...");
    const migFile = path.resolve("apps/api/src/database/migrations/0024_agent_runtime_execution_engine.sql");
    const migSql = fs.readFileSync(migFile, "utf-8");
    const statements = migSql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);

    console.log(`[PROD] Found ${statements.length} statements in migration 0024.`);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.replace(/\s+/g, " ").substring(0, 70);
      console.log(`  Applying [${i + 1}/${statements.length}]: ${preview}...`);
      await runRailwayMysql(stmt);
    }

    // 3. Record migration in __drizzle_migrations
    const journalPath = path.resolve("apps/api/src/database/migrations/meta/_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const entry24 = journal.entries.find((e: any) => e.idx === 24);
    if (entry24) {
      console.log(`\n[PROD] Recording migration 24 (${entry24.tag}) in __drizzle_migrations...`);
      await runRailwayMysql(`INSERT INTO \`__drizzle_migrations\` (hash, created_at) VALUES ('${entry24.tag}', UNIX_TIMESTAMP() * 1000);`);
    }

    console.log("\n[SUCCESS] Migration 0024 applied and recorded in production successfully!");
  } else {
    console.log("\n[PROD] Migration 0024 is ALREADY applied in production.");
  }

  // 4. Verify tables
  console.log("\n--- Verification of Production Schema ---");
  const tables = await runRailwayMysql("SHOW TABLES LIKE 'ai_agent_%';");
  console.log("ai_agent_* tables in production:\n" + tables.stdout.trim());

  // 5. Verify enum values
  const enumCheck = await runRailwayMysql("SHOW COLUMNS FROM `ai_agent_runs` LIKE 'agent_run_status';");
  console.log("\nagent_run_status column definition:\n" + enumCheck.stdout.trim());

  // 6. Verify backfill linkage
  const backfillCheck = await runRailwayMysql("SELECT count(*) as count FROM `ai_agent_runs` WHERE configuration_revision_id IS NOT NULL;");
  console.log("\nai_agent_runs with linked revision:\n" + backfillCheck.stdout.trim());
}

main().catch((err) => {
  console.error("\n[FATAL] Script failed:", err);
  process.exit(1);
});
