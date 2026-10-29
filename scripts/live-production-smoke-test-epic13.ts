import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const API_BASE = "https://api.haza-aios.com/api/v1";
const WEB_BASE = "https://www.haza-aios.com";

const USER_ID = "b99f5271-60a9-475c-9a37-a1ada249b11e"; // Mussawar Hussain
const ORG_A_ID = "52a786e9-9892-4187-8830-17d52ef91f7e"; // LUMS
const ORG_B_ID = "a2b5787d-8f4a-465e-b1e6-196776180548"; // Haseeb Hospital
const WORKSPACE_A_ID = "b28f6d7d-0146-4c41-b3a3-bd120081582c"; // LUMS Workspace
const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";

const SUFFIX = randomUUID().slice(0, 8);
const SESSION_ID = randomUUID();
const TOKEN = `smoke_epic13_${randomUUID().replace(/-/g, "")}`;
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");

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
      if (attempt < retries && (err.message.includes("can't verify your SSH key") || err.message.includes("Connection reset"))) {
        console.log(`  [RETRY ${attempt}/${retries}] Retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Exhausted retries");
}

type StepResult = {
  step: string;
  name: string;
  status: "PASS" | "FAIL";
  details?: string;
};

const results: StepResult[] = [];

function record(step: string, name: string, status: "PASS" | "FAIL", details?: string) {
  results.push({ step, name, status, details });
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`${icon} [${step}] ${name}${details ? ` - ${details}` : ""}`);
}

async function run() {
  console.log("==================================================================");
  console.log("HAZA-AIOS EPIC 13 — LIVE PRODUCTION SMOKE TEST SUITE");
  console.log(`Execution Time: ${new Date().toISOString()}`);
  console.log(`Suffix: ${SUFFIX}`);
  console.log("==================================================================");

  let createdAgentId: string | null = null;
  let duplicatedAgentId: string | null = null;
  let rev1Id: string | null = null;
  let rev2Id: string | null = null;

  try {
    // -------------------------------------------------------------
    // PREREQUISITE: Create authenticated session in production
    // -------------------------------------------------------------
    console.log("\n[SETUP] Creating temporary test session in production MySQL...");
    await runRailwayMysql(`INSERT INTO auth_sessions (id, user_id, token_hash, auth_session_status, remember_me, expires_at) VALUES ('${SESSION_ID}', '${USER_ID}', '${TOKEN_HASH}', 'active', 0, DATE_ADD(NOW(), INTERVAL 2 HOUR));`);

    // -------------------------------------------------------------
    // STEP 1: Web Landing Page & API Readiness
    // -------------------------------------------------------------
    const webRes = await fetch(WEB_BASE);
    const webHtml = await webRes.text();
    if (webRes.status === 200 && webHtml.includes("HAZA AIOS")) {
      record("1.1", "Web Landing Page Availability", "PASS", `HTTP 200 (${webHtml.length} bytes)`);
    } else {
      record("1.1", "Web Landing Page Availability", "FAIL", `Status ${webRes.status}`);
    }

    const readyRes = await fetch(`${API_BASE}/readiness`);
    const readyData = await readyRes.json();
    if (readyRes.status === 200 && readyData.status === "ready" && readyData.checks?.database === "up") {
      record("1.2", "API Readiness & Database Check", "PASS", `HTTP 200 status=${readyData.status} db=${readyData.checks.database}`);
    } else {
      record("1.2", "API Readiness & Database Check", "FAIL", `Status ${readyRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 2: Authenticated Session & Profile Verification
    // -------------------------------------------------------------
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const meData = await meRes.json();
    if (meRes.status === 200 && meData.user?.id === USER_ID) {
      record("2.1", "Production Authentication & Session Resolution", "PASS", `User: ${meData.user.email}`);
    } else {
      record("2.1", "Production Authentication & Session Resolution", "FAIL", `Status ${meRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 3: Builder Catalog Options
    // -------------------------------------------------------------
    const catRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/builder/catalog-options`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const catData = await catRes.json();
    const catOpts = catData.catalogOptions ?? catData;
    if (
      catRes.status === 200 &&
      Array.isArray(catOpts.providers) &&
      Array.isArray(catOpts.models) &&
      Array.isArray(catOpts.capabilities) &&
      Array.isArray(catOpts.tools)
    ) {
      record("3.1", "Builder Catalog Options Endpoint", "PASS", `Providers: ${catOpts.providers.length}, Models: ${catOpts.models.length}, Capabilities: ${catOpts.capabilities.length}, Tools: ${catOpts.tools.length}`);
    } else {
      record("3.1", "Builder Catalog Options Endpoint", "FAIL", `Status ${catRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 4: Create Custom Agent via Builder
    // -------------------------------------------------------------
    const initialConfig = {
      identity: {
        name: `Smoke Agent ${SUFFIX}`,
        agentKey: `smoke_agent_${SUFFIX}`,
        description: "Live production smoke test agent for Epic 13 verification",
        category: "Testing",
        icon: "🤖",
        tags: ["smoke", "epic13"],
      },
      model: {
        provider: "mock",
        modelSelection: "mock-gpt-4o",
        temperature: 0.5,
        maxTokens: 2048,
        timeoutSeconds: 45,
      },
      instructions: {
        role: "Production Quality Assurance Specialist",
        objectives: "Verify live builder capabilities without error",
        boundaryConstraints: "Never perform unverified actions",
        behavioralRules: "Report structured JSON test outcomes",
        outputFormat: "JSON",
        prohibitedActions: "Do not expose system internals",
        escalationRequirements: "Escalate critical anomalies immediately",
        systemInstructions: "You are an automated production test agent.",
      },
      capabilities: [],
      tools: [],
      knowledge: [],
      humanApproval: {
        policy: "risk_threshold",
        riskThreshold: "high",
        approverRoles: ["admin", "owner"],
        escalationTimeoutHours: 24,
        fallbackAction: "deny",
        sensitiveCapabilities: [],
      },
    };

    const createRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/builder/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_A_ID,
        configuration: initialConfig,
      }),
    });
    const createData = await createRes.json();
    if (createRes.status === 201 && createData.agent?.id && createData.revision?.id) {
      createdAgentId = createData.agent.id;
      rev1Id = createData.revision.id;
      record("4.1", "Create Custom Agent via Builder API", "PASS", `Agent ID: ${createdAgentId}, Rev 1 ID: ${rev1Id}`);
    } else {
      record("4.1", "Create Custom Agent via Builder API", "FAIL", `Status ${createRes.status}: ${JSON.stringify(createData)}`);
      throw new Error("Cannot proceed without created agent");
    }

    // -------------------------------------------------------------
    // STEP 5: Get Builder Context
    // -------------------------------------------------------------
    const ctxRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const ctxData = await ctxRes.json();
    if (
      ctxRes.status === 200 &&
      ctxData.agent?.id === createdAgentId &&
      (ctxData.draftRevision?.id === rev1Id || ctxData.activeRevision?.id === rev1Id)
    ) {
      record("5.1", "Get Builder Context (Agent + Revision State)", "PASS", `Draft Rev ID: ${ctxData.draftRevision?.id ?? "none"}`);
    } else {
      record("5.1", "Get Builder Context (Agent + Revision State)", "FAIL", `Status ${ctxRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 6: Real-Time Validation Engine
    // -------------------------------------------------------------
    // 6.1 Valid config
    const valGoodRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ configuration: initialConfig }),
    });
    const valGoodData = await valGoodRes.json();
    if (valGoodRes.status === 200 && valGoodData.valid === true && valGoodData.errors.length === 0) {
      record("6.1", "Validation Engine: Clean Valid Configuration", "PASS", "0 errors reported");
    } else {
      record("6.1", "Validation Engine: Clean Valid Configuration", "FAIL", `Errors: ${JSON.stringify(valGoodData.errors)}`);
    }

    // 6.2 Secret scanning detection (should reject leaked credentials key)
    const leakyConfig = JSON.parse(JSON.stringify(initialConfig));
    (leakyConfig.model as any).apiKey = "sk-proj-secret-token";
    const valLeakyRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ configuration: leakyConfig }),
    });
    const valLeakyData = await valLeakyRes.json();
    if (valLeakyRes.status === 200 && valLeakyData.valid === false && valLeakyData.errors.some((e: any) => e.message.toLowerCase().includes("secret"))) {
      record("6.2", "Validation Engine: Secret Leak Blocking", "PASS", "Successfully flagged credentials key");
    } else {
      record("6.2", "Validation Engine: Secret Leak Blocking", "FAIL", `Response: ${JSON.stringify(valLeakyData)}`);
    }

    // -------------------------------------------------------------
    // STEP 7: Safe Simulated Mock Preview
    // -------------------------------------------------------------
    const previewRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        testPrompt: "Analyze the current system telemetry and return status.",
        configuration: initialConfig,
      }),
    });
    const previewData = await previewRes.json();
    if (
      previewRes.status === 200 &&
      previewData.preview?.content &&
      previewData.preview?.simulated === true
    ) {
      record("7.1", "Safe Mock Preview (Zero AI API Cost)", "PASS", `Latency: ${previewData.preview.latencyMs}ms, Content snippet: ${previewData.preview.content.slice(0, 35)}...`);
    } else {
      record("7.1", "Safe Mock Preview (Zero AI API Cost)", "FAIL", `Status ${previewRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 8: Publish Initial Revision 1 (v1.0.0)
    // -------------------------------------------------------------
    const pub1Res = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        version: "1.0.0",
        changelog: "Initial release v1.0.0",
      }),
    });
    const pub1Data = await pub1Res.json();
    if (pub1Res.status === 200 && pub1Data.revision?.status === "published" && pub1Data.revision?.version === "1.0.0") {
      record("8.1", "Publish Initial Revision 1 (v1.0.0)", "PASS", `Active Revision ID: ${pub1Data.revision.id}`);
    } else {
      record("8.1", "Publish Initial Revision 1 (v1.0.0)", "FAIL", `Status ${pub1Res.status}`);
    }

    // -------------------------------------------------------------
    // STEP 9: Save Draft Revision 2 & Publish v1.1.0
    // -------------------------------------------------------------
    const draftConfig = JSON.parse(JSON.stringify(initialConfig));
    draftConfig.model.temperature = 0.8;
    draftConfig.instructions.objectives = "Updated objectives in revision 2";

    const draftRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/draft`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        configuration: draftConfig,
        version: "1.1.0-draft",
        changelog: "Updated temperature and objectives",
      }),
    });
    const draftData = await draftRes.json();
    if (draftRes.status === 200 && draftData.revision?.status === "draft" && draftData.revision?.revisionNumber === 2) {
      record("9.1", "Save New Draft Revision 2", "PASS", `Revision Number: ${draftData.revision.revisionNumber}`);
    } else {
      record("9.1", "Save New Draft Revision 2", "FAIL", `Status ${draftRes.status}`);
    }

    const pub2Res = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        version: "1.1.0",
        changelog: "Promoted revision 2 to v1.1.0",
      }),
    });
    const pub2Data = await pub2Res.json();
    if (pub2Res.status === 200 && pub2Data.revision?.status === "published" && pub2Data.revision?.version === "1.1.0") {
      rev2Id = pub2Data.revision.id;
      record("9.2", "Publish Revision 2 (v1.1.0)", "PASS", `Published Rev 2 ID: ${rev2Id}`);
    } else {
      record("9.2", "Publish Revision 2 (v1.1.0)", "FAIL", `Status ${pub2Res.status}`);
    }

    // -------------------------------------------------------------
    // STEP 10: Revision History & Diff Comparison
    // -------------------------------------------------------------
    const histRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/revisions`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const histData = await histRes.json();
    if (histRes.status === 200 && Array.isArray(histData.items) && histData.items.length >= 2) {
      record("10.1", "List Agent Revision History", "PASS", `Found ${histData.items.length} revisions`);
    } else {
      record("10.1", "List Agent Revision History", "FAIL", `Status ${histRes.status}`);
    }

    if (rev1Id && rev2Id) {
      const diffRes = await fetch(
        `${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/revisions/compare?baseRevisionId=${rev1Id}&targetRevisionId=${rev2Id}`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      const diffData = await diffRes.json();
      if (diffRes.status === 200 && Array.isArray(diffData.diffs) && diffData.diffs.length > 0) {
        record("10.2", "Visual Revision Diffing Engine", "PASS", `Found ${diffData.diffs.length} semantic diffs`);
      } else {
        record("10.2", "Visual Revision Diffing Engine", "FAIL", `Status ${diffRes.status}`);
      }
    }

    // -------------------------------------------------------------
    // STEP 11: Rollback / Restore Revision
    // -------------------------------------------------------------
    if (rev1Id) {
      const restoreRes = await fetch(
        `${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/revisions/${rev1Id}/restore`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}` },
        }
      );
      const restoreData = await restoreRes.json();
      if (restoreRes.status === 200 && restoreData.revision?.status === "draft") {
        record("11.1", "Rollback / Restore Previous Revision to Draft", "PASS", `Restored Draft Revision Number: ${restoreData.revision.revisionNumber}`);
      } else {
        record("11.1", "Rollback / Restore Previous Revision to Draft", "FAIL", `Status ${restoreRes.status}`);
      }
    }

    // -------------------------------------------------------------
    // STEP 12: Duplicate Agent
    // -------------------------------------------------------------
    const dupRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${createdAgentId}/builder/duplicate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_A_ID,
        newName: `Smoke Agent Copy ${SUFFIX}`,
        newAgentKey: `smoke_agent_copy_${SUFFIX}`,
      }),
    });
    const dupData = await dupRes.json();
    if (dupRes.status === 201 && dupData.agent?.id && dupData.revision?.revisionNumber === 1) {
      duplicatedAgentId = dupData.agent.id;
      record("12.1", "Duplicate Agent into Independent Fork", "PASS", `Duplicated Agent ID: ${duplicatedAgentId}`);
    } else {
      record("12.1", "Duplicate Agent into Independent Fork", "FAIL", `Status ${dupRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 13: Multi-Tenant Cross-Org Security Isolation
    // -------------------------------------------------------------
    const crossOrgRes = await fetch(
      `${API_BASE}/organizations/${ORG_B_ID}/agents/${createdAgentId}/builder`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (crossOrgRes.status === 403 || crossOrgRes.status === 404) {
      record("13.1", "Multi-Tenant Cross-Org Isolation", "PASS", `Access denied with HTTP ${crossOrgRes.status}`);
    } else {
      record("13.1", "Multi-Tenant Cross-Org Isolation", "FAIL", `Unexpected status ${crossOrgRes.status}`);
    }

  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Clean up test agents and sessions in production
    // -------------------------------------------------------------
    console.log("\n[CLEANUP] Purging smoke test data from production MySQL...");
    try {
      if (duplicatedAgentId) {
        await runRailwayMysql(`DELETE FROM ai_agent_definitions WHERE id = '${duplicatedAgentId}';`);
      }
      if (createdAgentId) {
        await runRailwayMysql(`DELETE FROM ai_agent_definitions WHERE id = '${createdAgentId}';`);
      }
      await runRailwayMysql(`DELETE FROM auth_sessions WHERE id = '${SESSION_ID}';`);
      console.log("Cleanup completed cleanly.");
    } catch (cleanErr) {
      console.error("Cleanup warning:", cleanErr);
    }
  }

  console.log("\n==================================================================");
  console.log("LIVE PRODUCTION SMOKE TEST SUMMARY");
  console.log("==================================================================");
  const total = results.length;
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`Total Checks: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error("\n❌ LIVE PRODUCTION SMOKE TESTS FAILED!");
    process.exit(1);
  } else {
    console.log("\n🚀 ALL LIVE PRODUCTION SMOKE TESTS PASSED (100%)!");
  }
}

run().catch((err) => {
  console.error("Fatal smoke test error:", err);
  process.exit(1);
});
