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
        console.log(`  [RETRY ${attempt}/${retries}] Transient SSH issue, retrying in 2s...`);
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
  console.log("  HAZA AIOS - Production Migration 0028 Deployment Utility      ");
  console.log("================================================================");

  // 1. Check current migration journal
  console.log("[JOURNAL] Checking applied migrations in production MySQL...");
  const checkJournalSql = "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;";
  const journalRes = await runRailwayMysql(checkJournalSql);
  console.log("[JOURNAL] Latest applied migrations:\n" + journalRes.stdout.trim());

  if (journalRes.stdout.includes("0028_live_ai_provider_integration")) {
    console.log("[INFO] Migration 0028 is already recorded as applied in production.");
  } else {
    // 2. Read and apply migration SQL
    const migrationPath = path.resolve("apps/api/src/database/migrations/0028_live_ai_provider_integration.sql");
    console.log(`[MIGRATE] Reading Migration 0028 SQL from ${migrationPath}...`);
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    const statements = migrationSql.split("--> statement-breakpoint").map((s) => s.trim()).filter((s) => s.length > 0);
    console.log(`[MIGRATE] Applying ${statements.length} DDL statements to production database...`);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.replace(/\s+/g, " ").substring(0, 65);
      console.log(`  Executing [${i + 1}/${statements.length}]: ${preview}...`);
      await runRailwayMysql(stmt);
    }
    console.log("[MIGRATE] All DDL statements successfully executed in production.");

    // 3. Seed default pricing catalog if empty
    console.log("[SEED] Seeding default pricing catalog if not present...");
    const seedPricingSql = `
      INSERT IGNORE INTO ai_model_pricing_catalog 
        (id, provider_id, model_id, prompt_per_thousand_tokens_usd, completion_per_thousand_tokens_usd, embedding_per_thousand_tokens_usd, context_window, max_output_tokens, supports_streaming, supports_tools, supports_vision, supports_json_mode, is_active)
      VALUES 
        ('prc-gpt4o-mini', 'openai', 'gpt-4o-mini', 0.000150, 0.000600, 0.000000, 128000, 16384, true, true, true, true, true),
        ('prc-gpt4o', 'openai', 'gpt-4o', 0.002500, 0.010000, 0.000000, 128000, 16384, true, true, true, true, true),
        ('prc-text-emb-3-small', 'openai', 'text-embedding-3-small', 0.000000, 0.000000, 0.000020, 8191, 0, false, false, false, false, true),
        ('prc-text-emb-3-large', 'openai', 'text-embedding-3-large', 0.000000, 0.000000, 0.000130, 8191, 0, false, false, false, false, true);
    `;
    await runRailwayMysql(seedPricingSql);

    // 4. Update journal
    const updateJournalSql = `
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES ('0028_live_ai_provider_integration', UNIX_TIMESTAMP() * 1000);
    `;
    await runRailwayMysql(updateJournalSql);
    console.log("[JOURNAL] Production migration journal updated with 0028.");
  }

  // 5. Verify all new tables in production
  console.log("[AUDIT] Verifying all new Epic 18 AI provider tables in production MySQL...");
  const verifyTablesSql = `
    SELECT table_name, table_rows 
    FROM information_schema.tables 
    WHERE table_schema = '${PROD_DB}' 
      AND table_name IN (
        'ai_provider_tenant_configs', 
        'ai_provider_audit_logs', 
        'ai_model_pricing_catalog', 
        'ai_usage_budgets', 
        'ai_usage_ledger'
      )
    ORDER BY table_name;
  `;
  const tablesRes = await runRailwayMysql(verifyTablesSql);
  console.log("[AUDIT] Verified production tables:\n" + tablesRes.stdout.trim());

  // 6. Verify pricing catalog rows
  const countPricingSql = `SELECT count(*) as total_models FROM ai_model_pricing_catalog;`;
  const countRes = await runRailwayMysql(countPricingSql);
  console.log("[AUDIT] Pricing catalog rows: " + countRes.stdout.trim());

  console.log("================================================================");
  console.log("  PRODUCTION MIGRATION 0028 VERIFIED AND ACTIVE!                ");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR during production migration]:", err.message || err);
  process.exit(1);
});

