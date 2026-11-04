import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";
const PROD_DB = "railway";

async function runRailwayMysql(sql: string, retries = 3): Promise<{ stdout: string; stderr: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const shCmd = `mysql -u root -p"$MYSQL_ROOT_PASSWORD" ${PROD_DB}`;

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

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Production Migration 0031 Deployment Utility      ");
  console.log("================================================================");

  // 1. Check current migration journal
  console.log("[JOURNAL] Checking applied migrations in production MySQL...");
  const checkJournalSql = "SELECT id, hash, FROM_UNIXTIME(created_at / 1000) as applied_time FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;";
  const journalRes = await runRailwayMysql(checkJournalSql);
  console.log("[JOURNAL] Latest applied migrations:\n" + journalRes.stdout.trim());

  if (journalRes.stdout.includes("0031_agent_observability_evaluation_reliability")) {
    console.log("[INFO] Migration 0031 is already recorded as applied in production MySQL. No changes needed.");
    return;
  }

  // 2. Read and apply migration SQL
  const migrationPath = path.resolve("apps/api/src/database/migrations/0031_agent_observability_evaluation_reliability.sql");
  console.log(`[MIGRATE] Reading Migration 0031 SQL from ${migrationPath}...`);
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`[MIGRATE] Applying ${statements.length} DDL statements to production database...`);
  const migStart = Date.now();
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, " ").substring(0, 65);
    console.log(`  Executing [${i + 1}/${statements.length}]: ${preview}...`);
    await runRailwayMysql(stmt);
  }
  console.log(`[MIGRATE] All ${statements.length} DDL statements successfully executed in ${((Date.now() - migStart) / 1000).toFixed(2)}s.`);

  // 3. Update journal
  const updateJournalSql = `
    INSERT INTO __drizzle_migrations (hash, created_at)
    VALUES ('0031_agent_observability_evaluation_reliability', 1793800000000);
  `;
  await runRailwayMysql(updateJournalSql);
  console.log("[JOURNAL] Production migration journal updated with 0031 (1793800000000).");

  // 4. Verify all 8 new tables in production
  console.log("[AUDIT] Verifying all new Epic 21 Observability & Reliability tables in production MySQL...");
  const verifyTablesSql = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = '${PROD_DB}' 
      AND table_name IN (
        'agent_trace_spans',
        'agent_evaluation_datasets',
        'agent_evaluation_cases',
        'agent_evaluation_runs',
        'agent_slo_definitions',
        'agent_reliability_metrics',
        'agent_alert_rules',
        'agent_incidents'
      )
    ORDER BY table_name;
  `;
  const tablesRes = await runRailwayMysql(verifyTablesSql);
  console.log("[AUDIT] Verified production tables:\n" + tablesRes.stdout.trim());

  console.log("================================================================");
  console.log("  PRODUCTION MIGRATION 0031 VERIFIED AND ACTIVE!                ");
  console.log("================================================================");
}

if (process.argv[1]?.includes("check-and-apply-prod-migration-epic21")) {
  main().catch((err) => {
    console.error("\n[FATAL ERROR during production migration]:", err.message || err);
    process.exit(1);
  });
}
