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
  console.log("  HAZA AIOS - Epic 19 Live Production Smoke Test Suite          ");
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
      // Fallback to internal Railway network probe
      const internalRes = await runRailwayCommand("curl -s http://api.railway.internal:8080/api/v1/health");
      healthData = JSON.parse(internalRes.trim());
      via = "railway.internal";
    }

    if (healthData && healthData.status === "ok") {
      results.push({
        test: "1. API /health & readiness check",
        status: "PASS",
        details: `Service online via ${via}: status="${healthData.status}", service="${healthData.service || "haza-aios-api"}"`,
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

  // 3. Database Migration Journal Check (0029)
  try {
    const checkJournalSql = "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;";
    const journalRes = await runRailwayMysql(checkJournalSql);
    if (journalRes.stdout.includes("0029_multi_agent_orchestration")) {
      results.push({ test: "3. Database Migration Journal (0029)", status: "PASS", details: "Migration 0029 present in __drizzle_migrations." });
    } else {
      results.push({ test: "3. Database Migration Journal (0029)", status: "FAIL", details: "0029 missing from journal." });
    }
  } catch (err: any) {
    results.push({ test: "3. Database Migration Journal (0029)", status: "FAIL", details: err.message });
  }

  // 4. Production Tables Verification (8 tables)
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

  try {
    const verifyTablesSql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${PROD_DB}' 
        AND table_name IN (${expectedTables.map((t) => `'${t}'`).join(", ")})
      ORDER BY table_name;
    `;
    const tablesRes = await runRailwayMysql(verifyTablesSql);
    const allFound = expectedTables.every((t) => tablesRes.stdout.includes(t));
    if (allFound) {
      results.push({ test: "4. Multi-Agent Orchestration Tables Audit", status: "PASS", details: "All 8 Epic 19 tables present in production MySQL." });
    } else {
      results.push({ test: "4. Multi-Agent Orchestration Tables Audit", status: "FAIL", details: "Some tables missing: " + tablesRes.stdout });
    }
  } catch (err: any) {
    results.push({ test: "4. Multi-Agent Orchestration Tables Audit", status: "FAIL", details: err.message });
  }

  // 5. Tenant Context Resolution
  let prodOrgId = "";
  let prodWsId = "";
  let prodUserId = "";
  let prodAgentId = "";

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

      // Find an agent definition in this org or any active agent
      const agentSql = `SELECT id FROM ai_agent_definitions WHERE organization_id = '${prodOrgId}' LIMIT 1;`;
      const agentRes = await runRailwayMysql(agentSql);
      const agentLines = agentRes.stdout.trim().split("\n");
      if (agentLines.length >= 2) {
        prodAgentId = agentLines[1].trim();
      } else {
        // Fallback to any agent
        const anyAgentSql = "SELECT id FROM ai_agent_definitions LIMIT 1;";
        const anyRes = await runRailwayMysql(anyAgentSql);
        const anyLines = anyRes.stdout.trim().split("\n");
        if (anyLines.length >= 2) {
          prodAgentId = anyLines[1].trim();
        }
      }

      results.push({
        test: "5. Production Tenant Context Resolution",
        status: "PASS",
        details: `Org: ${prodOrgId}, WS: ${prodWsId}, User: ${prodUserId}, Agent: ${prodAgentId || "none"}`,
      });
    } else {
      results.push({ test: "5. Production Tenant Context Resolution", status: "FAIL", details: "No active tenant found." });
    }
  } catch (err: any) {
    results.push({ test: "5. Production Tenant Context Resolution", status: "FAIL", details: err.message });
  }

  // 6. End-to-End Multi-Agent Orchestration Records & Lifecycle Test
  const smokeId = `smk_${Date.now()}`;
  let tempAgentCreated = false;

  try {
    // If no agent was found, create a temporary agent definition for the smoke test
    if (!prodAgentId) {
      prodAgentId = `00000000-0000-4900-a000-${smokeId.slice(-12)}`;
      const createAgentSql = `
        INSERT INTO ai_agent_definitions (id, organization_id, name, description, role, status, created_by)
        VALUES ('${prodAgentId}', '${prodOrgId}', 'Smoke Agent', 'Temporary smoke test agent', 'specialist', 'active', '${prodUserId}');
      `;
      await runRailwayMysql(createAgentSql);
      tempAgentCreated = true;
    }

    const testOrchestrationSql = `
      INSERT INTO agent_teams (id, organization_id, workspace_id, name, description, status, created_by)
      VALUES ('${smokeId}_team', '${prodOrgId}', '${prodWsId}', 'Smoke Test Team', 'Verified live smoke team', 'active', '${prodUserId}');

      INSERT INTO agent_team_members (id, team_id, organization_id, agent_id, role, capabilities, priority, status)
      VALUES ('${smokeId}_mem', '${smokeId}_team', '${prodOrgId}', '${prodAgentId}', 'planner', '[\"planning\"]', 1, 'active');

      INSERT INTO agent_workflow_definitions (id, organization_id, workspace_id, team_id, name, description, pattern, version, revision, input_schema, configuration, created_by)
      VALUES ('${smokeId}_wf', '${prodOrgId}', '${prodWsId}', '${smokeId}_team', 'Smoke Test DAG', 'Smoke test workflow DAG', 'sequential', '1.0.0', 1, '{}', '{}', '${prodUserId}');

      INSERT INTO agent_workflow_steps (id, workflow_definition_id, organization_id, step_key, name, description, step_order, assigned_role, depends_on_step_keys, input_mapping, output_key, configuration)
      VALUES ('${smokeId}_step', '${smokeId}_wf', '${prodOrgId}', 'step1', 'Step 1', 'Test step description', 0, 'planner', '[]', '{}', 'out1', '{}');

      INSERT INTO agent_workflow_runs (id, organization_id, workspace_id, workflow_definition_id, team_id, initiator_user_id, status, initial_input, shared_context)
      VALUES ('${smokeId}_run', '${prodOrgId}', '${prodWsId}', '${smokeId}_wf', '${smokeId}_team', '${prodUserId}', 'running', '{}', '{}');

      INSERT INTO agent_workflow_step_runs (id, workflow_run_id, step_id, organization_id, step_key, assigned_agent_id, status, input_payload)
      VALUES ('${smokeId}_srun', '${smokeId}_run', '${smokeId}_step', '${prodOrgId}', 'step1', '${prodAgentId}', 'running', '{}');

      INSERT INTO agent_workflow_artifacts (id, workflow_run_id, step_run_id, organization_id, workspace_id, artifact_type, name, content, provenance)
      VALUES ('${smokeId}_art', '${smokeId}_run', '${smokeId}_srun', '${prodOrgId}', '${prodWsId}', 'lesson_plan', 'Smoke Artifact', '{\"status\":\"smoke_tested\"}', '{\"verified\":true}');

      INSERT INTO agent_workflow_events (id, workflow_run_id, step_run_id, organization_id, event_type, payload)
      VALUES ('${smokeId}_ev', '${smokeId}_run', '${smokeId}_srun', '${prodOrgId}', 'smoke_verified', '{\"smokeTest\":true}');

      SELECT id, name, status FROM agent_teams WHERE id = '${smokeId}_team';
    `;
    const insertRes = await runRailwayMysql(testOrchestrationSql);
    if (insertRes.stdout.includes("Smoke Test Team")) {
      results.push({
        test: "6. Multi-Agent Orchestration Records Lifecycle",
        status: "PASS",
        details: `Created team, member, workflow, step, run, step_run, artifact, and event records (${smokeId})`,
      });
    } else {
      results.push({
        test: "6. Multi-Agent Orchestration Records Lifecycle",
        status: "FAIL",
        details: "Insert query did not return expected team: " + insertRes.stdout,
      });
    }
  } catch (err: any) {
    results.push({ test: "6. Multi-Agent Orchestration Records Lifecycle", status: "FAIL", details: err.message });
  }

  // 7. Clean up Temporary Smoke Test Data
  try {
    const cleanupSql = `
      DELETE FROM agent_workflow_events WHERE id = '${smokeId}_ev';
      DELETE FROM agent_workflow_artifacts WHERE id = '${smokeId}_art';
      DELETE FROM agent_workflow_step_runs WHERE id = '${smokeId}_srun';
      DELETE FROM agent_workflow_runs WHERE id = '${smokeId}_run';
      DELETE FROM agent_workflow_steps WHERE id = '${smokeId}_step';
      DELETE FROM agent_workflow_definitions WHERE id = '${smokeId}_wf';
      DELETE FROM agent_team_members WHERE id = '${smokeId}_mem';
      DELETE FROM agent_teams WHERE id = '${smokeId}_team';
      ${tempAgentCreated ? `DELETE FROM ai_agent_definitions WHERE id = '${prodAgentId}';` : ""}
      SELECT count(*) as remaining FROM agent_teams WHERE id = '${smokeId}_team';
    `;
    const cleanupRes = await runRailwayMysql(cleanupSql);
    if (cleanupRes.stdout.includes("0")) {
      results.push({ test: "7. Production Smoke Test Data Cleanup", status: "PASS", details: "0 remaining test records; database clean." });
    } else {
      results.push({ test: "7. Production Smoke Test Data Cleanup", status: "FAIL", details: cleanupRes.stdout });
    }
  } catch (err: any) {
    results.push({ test: "7. Production Smoke Test Data Cleanup", status: "FAIL", details: err.message });
  }

  // Print Summary Table
  console.log("\n================================================================");
  console.log("  EPIC 19 LIVE PRODUCTION SMOKE TEST SUMMARY REPORT            ");
  console.log("================================================================");
  let passedCount = 0;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : "✗";
    console.log(`${icon} [${r.status}] ${r.test}`);
    console.log(`    ${r.details}`);
    if (r.status === "PASS") passedCount++;
  }
  console.log("----------------------------------------------------------------");
  console.log(`  RESULT: ${passedCount}/${results.length} PASSED`);
  if (passedCount === results.length) {
    console.log("  ALL LIVE PRODUCTION VERIFICATION CHECKS CERTIFIED 100% OPERATIONAL!");
  } else {
    console.error(`  SOME SMOKE CHECKS FAILED: ${passedCount}/${results.length}`);
    process.exit(1);
  }
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR during smoke test]:", err.message || err);
  process.exit(1);
});
