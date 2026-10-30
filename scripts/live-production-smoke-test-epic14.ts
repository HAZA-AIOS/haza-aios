import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const API_BASE = "https://api.haza-aios.com/api/v1";
const WEB_BASE = "https://www.haza-aios.com";

const USER_ID = "b99f5271-60a9-475c-9a37-a1ada249b11e"; // Mussawar Hussain (Owner)
const ORG_A_ID = "52a786e9-9892-4187-8830-17d52ef91f7e"; // LUMS
const WORKSPACE_A_ID = "b28f6d7d-0146-4c41-b3a3-bd120081582c"; // LUMS Workspace
const LUMS_ADMIN_ROLE_ID = "90c6758d-37e5-4672-9c40-91cfa13453c1"; // LUMS Admin Role
const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";

const SUFFIX = randomUUID().slice(0, 8);
const SESSION_ID = randomUUID();
const TOKEN = `smoke_epic14_${randomUUID().replace(/-/g, "")}`;
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");

const REVIEWER_USER_ID = randomUUID();
const REVIEWER_MEMBERSHIP_ID = randomUUID();
const REVIEWER_MEMBERSHIP_ROLE_ID = randomUUID();
const REVIEWER_SESSION_ID = randomUUID();
const REVIEWER_TOKEN = `smoke_reviewer_${randomUUID().replace(/-/g, "")}`;
const REVIEWER_TOKEN_HASH = createHash("sha256").update(REVIEWER_TOKEN).digest("hex");
const REVIEWER_EMAIL = `smoke.reviewer.${SUFFIX}@haza-aios.internal`.toLowerCase();

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
        console.log(`  [RETRY ${attempt}/${retries}] Retrying MySQL connection in 2s...`);
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
  console.log("HAZA-AIOS EPIC 14 — LIVE PRODUCTION SMOKE TEST SUITE");
  console.log(`Execution Time: ${new Date().toISOString()}`);
  console.log(`Suffix: ${SUFFIX}`);
  console.log("==================================================================");

  let standardAgentId: string | null = null;
  let standardRunId: string | null = null;
  let approvalAgentId: string | null = null;
  let approvalRunId: string | null = null;
  let retryRunId: string | null = null;
  let approvalRequestId: string | null = null;
  let fatalError = false;

  try {
    // -------------------------------------------------------------
    // PREREQUISITE: Create authenticated sessions in production
    // -------------------------------------------------------------
    console.log("\n[SETUP] Creating primary user test session in production MySQL...");
    await runRailwayMysql(`INSERT INTO auth_sessions (id, user_id, token_hash, auth_session_status, remember_me, expires_at) VALUES ('${SESSION_ID}', '${USER_ID}', '${TOKEN_HASH}', 'active', 0, DATE_ADD(NOW(), INTERVAL 2 HOUR));`);

    console.log("[SETUP] Provisioning synthetic reviewer user, membership, and session in production MySQL...");
    await runRailwayMysql(`INSERT INTO users (id, email, normalized_email, password_hash, first_name, last_name, display_name, email_verified, user_status, created_at, updated_at) VALUES ('${REVIEWER_USER_ID}', '${REVIEWER_EMAIL}', '${REVIEWER_EMAIL}', 'locked_hash_smoke', 'Smoke', 'Reviewer', 'Smoke Reviewer', 1, 'active', NOW(3), NOW(3));`);
    await runRailwayMysql(`INSERT INTO organization_memberships (id, organization_id, user_id, organization_membership_role, organization_membership_status, joined_at, created_at, updated_at) VALUES ('${REVIEWER_MEMBERSHIP_ID}', '${ORG_A_ID}', '${REVIEWER_USER_ID}', 'Admin', 'active', NOW(3), NOW(3), NOW(3));`);
    await runRailwayMysql(`INSERT INTO membership_roles (id, membership_id, role_id, created_at) VALUES ('${REVIEWER_MEMBERSHIP_ROLE_ID}', '${REVIEWER_MEMBERSHIP_ID}', '${LUMS_ADMIN_ROLE_ID}', NOW(3));`);
    await runRailwayMysql(`INSERT INTO auth_sessions (id, user_id, token_hash, auth_session_status, remember_me, expires_at) VALUES ('${REVIEWER_SESSION_ID}', '${REVIEWER_USER_ID}', '${REVIEWER_TOKEN_HASH}', 'active', 0, DATE_ADD(NOW(), INTERVAL 2 HOUR));`);

    // -------------------------------------------------------------
    // STEP 1: Web Landing Page & API Readiness
    // -------------------------------------------------------------
    const webRes = await fetch(WEB_BASE);
    const webHtml = await webRes.text();
    if (webRes.status === 200 && (webHtml.includes("HAZA AIOS") || webHtml.includes("haza"))) {
      record("1.1", "Web Landing Page Availability", "PASS", `HTTP 200 (${webHtml.length} bytes)`);
    } else {
      record("1.1", "Web Landing Page Availability", "FAIL", `Status ${webRes.status}`);
    }

    const healthRes = await fetch(`${API_BASE}/health`);
    const healthData = await healthRes.json();
    if (healthRes.status === 200 && healthData.status === "ok") {
      record("1.2", "API Health Check (/health)", "PASS", `HTTP 200 status=${healthData.status} version=${healthData.version}`);
    } else {
      record("1.2", "API Health Check (/health)", "FAIL", `Status ${healthRes.status}`);
    }

    const readyRes = await fetch(`${API_BASE}/readiness`);
    const readyData = await readyRes.json();
    if (readyRes.status === 200 && readyData.status === "ready" && readyData.checks?.database === "up") {
      record("1.3", "API Readiness & Database Check (/readiness)", "PASS", `HTTP 200 status=${readyData.status} db=${readyData.checks.database}`);
    } else {
      record("1.3", "API Readiness & Database Check (/readiness)", "FAIL", `Status ${readyRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 2: Authenticated Sessions Verification
    // -------------------------------------------------------------
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const meData = await meRes.json();
    if (meRes.status === 200 && meData.user?.id === USER_ID) {
      record("2.1", "Primary Requester Session Resolution", "PASS", `User: ${meData.user.email}`);
    } else {
      record("2.1", "Primary Requester Session Resolution", "FAIL", `Status ${meRes.status}`);
    }

    const revMeRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${REVIEWER_TOKEN}` },
    });
    const revMeData = await revMeRes.json();
    if (revMeRes.status === 200 && revMeData.user?.id === REVIEWER_USER_ID) {
      record("2.2", "Secondary Reviewer Session Resolution", "PASS", `Reviewer: ${revMeData.user.email}`);
    } else {
      record("2.2", "Secondary Reviewer Session Resolution", "FAIL", `Status ${revMeRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 3: Create Smoke Test Agents via Builder API & Activate
    // -------------------------------------------------------------
    const standardConfig = {
      identity: {
        name: `Smoke Runtime Agent ${SUFFIX}`,
        agentKey: `smoke_runtime_${SUFFIX}`,
        description: "Production runtime execution verification agent",
        category: "Testing",
        icon: "⚡",
        tags: ["smoke", "epic14", "runtime"],
      },
      model: {
        provider: "mock",
        modelSelection: "mock-gpt-4o",
        temperature: 0.2,
        maxTokens: 1024,
        timeoutSeconds: 30,
      },
      instructions: {
        role: "Production Runtime Verifier",
        objectives: "Execute test prompts and output structured results",
        boundaryConstraints: "Zero external dependencies",
        behavioralRules: "Deterministic mock responses only",
        outputFormat: "JSON",
        prohibitedActions: "None",
        escalationRequirements: "None",
        systemInstructions: "You are an automated production test agent.",
      },
      capabilities: [],
      tools: [],
      knowledge: [],
      humanApproval: {
        policy: "never",
        riskThreshold: "high",
        approverRoles: ["admin"],
        escalationTimeoutHours: 24,
        fallbackAction: "deny",
        sensitiveCapabilities: [],
      },
    };

    const createStdRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/builder/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_A_ID,
        configuration: standardConfig,
      }),
    });
    const createStdData = await createStdRes.json();
    if (createStdRes.status === 201 && createStdData.agent?.id) {
      standardAgentId = createStdData.agent.id;
      record("3.1", "Standard Agent Provisioning", "PASS", `Agent ID: ${standardAgentId}`);
    } else {
      record("3.1", "Standard Agent Provisioning", "FAIL", `Status ${createStdRes.status}`);
      throw new Error("Failed to create standard agent");
    }

    // Activate standard agent
    await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${standardAgentId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ status: "active" }),
    });

    // Agent requiring approval
    const approvalConfig = {
      ...standardConfig,
      identity: {
        ...standardConfig.identity,
        name: `Smoke Approval Agent ${SUFFIX}`,
        agentKey: `smoke_approval_${SUFFIX}`,
      },
      humanApproval: {
        policy: "risk_threshold",
        riskThreshold: "low",
        approverRoles: ["admin", "owner"],
        escalationTimeoutHours: 24,
        fallbackAction: "deny",
        sensitiveCapabilities: ["action:financial_transfer"],
      },
    };

    const createApprRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/builder/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_A_ID,
        configuration: approvalConfig,
      }),
    });
    const createApprData = await createApprRes.json();
    if (createApprRes.status === 201 && createApprData.agent?.id) {
      approvalAgentId = createApprData.agent.id;
      record("3.2", "Approval-Required Agent Provisioning", "PASS", `Agent ID: ${approvalAgentId}`);
    } else {
      record("3.2", "Approval-Required Agent Provisioning", "FAIL", `Status ${createApprRes.status}`);
      throw new Error("Failed to create approval agent");
    }

    // Configure approval policy on approval agent
    await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${approvalAgentId}/configuration`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        configuration: { temperature: 0.5 },
        humanApprovalPolicy: {
          required: true,
          approverRoles: ["admin", "owner"],
          escalationTimeoutHours: 24,
        },
      }),
    });

    // Activate approval agent
    await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${approvalAgentId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ status: "active" }),
    });

    // -------------------------------------------------------------
    // STEP 4: Enqueue Standard Run
    // -------------------------------------------------------------
    const enqueueRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${standardAgentId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        input: { prompt: "Execute telemetry verification run in production" },
        metadata: { testMode: true },
      }),
    });
    const enqueueData = await enqueueRes.json();
    if (enqueueRes.status === 201 && enqueueData.run?.id) {
      standardRunId = enqueueData.run.id;
      const r = enqueueData.run;
      const statusVal = r.status || r.agentRunStatus;
      if (statusVal === "queued" && r.attemptCount === 0) {
        record("4.1", "Enqueue Standard Run", "PASS", `Run ID: ${standardRunId}, status=${statusVal}`);
      } else {
        record("4.1", "Enqueue Standard Run", "FAIL", `Invalid initial state: ${JSON.stringify(r)}`);
      }
    } else {
      record("4.1", "Enqueue Standard Run", "FAIL", `Status ${enqueueRes.status}: ${JSON.stringify(enqueueData)}`);
      throw new Error("Failed to enqueue standard run");
    }

    // -------------------------------------------------------------
    // STEP 5: Worker Tick Execution & Completion
    // -------------------------------------------------------------
    const workerId = `smoke-worker-${SUFFIX}`;
    const tickRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/runtime/worker/tick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ workerId }),
    });
    const tickData = await tickRes.json();
    if (tickRes.status === 200 && tickData.executed === true && tickData.run?.status === "completed") {
      record("5.1", "Worker Execution Tick", "PASS", `Worker: ${workerId}, Run status: ${tickData.run.status}`);
    } else if (tickRes.status === 200 && Array.isArray(tickData.results)) {
      const match = tickData.results.find((res: any) => res.runId === standardRunId);
      if (match && match.status === "completed") {
        record("5.1", "Worker Execution Tick", "PASS", `Worker: ${workerId}, Run status: ${match.status}`);
      } else {
        record("5.1", "Worker Execution Tick", "FAIL", `Run not completed: ${JSON.stringify(match ?? tickData)}`);
      }
    } else {
      record("5.1", "Worker Execution Tick", "FAIL", `Status ${tickRes.status}: ${JSON.stringify(tickData)}`);
    }

    // Fetch run details
    const runDetailsRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/runs/${standardRunId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const runDetailsData = await runDetailsRes.json();
    const runStatus = runDetailsData.run?.status || runDetailsData.run?.agentRunStatus;
    if (runDetailsRes.status === 200 && runStatus === "completed") {
      record("5.2", "Run Details & Output Payload", "PASS", `Output: ${JSON.stringify(runDetailsData.run.output || runDetailsData.run.outputPayload).slice(0, 50)}...`);
    } else {
      record("5.2", "Run Details & Output Payload", "FAIL", `Status ${runDetailsRes.status}, runStatus=${runStatus}`);
    }

    // -------------------------------------------------------------
    // STEP 6: Attempt History & Lineage
    // -------------------------------------------------------------
    const attemptsRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/runs/${standardRunId}/attempts`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const attemptsData = await attemptsRes.json();
    if (attemptsRes.status === 200 && Array.isArray(attemptsData.attempts) && attemptsData.attempts.length >= 1) {
      const att = attemptsData.attempts[0];
      record("6.1", "Attempt Lineage Tracking", "PASS", `Attempt #${att.attemptNumber}, status=${att.status}, duration=${att.durationMs ?? 0}ms`);
    } else {
      record("6.1", "Attempt Lineage Tracking", "FAIL", `Status ${attemptsRes.status}: ${JSON.stringify(attemptsData)}`);
    }

    // -------------------------------------------------------------
    // STEP 7: Event Stream Timeline
    // -------------------------------------------------------------
    const eventsRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/runs/${standardRunId}/events`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const eventsData = await eventsRes.json();
    if (eventsRes.status === 200 && Array.isArray(eventsData.events) && eventsData.events.length >= 3) {
      const types = eventsData.events.map((e: any) => e.eventType);
      record("7.1", "Execution Timeline Events", "PASS", `Events recorded: ${types.join(" -> ")}`);
    } else {
      record("7.1", "Execution Timeline Events", "FAIL", `Status ${eventsRes.status}: ${JSON.stringify(eventsData)}`);
    }

    // -------------------------------------------------------------
    // STEP 8: Token & Cost Attribution Accounting
    // -------------------------------------------------------------
    const usageRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/runs/${standardRunId}/usage`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const usageData = await usageRes.json();
    const usageList = Array.isArray(usageData.usage) ? usageData.usage : [usageData.usage].filter(Boolean);
    if (usageRes.status === 200 && usageList.length > 0 && usageList[0].provider === "mock" && usageList[0].totalTokens > 0) {
      record("8.1", "Token & Cost Attribution Accounting", "PASS", `Provider: ${usageList[0].provider}, Tokens: ${usageList[0].totalTokens}, Cost: ${usageList[0].costMicros}µs`);
    } else {
      record("8.1", "Token & Cost Attribution Accounting", "FAIL", `Status ${usageRes.status}: ${JSON.stringify(usageData)}`);
    }

    // -------------------------------------------------------------
    // STEP 9: Human Approval & Separation of Duties
    // -------------------------------------------------------------
    // 9.1 Enqueue run with autoExecute on approval agent
    const appEnqueueRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${approvalAgentId}/runs?autoExecute=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        input: { prompt: "Generate sensitive exam materials" },
      }),
    });
    const appEnqueueData = await appEnqueueRes.json();
    approvalRunId = appEnqueueData.run?.id;
    const initialAppStatus = appEnqueueData.run?.status || appEnqueueData.run?.agentRunStatus;
    if (appEnqueueRes.status === 201 && initialAppStatus === "awaiting_approval") {
      record("9.1", "Enqueue Approval Run (Paused)", "PASS", `Run ID: ${approvalRunId}, status=${initialAppStatus}`);
    } else {
      record("9.1", "Enqueue Approval Run (Paused)", "FAIL", `Status ${appEnqueueRes.status}: ${JSON.stringify(appEnqueueData)}`);
    }

    // 9.2 Fetch Approval Request from Inbox
    const inboxRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/approvals?status=pending`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const inboxData = await inboxRes.json();
    const appReq = (inboxData.approvals ?? []).find((a: any) => a.runId === approvalRunId);
    if (appReq) {
      approvalRequestId = appReq.id;
      record("9.2", "Approval Inbox Query", "PASS", `Approval ID: ${approvalRequestId}, Risk: ${appReq.riskLevel}`);
    } else {
      record("9.2", "Approval Inbox Query", "FAIL", `Approval request not found in inbox: ${JSON.stringify(inboxData)}`);
      throw new Error("Missing approval request");
    }

    // 9.3 Separation of Duties: Requester attempts to approve own request -> MUST FAIL (403)
    const selfApproveRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/approvals/${approvalRequestId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`, // Requester token
      },
      body: JSON.stringify({
        reason: "Self approval attempt should be rejected",
      }),
    });
    const selfApproveData = await selfApproveRes.json();
    if (selfApproveRes.status === 403) {
      record("9.3", "Separation of Duties Policy Enforcement", "PASS", `Blocked self-approval with HTTP 403 (${selfApproveData.error?.code || "FORBIDDEN"})`);
    } else {
      record("9.3", "Separation of Duties Policy Enforcement", "FAIL", `Expected 403, got ${selfApproveRes.status}: ${JSON.stringify(selfApproveData)}`);
    }

    // 9.4 Authorized Decision: Independent Reviewer approves
    const revApproveRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/approvals/${approvalRequestId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${REVIEWER_TOKEN}`, // Reviewer token
      },
      body: JSON.stringify({
        reason: "Exam generation authorized by Department Head",
      }),
    });
    const revApproveData = await revApproveRes.json();
    if (revApproveRes.status === 200) {
      record("9.4", "Authorized Independent Approval Decision", "PASS", `Approved by Admin Reviewer`);
    } else {
      record("9.4", "Authorized Independent Approval Decision", "FAIL", `Status ${revApproveRes.status}: ${JSON.stringify(revApproveData)}`);
    }

    // 9.5 Verify run resumes and completes
    const appDoneRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/runs/${approvalRunId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const appDoneData = await appDoneRes.json();
    const appDoneStatus = appDoneData.run?.status || appDoneData.run?.agentRunStatus;
    if (appDoneRes.status === 200 && appDoneStatus === "completed") {
      record("9.5", "Post-Approval Automatic Run Completion", "PASS", `Status: ${appDoneStatus}`);
    } else {
      record("9.5", "Post-Approval Automatic Run Completion", "FAIL", `Status: ${appDoneStatus}`);
    }

    // -------------------------------------------------------------
    // STEP 10: Cancellation & Manual Retry
    // -------------------------------------------------------------
    // 10.1 Enqueue run for cancel/retry
    const cancelRunRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${standardAgentId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ input: "Run to be cancelled" }),
    });
    const cancelRunData = await cancelRunRes.json();
    retryRunId = cancelRunData.run?.id;

    // 10.2 Cancel run
    const doCancelRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/runs/${retryRunId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ reason: "Smoke test manual cancellation verification" }),
    });
    const doCancelData = await doCancelRes.json();
    const cancelStatus = doCancelData.run?.status || doCancelData.run?.agentRunStatus;
    if (doCancelRes.status === 200 && cancelStatus === "cancelled") {
      record("10.1", "Run Cancellation", "PASS", `Run ID: ${retryRunId}, status=${cancelStatus}`);
    } else {
      record("10.1", "Run Cancellation", "FAIL", `Status ${doCancelRes.status}: ${JSON.stringify(doCancelData)}`);
    }

    // 10.3 Retry run
    const doRetryRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/runs/${retryRunId}/retry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({}),
    });
    const doRetryData = await doRetryRes.json();
    const retryStatus = doRetryData.run?.status || doRetryData.run?.agentRunStatus;
    if (doRetryRes.status === 200 && (retryStatus === "completed" || retryStatus === "queued")) {
      record("10.2", "Manual Run Retry", "PASS", `Retried status=${retryStatus}`);
    } else {
      record("10.2", "Manual Run Retry", "FAIL", `Status ${doRetryRes.status}: ${JSON.stringify(doRetryData)}`);
    }

    // -------------------------------------------------------------
    // STEP 11: Real-Time Runtime Monitoring Aggregations
    // -------------------------------------------------------------
    const monRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/runtime/monitoring`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const monData = await monRes.json();
    const metrics = monData.metrics ?? monData;
    if (
      monRes.status === 200 &&
      (typeof metrics.completedLast24h === "number" || typeof metrics.totalRuns === "number")
    ) {
      record("11.1", "Runtime Monitoring Telemetry Endpoint", "PASS", `CompletedLast24h: ${metrics.completedLast24h ?? metrics.totalRuns}, SuccessRate: ${metrics.successRatePercentage ?? 100}%`);
    } else {
      record("11.1", "Runtime Monitoring Telemetry Endpoint", "FAIL", `Status ${monRes.status}: ${JSON.stringify(monData)}`);
    }

    // -------------------------------------------------------------
    // STEP 12: Existing SIS & Marketplace Catalog Health Check
    // -------------------------------------------------------------
    const mktRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/catalog`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (mktRes.status === 200) {
      record("12.1", "Marketplace Catalog Endpoint", "PASS", "HTTP 200 Marketplace catalog operational");
    } else {
      record("12.1", "Marketplace Catalog Endpoint", "FAIL", `Status ${mktRes.status}`);
    }

    const tplRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/templates`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (tplRes.status === 200) {
      record("12.2", "Agent Templates Catalog Endpoint", "PASS", "HTTP 200 Templates catalog operational");
    } else {
      record("12.2", "Agent Templates Catalog Endpoint", "FAIL", `Status ${tplRes.status}`);
    }

  } catch (error: any) {
    fatalError = true;
    console.error("\n[ERROR] Live Smoke Test interrupted:", error.message);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log("\n[CLEANUP] Cleaning up synthetic test artifacts in production MySQL...");
    try {
      if (approvalRequestId) {
        await runRailwayMysql(`DELETE FROM ai_agent_approval_decisions WHERE approval_request_id = '${approvalRequestId}';`);
        await runRailwayMysql(`DELETE FROM ai_agent_approval_requests WHERE id = '${approvalRequestId}';`);
      }
      const runIds = [standardRunId, approvalRunId, retryRunId].filter(Boolean);
      for (const rId of runIds) {
        await runRailwayMysql(`DELETE FROM ai_agent_messages WHERE agent_run_id = '${rId}';`);
        await runRailwayMysql(`DELETE FROM ai_agent_runtime_usage WHERE run_id = '${rId}';`);
        await runRailwayMysql(`DELETE FROM ai_agent_run_events WHERE run_id = '${rId}';`);
        await runRailwayMysql(`DELETE FROM ai_agent_run_attempts WHERE run_id = '${rId}';`);
        await runRailwayMysql(`DELETE FROM ai_agent_runs WHERE id = '${rId}';`);
      }
      const agentIds = [standardAgentId, approvalAgentId].filter(Boolean);
      for (const aId of agentIds) {
        await runRailwayMysql(`DELETE FROM ai_agent_configuration_revisions WHERE agent_id = '${aId}';`);
        await runRailwayMysql(`DELETE FROM ai_agent_definitions WHERE id = '${aId}';`);
      }
      await runRailwayMysql(`DELETE FROM auth_sessions WHERE id IN ('${SESSION_ID}', '${REVIEWER_SESSION_ID}');`);
      await runRailwayMysql(`DELETE FROM membership_roles WHERE id = '${REVIEWER_MEMBERSHIP_ROLE_ID}';`);
      await runRailwayMysql(`DELETE FROM organization_memberships WHERE id = '${REVIEWER_MEMBERSHIP_ID}';`);
      await runRailwayMysql(`DELETE FROM users WHERE id = '${REVIEWER_USER_ID}';`);
      console.log("[CLEANUP] Complete.");
    } catch (cleanupErr) {
      console.warn("[CLEANUP WARNING] Cleanup encountered error:", cleanupErr);
    }
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n==================================================================");
  console.log("SMOKE TEST RESULTS SUMMARY");
  console.log("==================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`TOTAL CHECKS: ${total}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);
  console.log("==================================================================");

  if (fatalError || failed > 0 || total === 0) {
    console.error(`\n❌ Live smoke tests failed (total: ${total}, passed: ${passed}, failed: ${failed}).`);
    process.exit(1);
  } else {
    console.log("\n🎉 ALL LIVE PRODUCTION SMOKE TESTS PASSED CLEANLY!");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
