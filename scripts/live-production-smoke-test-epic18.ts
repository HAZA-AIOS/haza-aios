import { spawn } from "node:child_process";
import fs from "node:fs";

const API_BASE = "https://api.haza-aios.com";
const WEB_BASE = "https://web-production-76faf.up.railway.app";
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

async function runRailwayCommand(cmd: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
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
      cmd,
    ]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed (exit ${code}): ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Epic 18 Live Production Smoke Test Suite          ");
  console.log("  Target Public API: " + API_BASE);
  console.log("  Target Web: " + WEB_BASE);
  console.log("================================================================\n");

  const results: Array<{ test: string; status: "PASS" | "FAIL"; details: string }> = [];

  // 1. API Health & Readiness Check
  try {
    let healthData: any = null;
    let via = "public";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${API_BASE}/api/v1/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        healthData = await res.json();
      }
    } catch {
      // Fallback to internal Railway network probe (bypassing local ISP DNS routing to Cloudflare)
      const internalRes = await runRailwayCommand("curl -s http://api.railway.internal:8080/api/v1/health");
      healthData = JSON.parse(internalRes.trim());
      via = "railway.internal";
    }

    if (healthData && healthData.status === "ok") {
      results.push({
        test: "1. API /health & readiness check",
        status: "PASS",
        details: `Service online via ${via}: status="${healthData.status}", service="${healthData.service}"`,
      });
    } else {
      results.push({
        test: "1. API /health & readiness check",
        status: "FAIL",
        details: `Unexpected response: ${JSON.stringify(healthData)}`,
      });
    }
  } catch (err: any) {
    results.push({ test: "1. API /health & readiness check", status: "FAIL", details: err.message });
  }

  // 2. Web Frontend Check
  try {
    const res = await fetch(WEB_BASE);
    if (res.ok) {
      results.push({ test: "2. Web frontend root URL", status: "PASS", details: `HTTP ${res.status} OK` });
    } else {
      results.push({ test: "2. Web frontend root URL", status: "FAIL", details: `HTTP ${res.status}` });
    }
  } catch (err: any) {
    results.push({ test: "2. Web frontend root URL", status: "FAIL", details: err.message });
  }

  // 3. Production MySQL Schema Audit for Migration 0028 (5 tables)
  try {
    const sql = `
      SELECT table_name FROM information_schema.tables 
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
    const res = await runRailwayMysql(sql);
    const tables = res.stdout.trim().split("\n").map((l) => l.trim()).filter((l) => l && !l.toLowerCase().includes("table_name"));
    if (tables.length === 5) {
      results.push({ test: "3. Production MySQL Migration 0028 5 Tables", status: "PASS", details: `All 5 tables active: ${tables.join(", ")}` });
    } else {
      results.push({ test: "3. Production MySQL Migration 0028 5 Tables", status: "FAIL", details: `Found only ${tables.length} tables: ${tables.join(", ")}` });
    }
  } catch (err: any) {
    results.push({ test: "3. Production MySQL Migration 0028 5 Tables", status: "FAIL", details: err.message });
  }

  // 4. Verification of Seeded AI Model Pricing Catalog
  try {
    const sql = `
      SELECT model_id, prompt_per_thousand_tokens_usd, completion_per_thousand_tokens_usd, embedding_per_thousand_tokens_usd 
      FROM ai_model_pricing_catalog 
      ORDER BY model_id;
    `;
    const res = await runRailwayMysql(sql);
    const rows = res.stdout.trim().split("\n").filter((l) => l && !l.includes("model_id"));
    if (rows.length >= 4) {
      results.push({ test: "4. Pricing Catalog Seed Verification", status: "PASS", details: `Verified ${rows.length} pricing models cataloged.` });
    } else {
      results.push({ test: "4. Pricing Catalog Seed Verification", status: "FAIL", details: `Expected at least 4 catalog models, found: ${rows.length}` });
    }
  } catch (err: any) {
    results.push({ test: "4. Pricing Catalog Seed Verification", status: "FAIL", details: err.message });
  }

  // 5. Querying Production Organization and Workspace for Live Context Test
  let prodOrgId = "";
  let prodWsId = "";
  let prodUserId = "";
  try {
    const sql = `
      SELECT o.id as org_id, w.id as ws_id, u.id as user_id 
      FROM organizations o 
      INNER JOIN workspaces w ON w.organization_id = o.id 
      INNER JOIN users u ON u.id = o.owner_id 
      LIMIT 1;
    `;
    const res = await runRailwayMysql(sql);
    const lines = res.stdout.trim().split("\n");
    if (lines.length >= 2) {
      const parts = lines[1].trim().split(/\s+/);
      prodOrgId = parts[0];
      prodWsId = parts[1];
      prodUserId = parts[2];
      results.push({ test: "5. Production Tenant Context Resolution", status: "PASS", details: `Org: ${prodOrgId}, WS: ${prodWsId}, User: ${prodUserId}` });
    } else {
      results.push({ test: "5. Production Tenant Context Resolution", status: "FAIL", details: "No organization found in production." });
    }
  } catch (err: any) {
    results.push({ test: "5. Production Tenant Context Resolution", status: "FAIL", details: err.message });
  }

  // 6. Direct Production DML Test: Tenant Provider Config, Budget & Ledger Lifecycle
  const testConfigId = "00000000-0000-4800-9000-000000000001";
  const testBudgetId = "00000000-0000-4800-9000-000000000002";
  const testLedgerId = "00000000-0000-4800-9000-000000000003";
  const testAuditId = "00000000-0000-4800-9000-000000000004";

  try {
    const insertSql = `
      INSERT INTO ai_provider_tenant_configs 
        (id, organization_id, provider_id, live_mode_enabled, environment_mode, default_model, allowed_models, embedding_model, embedding_live_enabled, status, status_message, updated_by)
      VALUES 
        ('${testConfigId}', '${prodOrgId}', 'openai-smoke-test', false, 'mock', 'gpt-4o-mini', '["gpt-4o-mini"]', 'text-embedding-3-small', false, 'active', 'Live smoke test provider config', '${prodUserId}')
      ON DUPLICATE KEY UPDATE status = 'active';

      INSERT INTO ai_usage_budgets
        (id, organization_id, workspace_id, monthly_budget_usd, daily_budget_usd, per_request_max_cost_usd, current_month_spend_usd, current_day_spend_usd, enforce_hard_limit, status, updated_by)
      VALUES 
        ('${testBudgetId}', '${prodOrgId}', '${prodWsId}', 50.0000, 10.0000, 1.0000, 0.0000, 0.0000, true, 'active', '${prodUserId}')
      ON DUPLICATE KEY UPDATE status = 'active';

      INSERT INTO ai_usage_ledger
        (id, organization_id, workspace_id, provider_id, model_id, operation_type, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, latency_ms, finish_reason, is_live_mode, correlation_id)
      VALUES 
        ('${testLedgerId}', '${prodOrgId}', '${prodWsId}', 'openai-smoke-test', 'gpt-4o-mini', 'completion', 150, 45, 195, 0.000050, 240, 'stop', false, 'smoke-corr-epic18')
      ON DUPLICATE KEY UPDATE total_tokens = 195;

      INSERT INTO ai_provider_audit_logs
        (id, organization_id, provider_id, action, performed_by, new_state)
      VALUES 
        ('${testAuditId}', '${prodOrgId}', 'openai-smoke-test', 'provider_smoke_configured', '${prodUserId}', '{"mode":"mock"}')
      ON DUPLICATE KEY UPDATE action = 'provider_smoke_configured';
    `;
    await runRailwayMysql(insertSql);
    results.push({ test: "6. Production Entity Lifecycle (Config, Budget, Ledger, Audit)", status: "PASS", details: `Inserted test entities (${testConfigId}, ${testBudgetId}, ${testLedgerId}, ${testAuditId})` });
  } catch (err: any) {
    results.push({ test: "6. Production Entity Lifecycle (Config, Budget, Ledger, Audit)", status: "FAIL", details: err.message });
  }

  // 7. Verify Cross-Table Relational Integrity
  try {
    const verifySql = `
      SELECT l.model_id, l.total_tokens, b.monthly_budget_usd, c.provider_id, o.name as org_name
      FROM ai_usage_ledger l
      INNER JOIN ai_usage_budgets b ON b.organization_id = l.organization_id
      INNER JOIN ai_provider_tenant_configs c ON c.organization_id = l.organization_id AND c.provider_id = l.provider_id
      INNER JOIN organizations o ON o.id = l.organization_id
      WHERE l.id = '${testLedgerId}';
    `;
    const res = await runRailwayMysql(verifySql);
    if (res.stdout.includes("openai-smoke-test") && res.stdout.includes("gpt-4o-mini")) {
      results.push({ test: "7. Cross-Table Relational Integrity", status: "PASS", details: "Confirmed joins across ledger -> budgets -> provider_configs -> organizations." });
    } else {
      results.push({ test: "7. Cross-Table Relational Integrity", status: "FAIL", details: "Unable to verify relational integrity: " + res.stdout });
    }
  } catch (err: any) {
    results.push({ test: "7. Cross-Table Relational Integrity", status: "FAIL", details: err.message });
  }

  // 8. Clean up smoke test entities
  try {
    const cleanupSql = `
      DELETE FROM ai_provider_audit_logs WHERE id = '${testAuditId}';
      DELETE FROM ai_usage_ledger WHERE id = '${testLedgerId}';
      DELETE FROM ai_usage_budgets WHERE id = '${testBudgetId}';
      DELETE FROM ai_provider_tenant_configs WHERE id = '${testConfigId}';
    `;
    await runRailwayMysql(cleanupSql);
    results.push({ test: "8. Smoke Test Entity Cleanup", status: "PASS", details: "Cleanly deleted test records without foreign key violations." });
  } catch (err: any) {
    results.push({ test: "8. Smoke Test Entity Cleanup", status: "FAIL", details: err.message });
  }

  // 9. Fail-Closed Default Safety Check
  try {
    const checkLiveSql = `SELECT count(*) as live_count FROM ai_provider_tenant_configs WHERE live_mode_enabled = true;`;
    const res = await runRailwayMysql(checkLiveSql);
    const count = parseInt(res.stdout.trim().split("\n").pop() || "0", 10);
    if (count === 0) {
      results.push({ test: "9. Fail-Closed Default Safety Check", status: "PASS", details: "Verified 0 active live mode configurations in production." });
    } else {
      results.push({ test: "9. Fail-Closed Default Safety Check", status: "FAIL", details: `Unexpected active live mode configurations found: ${count}` });
    }
  } catch (err: any) {
    results.push({ test: "9. Fail-Closed Default Safety Check", status: "FAIL", details: err.message });
  }

  // Final Results Summary
  console.log("----------------------------------------------------------------");
  console.log("  SMOKE TEST EXECUTION RESULTS                                 ");
  console.log("----------------------------------------------------------------");
  let allPassed = true;
  for (const r of results) {
    const symbol = r.status === "PASS" ? "✓" : "✗";
    console.log(`[${symbol} ${r.status}] ${r.test} - ${r.details}`);
    if (r.status !== "PASS") allPassed = false;
  }
  console.log("----------------------------------------------------------------");

  if (allPassed) {
    console.log("\n>>> ALL 9 PRODUCTION SMOKE CRITERIA VERIFIED 100% SUCCESSFUL! <<<");
  } else {
    console.error("\n>>> ONE OR MORE SMOKE CHECKS FAILED! <<<");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR in smoke test]:", err.message || err);
  process.exit(1);
});
