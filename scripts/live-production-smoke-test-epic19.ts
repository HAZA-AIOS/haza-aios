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

async function checkUrl(url: string, description: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    console.log(`[HTTP] ${description}: ${url} -> Status ${res.status} ${res.statusText}`);
    return res.status >= 200 && res.status < 400;
  } catch (err: any) {
    console.error(`[FAIL] ${description} unreachable: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Epic 19 Live Production Smoke Test Suite          ");
  console.log("  Target Public API: " + API_BASE);
  console.log("  Target Web: " + WEB_BASE);
  console.log("================================================================");

  let passedChecks = 0;
  const totalChecks = 7;

  // 1. API Health Check
  console.log("\n--- [CHECK 1/7] Production API Health ---");
  const apiHealthy = await checkUrl(`${API_BASE}/health`, "API Health");
  if (apiHealthy) passedChecks++;

  // 2. Web Frontend Check
  console.log("\n--- [CHECK 2/7] Production Web Frontend ---");
  const webHealthy = await checkUrl(WEB_BASE, "Web Landing Page");
  if (webHealthy) passedChecks++;

  // 3. Database Migration Journal Check
  console.log("\n--- [CHECK 3/7] Database Migration Journal (0029) ---");
  const checkJournalSql = "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;";
  const journalRes = await runRailwayMysql(checkJournalSql);
  console.log(journalRes.stdout.trim());
  if (journalRes.stdout.includes("0029_multi_agent_orchestration")) {
    console.log("[PASS] Migration 0029 is recorded in __drizzle_migrations.");
    passedChecks++;
  } else {
    console.error("[FAIL] Migration 0029 not found in journal!");
  }

  // 4. Production Tables Verification (8 tables)
  console.log("\n--- [CHECK 4/7] Multi-Agent Orchestration Tables Audit ---");
  const expectedTables = [
    "agent_teams",
    "agent_team_members",
    "agent_workflow_definitions",
    "agent_workflow_steps",
    "agent_workflow_runs",
    "agent_workflow_step_runs",
    "agent_workflow_artifacts",
    "agent_workflow_events",
  ];

  const verifyTablesSql = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = '${PROD_DB}' 
      AND table_name IN (${expectedTables.map((t) => `'${t}'`).join(", ")})
    ORDER BY table_name;
  `;
  const tablesRes = await runRailwayMysql(verifyTablesSql);
  console.log(tablesRes.stdout.trim());
  const allTablesFound = expectedTables.every((t) => tablesRes.stdout.includes(t));
  if (allTablesFound) {
    console.log("[PASS] All 8 Epic 19 tables verified present in production MySQL.");
    passedChecks++;
  } else {
    console.error("[FAIL] Some Epic 19 tables missing from production schema!");
  }

  // 5. Query Active Tenant Context
  console.log("\n--- [CHECK 5/7] Active Tenant Context ---");
  const queryTenantSql = "SELECT id, name, slug FROM organizations LIMIT 1;";
  const tenantRes = await runRailwayMysql(queryTenantSql);
  console.log(tenantRes.stdout.trim());
  if (tenantRes.stdout.includes("id")) {
    console.log("[PASS] Active organization tenant context verified.");
    passedChecks++;
  } else {
    console.error("[FAIL] No active organization found!");
  }

  // 6. Test Team & Workflow Creation / Referential Integrity
  console.log("\n--- [CHECK 6/7] End-to-End Orchestration Records & Foreign Keys ---");
  const smokeId = `smoke_${Date.now()}`;
  const testOrchestrationSql = `
    SELECT id INTO @orgId FROM organizations LIMIT 1;
    SELECT id INTO @wsId FROM workspaces WHERE organization_id = @orgId LIMIT 1;
    SELECT id INTO @userId FROM users LIMIT 1;
    SELECT id INTO @agentId FROM ai_agent_definitions WHERE organization_id = @orgId LIMIT 1;

    INSERT INTO agent_teams (id, organization_id, workspace_id, name, description, status, created_by)
    VALUES ('${smokeId}_team', @orgId, @wsId, 'Smoke Test Team', 'Verified live', 'active', @userId);

    INSERT INTO agent_team_members (id, team_id, organization_id, agent_id, role, priority, status)
    VALUES ('${smokeId}_mem', '${smokeId}_team', @orgId, @agentId, 'planner', 1, 'active');

    INSERT INTO agent_workflow_definitions (id, organization_id, workspace_id, team_id, name, description, pattern, version, revision, created_by)
    VALUES ('${smokeId}_wf', @orgId, @wsId, '${smokeId}_team', 'Smoke Test DAG', 'Test DAG', 'sequential', '1.0.0', 1, @userId);

    INSERT INTO agent_workflow_steps (id, workflow_definition_id, organization_id, step_key, name, description, step_order, assigned_role, output_key)
    VALUES ('${smokeId}_step', '${smokeId}_wf', @orgId, 'step1', 'Step 1', 'Test step description', 0, 'planner', 'out1');

    INSERT INTO agent_workflow_runs (id, organization_id, workspace_id, workflow_definition_id, team_id, initiator_user_id, status)
    VALUES ('${smokeId}_run', @orgId, @wsId, '${smokeId}_wf', '${smokeId}_team', @userId, 'running');

    INSERT INTO agent_workflow_step_runs (id, workflow_run_id, step_id, organization_id, step_key, assigned_agent_id, status)
    VALUES ('${smokeId}_srun', '${smokeId}_run', '${smokeId}_step', @orgId, 'step1', @agentId, 'running');

    INSERT INTO agent_workflow_artifacts (id, workflow_run_id, step_run_id, organization_id, workspace_id, artifact_type, name, content, provenance)
    VALUES ('${smokeId}_art', '${smokeId}_run', '${smokeId}_srun', @orgId, @wsId, 'lesson_plan', 'Smoke Artifact', '{\"status\":\"smoke_tested\"}', '{\"verified\":true}');

    INSERT INTO agent_workflow_events (id, workflow_run_id, step_run_id, organization_id, event_type, payload)
    VALUES ('${smokeId}_ev', '${smokeId}_run', '${smokeId}_srun', @orgId, 'smoke_verified', '{\"smokeTest\":true}');

    SELECT id, name, status FROM agent_teams WHERE id = '${smokeId}_team';
  `;
  const insertRes = await runRailwayMysql(testOrchestrationSql);
  console.log(insertRes.stdout.trim());
  if (insertRes.stdout.includes("Smoke Test Team")) {
    console.log("[PASS] Successfully created and verified multi-agent orchestration records across all 8 tables.");
    passedChecks++;
  } else {
    console.error("[FAIL] Multi-agent orchestration test records insertion failed!");
  }

  // 7. Clean up Smoke Test Data
  console.log("\n--- [CHECK 7/7] Clean up Temporary Smoke Test Data ---");
  const cleanupSql = `
    DELETE FROM agent_workflow_events WHERE id = '${smokeId}_ev';
    DELETE FROM agent_workflow_artifacts WHERE id = '${smokeId}_art';
    DELETE FROM agent_workflow_step_runs WHERE id = '${smokeId}_srun';
    DELETE FROM agent_workflow_runs WHERE id = '${smokeId}_run';
    DELETE FROM agent_workflow_steps WHERE id = '${smokeId}_step';
    DELETE FROM agent_workflow_definitions WHERE id = '${smokeId}_wf';
    DELETE FROM agent_team_members WHERE id = '${smokeId}_mem';
    DELETE FROM agent_teams WHERE id = '${smokeId}_team';
    SELECT count(*) as remaining FROM agent_teams WHERE id = '${smokeId}_team';
  `;
  const cleanupRes = await runRailwayMysql(cleanupSql);
  console.log(cleanupRes.stdout.trim());
  if (cleanupRes.stdout.includes("0")) {
    console.log("[PASS] Smoke test data cleanly removed from production.");
    passedChecks++;
  } else {
    console.error("[FAIL] Cleanup did not confirm 0 remaining test records!");
  }

  console.log("\n================================================================");
  console.log(`  EPIC 19 SMOKE TEST RESULTS: ${passedChecks}/${totalChecks} PASSED`);
  if (passedChecks === totalChecks) {
    console.log("  ALL LIVE PRODUCTION CHECKS CERTIFIED 100% OPERATIONAL!       ");
  } else {
    console.error(`  SOME CHECKS FAILED: ${passedChecks}/${totalChecks}`);
    process.exit(1);
  }
  console.log("================================================================");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR during smoke test]:", err.message || err);
  process.exit(1);
});

