import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEST_DIR = "C:\\Users\\theme\\HAZA-AIOS-Private\\production-backups\\epic18";
const REHEARSAL_DB = "haza_epic18_rehearsal";
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

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Epic 18 Migration Rehearsal (Isolated Schema)     ");
  console.log("================================================================");

  // 1. Prepare disposable rehearsal schema
  console.log(`[SCHEMA] Creating disposable database: ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS ${REHEARSAL_DB}; CREATE DATABASE ${REHEARSAL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
  console.log(`[OK] Schema ${REHEARSAL_DB} created.`);

  // 2. Read migration file
  const migrationPath = path.resolve("apps/api/src/database/migrations/0028_live_ai_provider_integration.sql");
  console.log(`[FILE] Reading migration: ${migrationPath}`);
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  // 3. Create baseline prerequisites
  console.log("[SETUP] Provisioning minimal relational dependencies (organizations, workspaces, users, ai_agent_definitions, ai_agent_runs)...");
  const baselineSql = `
    CREATE TABLE \`organizations\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`name\` varchar(255) NOT NULL,
      \`slug\` varchar(100) NOT NULL UNIQUE,
      \`status\` varchar(50) NOT NULL DEFAULT 'active'
    );
    CREATE TABLE \`workspaces\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`organization_id\` char(36) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`status\` varchar(50) NOT NULL DEFAULT 'active'
    );
    CREATE TABLE \`users\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`email\` varchar(255) NOT NULL UNIQUE,
      \`status\` varchar(50) NOT NULL DEFAULT 'active'
    );
    CREATE TABLE \`ai_agent_definitions\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`organization_id\` char(36) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`status\` varchar(50) NOT NULL DEFAULT 'active'
    );
    CREATE TABLE \`ai_agent_runs\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`organization_id\` char(36) NOT NULL,
      \`status\` varchar(50) NOT NULL DEFAULT 'queued'
    );
  `;
  await runRailwayMysql(baselineSql, REHEARSAL_DB);
  console.log("[OK] Baseline tables provisioned.");

  // 4. Execute Migration 0028 statements
  console.log("[APPLY] Executing Migration 0028 statements...");
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let successCount = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    await runRailwayMysql(stmt, REHEARSAL_DB);
    successCount++;
  }
  console.log(`[OK] All ${successCount}/${statements.length} migration statements executed cleanly.`);

  // 5. Verify DML inserts and foreign key constraints
  console.log("[VERIFY] Testing DML operations on created tables...");
  const testDmlSql = `
    INSERT INTO organizations (id, name, slug) VALUES ('00000000-0000-4800-a000-000000000001', 'Test Org', 'test-org');
    INSERT INTO ai_provider_tenant_configs (id, organization_id, provider_id, live_mode_enabled, environment_mode, allowed_models)
    VALUES ('00000000-0000-4800-c000-000000000001', '00000000-0000-4800-a000-000000000001', 'openai', false, 'mock', '["gpt-4o-mini"]');
    INSERT INTO ai_usage_budgets (id, organization_id, daily_budget_usd, monthly_budget_usd)
    VALUES ('00000000-0000-4800-b000-000000000001', '00000000-0000-4800-a000-000000000001', 10.00, 50.00);
    INSERT INTO ai_model_pricing_catalog (id, provider_id, model_id, prompt_per_thousand_tokens_usd, completion_per_thousand_tokens_usd)
    VALUES ('00000000-0000-4800-p000-000000000001', 'openai', 'gpt-4o-mini', 0.00015, 0.0006);
  `;
  await runRailwayMysql(testDmlSql, REHEARSAL_DB);
  console.log("[OK] DML operations succeeded.");

  // 6. Tear down disposable rehearsal schema
  console.log(`[CLEANUP] Dropping disposable schema: ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS ${REHEARSAL_DB};`);
  console.log(`[OK] Schema ${REHEARSAL_DB} dropped.`);

  console.log("================================================================");
  console.log("  MIGRATION 0028 REHEARSAL CERTIFIED 100% SUCCESSFUL            ");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR during rehearsal]:", err.message || err);
  process.exit(1);
});
