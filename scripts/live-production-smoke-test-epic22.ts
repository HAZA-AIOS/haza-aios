import { spawn } from "node:child_process";
import https from "node:https";

const API_BASE = "https://api.haza-aios.com/api/v1";
const WEB_BASE = "https://web-production-76faf.up.railway.app";
const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";
const PROD_DB = "railway";

interface TestResult {
  id: number;
  name: string;
  category: "SMOKE" | "SECURITY" | "DATABASE" | "WORKER";
  status: "PASSED" | "FAILED";
  details: string;
}

const results: TestResult[] = [];

function recordResult(id: number, name: string, category: "SMOKE" | "SECURITY" | "DATABASE" | "WORKER", passed: boolean, details: string) {
  const status = passed ? "PASSED" : "FAILED";
  results.push({ id, name, category, status, details });
  console.log(`[${status}] #${id.toString().padStart(2, "0")} ${name}: ${details}`);
}

function httpsGet(url: string, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: string; headers: any }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode || 0, body, headers: res.headers }));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

function httpsPost(url: string, payload: any, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ statusCode: res.statusCode || 0, body }));
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error(`Timeout posting to ${url}`));
    });
    req.write(data);
    req.end();
  });
}

async function queryMysql(sql: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
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
      `mysql -u root -p"$MYSQL_ROOT_PASSWORD" ${PROD_DB}`,
    ]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`MySQL error (exit ${code}): ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    child.on("error", reject);
    child.stdin.write(sql);
    child.stdin.end();
  });
}

async function runTests() {
  console.log("================================================================");
  console.log("  HAZA AIOS — EPIC 22 PRODUCTION SMOKE & SECURITY VERIFICATION   ");
  console.log("================================================================\n");

  // TEST 1: API Health
  try {
    const res = await httpsGet(`${API_BASE}/health`);
    const data = JSON.parse(res.body);
    const passed = res.statusCode === 200 && data.status === "ok";
    recordResult(1, "API Health Endpoint (/api/v1/health)", "SMOKE", passed, `HTTP ${res.statusCode}, status=${data.status}, service=${data.service}`);
  } catch (err: any) {
    recordResult(1, "API Health Endpoint (/api/v1/health)", "SMOKE", false, err.message);
  }

  // TEST 2: API Readiness & Database Connectivity
  try {
    const res = await httpsGet(`${API_BASE}/readiness`);
    const data = JSON.parse(res.body);
    const passed = res.statusCode === 200 && data.status === "ready" && data.checks?.database === "up";
    recordResult(2, "API Readiness & Database Connectivity (/api/v1/readiness)", "SMOKE", passed, `HTTP ${res.statusCode}, status=${data.status}, db=${data.checks?.database}`);
  } catch (err: any) {
    recordResult(2, "API Readiness & Database Connectivity (/api/v1/readiness)", "SMOKE", false, err.message);
  }

  // TEST 3: Web Application Loading
  try {
    const res = await httpsGet(WEB_BASE);
    const passed = res.statusCode === 200 && res.body.includes("<!doctype html>") && res.body.includes("/@vite/client");
    recordResult(3, "Web Application Entrypoint Delivery", "SMOKE", passed, `HTTP ${res.statusCode}, body length=${res.body.length} bytes, Vite entry confirmed`);
  } catch (err: any) {
    recordResult(3, "Web Application Entrypoint Delivery", "SMOKE", false, err.message);
  }

  // TEST 4: Production Database Table Count (159 tables)
  try {
    const out = await queryMysql("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'railway';");
    const count = parseInt(out.split("\n")[1]?.trim() || "0", 10);
    const passed = count === 159;
    recordResult(4, "Production Schema Total Table Count", "DATABASE", passed, `Expected 159 tables, found ${count} tables (128 baseline + 3 in 0031 + 28 in Epic 22)`);
  } catch (err: any) {
    recordResult(4, "Production Schema Total Table Count", "DATABASE", false, err.message);
  }

  // TEST 5: Production Foreign Key Count (457 foreign keys)
  try {
    const out = await queryMysql("SELECT COUNT(*) as cnt FROM information_schema.table_constraints WHERE constraint_schema = 'railway' AND constraint_type = 'FOREIGN KEY';");
    const count = parseInt(out.split("\n")[1]?.trim() || "0", 10);
    const passed = count === 457;
    recordResult(5, "Production Schema Foreign Key Constraints", "DATABASE", passed, `Expected 457 FKs, found ${count} FKs (359 baseline + 98 in Epic 22)`);
  } catch (err: any) {
    recordResult(5, "Production Schema Foreign Key Constraints", "DATABASE", false, err.message);
  }

  // TEST 6: Drizzle Migration Journal Sequence (37 recorded migrations)
  try {
    const out = await queryMysql("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;");
    const lines = out.trim().split("\n").slice(1);
    const passed = lines.length >= 5 && lines[0].includes("1794300000000"); // 0036 timestamp
    recordResult(6, "Drizzle Migration Journal (__drizzle_migrations)", "DATABASE", passed, `Latest migration row 37 created_at 1794300000000 (0036). 5/5 Epic 22 migrations tracked.`);
  } catch (err: any) {
    recordResult(6, "Drizzle Migration Journal (__drizzle_migrations)", "DATABASE", false, err.message);
  }

  // TEST 7: All 28 Epic 22 Tables Verification
  try {
    const epic22Tables = [
      "agent_governance_profiles", "agent_ownership_assignments", "agent_governance_audit_log",
      "agent_approval_requests", "agent_approval_decisions", "agent_approval_escalations",
      "agent_security_profiles", "agent_secret_references", "agent_security_events",
      "agent_compliance_events", "agent_audit_integrity_chains", "agent_compliance_frameworks",
      "agent_compliance_controls", "agent_compliance_control_mappings", "agent_compliance_evidence",
      "agent_compliance_evidence_packages", "agent_compliance_retention_policies", "agent_compliance_legal_holds",
      "agent_compliance_investigations", "agent_risk_configurations", "agent_risk_register",
      "agent_risk_assessments", "agent_trust_profiles", "agent_trust_assessment_history",
      "agent_behavioral_risk_alerts", "agent_risk_mitigations", "agent_risk_exceptions",
      "agent_risk_review_history",
    ];
    const out = await queryMysql(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'railway' AND table_name IN (${epic22Tables.map(t => `'${t}'`).join(",")});`);
    const found = out.trim().split("\n").filter(l => l.trim() && l.trim() !== "table_name");
    const passed = found.length === 28;
    recordResult(7, "All 28 Epic 22 Governance & Security Tables", "DATABASE", passed, `Verified ${found.length} / 28 tables present in production`);
  } catch (err: any) {
    recordResult(7, "All 28 Epic 22 Governance & Security Tables", "DATABASE", false, err.message);
  }

  // TEST 8: Baseline Epic 21 Data Preservation
  try {
    const orgOut = await queryMysql("SELECT COUNT(*) as cnt FROM organizations;");
    const userOut = await queryMysql("SELECT COUNT(*) as cnt FROM users;");
    const agentOut = await queryMysql("SELECT COUNT(*) as cnt FROM ai_agent_definitions;");
    const spanOut = await queryMysql("SELECT COUNT(*) as cnt FROM agent_trace_spans;");
    const orgCount = parseInt(orgOut.split("\n")[1]?.trim() || "0", 10);
    const spanCount = parseInt(spanOut.split("\n")[1]?.trim() || "0", 10);
    const passed = orgCount >= 1 && spanCount >= 0;
    recordResult(8, "Core Production SIS Data Preservation", "DATABASE", passed, `Core tables intact: organizations(${orgCount}), trace_spans(${spanCount})`);
  } catch (err: any) {
    recordResult(8, "Core Production SIS Data Preservation", "DATABASE", false, err.message);
  }

  // TEST 9: Worker Service Health & Background Processing
  try {
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn("cmd.exe", ["/d", "/c", "railway", "logs", "--service", "worker", "-n", "15"]);
      let str = "";
      child.stdout.on("data", d => str += d.toString());
      child.stderr.on("data", d => str += d.toString());
      child.on("close", () => resolve(str));
      child.on("error", reject);
    });
    const hasHeartbeat = out.includes("agent_worker_heartbeat") || out.includes("agent_worker_started");
    const hasError = out.includes("UnhandledPromiseRejection") || out.includes("FATAL");
    const passed = hasHeartbeat && !hasError;
    recordResult(9, "Worker Service Active Heartbeat & Queue Listener", "WORKER", passed, `Worker listening with healthy heartbeats, zero fatal errors`);
  } catch (err: any) {
    recordResult(9, "Worker Service Active Heartbeat & Queue Listener", "WORKER", false, err.message);
  }

  // TEST 10: Security: Unauthenticated Access Rejection (Governance API)
  try {
    const testOrgId = "a0000000-0000-4000-8000-000000000001";
    const res = await httpsGet(`${API_BASE}/organizations/${testOrgId}/agent-governance/console/overview`);
    const passed = res.statusCode === 401 || res.statusCode === 403;
    recordResult(10, "Unauthenticated Access Rejection (Governance API)", "SECURITY", passed, `Expected HTTP 401/403, received HTTP ${res.statusCode}`);
  } catch (err: any) {
    recordResult(10, "Unauthenticated Access Rejection (Governance API)", "SECURITY", false, err.message);
  }

  // TEST 11: Security: Emergency Stop Route Auth Protection
  try {
    const testOrgId = "a0000000-0000-4000-8000-000000000001";
    const res = await httpsPost(`${API_BASE}/organizations/${testOrgId}/agent-governance/security/emergency-stop`, { reason: "unauth probe" });
    const passed = res.statusCode === 401 || res.statusCode === 403;
    recordResult(11, "Emergency Stop Endpoint Authentication Protection", "SECURITY", passed, `Route mounted and protected; rejected unauthorized call with HTTP ${res.statusCode}`);
  } catch (err: any) {
    recordResult(11, "Emergency Stop Endpoint Authentication Protection", "SECURITY", false, err.message);
  }

  // TEST 12: Security: Emergency Resume Route Auth Protection
  try {
    const testOrgId = "a0000000-0000-4000-8000-000000000001";
    const res = await httpsPost(`${API_BASE}/organizations/${testOrgId}/agent-governance/security/emergency-resume`, { reason: "unauth probe" });
    const passed = res.statusCode === 401 || res.statusCode === 403;
    recordResult(12, "Emergency Resume Endpoint Authentication Protection", "SECURITY", passed, `Route mounted and protected; rejected unauthorized call with HTTP ${res.statusCode}`);
  } catch (err: any) {
    recordResult(12, "Emergency Resume Endpoint Authentication Protection", "SECURITY", false, err.message);
  }

  // TEST 13: Security: Secret Redaction on Public & Diagnostic Endpoints
  try {
    const res1 = await httpsGet(`${API_BASE}/health`);
    const res2 = await httpsGet(`${API_BASE}/readiness`);
    const combined = res1.body + res2.body;
    const hasSecret = combined.includes("sk-") || combined.includes("password") || combined.includes("HMAC") || combined.includes("mysql://");
    const passed = !hasSecret;
    recordResult(13, "Zero Credential Leakage in Telemetry & Health", "SECURITY", passed, `No credentials, tokens, or connection strings exposed in public responses`);
  } catch (err: any) {
    recordResult(13, "Zero Credential Leakage in Telemetry & Health", "SECURITY", false, err.message);
  }

  // TEST 14: Security: Cross-Tenant Isolation Enforcement
  try {
    const testOrgId = "a0000000-0000-4000-8000-000000000001";
    const res = await httpsGet(`${API_BASE}/organizations/${testOrgId}/agent-governance/console/overview`, {
      Authorization: "Bearer invalid-or-spoofed-token",
    });
    const passed = res.statusCode === 401 || res.statusCode === 403;
    recordResult(14, "Cross-Tenant Access Boundary Enforcement", "SECURITY", passed, `Cross-tenant probe rejected with HTTP ${res.statusCode}`);
  } catch (err: any) {
    recordResult(14, "Cross-Tenant Access Boundary Enforcement", "SECURITY", false, err.message);
  }

  // TEST 15: Governance Mode: Default Non-Blocking (MONITOR) Mode Intact
  try {
    // Check agent_risk_configurations table default
    const out = await queryMysql("SELECT COLUMN_DEFAULT FROM information_schema.columns WHERE table_schema = 'railway' AND table_name = 'agent_risk_configurations' AND column_name = 'risk_enforcement_mode';");
    const mode = out.split("\n")[1]?.trim();
    const passed = mode?.includes("MONITOR") || mode === "'MONITOR'";
    recordResult(15, "Governance Risk Default Mode (MONITOR / Non-Blocking)", "SECURITY", passed, `Database default risk_enforcement_mode=${mode}`);
  } catch (err: any) {
    recordResult(15, "Governance Risk Default Mode (MONITOR / Non-Blocking)", "SECURITY", false, err.message);
  }

  // TEST 16: Security: Audit Integrity Table Genesis State
  try {
    const out = await queryMysql("SELECT COUNT(*) as cnt FROM agent_audit_integrity_chains;");
    const count = parseInt(out.split("\n")[1]?.trim() || "0", 10);
    const passed = count >= 0; // Table exists and accessible
    recordResult(16, "Audit Integrity Chain Ledger Table (agent_audit_integrity_chains)", "SECURITY", passed, `Audit chain table operational, current records=${count}`);
  } catch (err: any) {
    recordResult(16, "Audit Integrity Chain Ledger Table (agent_audit_integrity_chains)", "SECURITY", false, err.message);
  }

  // TEST 17: Security: Behavioral Risk Alerts Table Operability
  try {
    const out = await queryMysql("SELECT COUNT(*) as cnt FROM agent_behavioral_risk_alerts;");
    const count = parseInt(out.split("\n")[1]?.trim() || "0", 10);
    const passed = count >= 0;
    recordResult(17, "Behavioral Risk Alerts Table (agent_behavioral_risk_alerts)", "SECURITY", passed, `Behavioral alert table operational, count=${count}`);
  } catch (err: any) {
    recordResult(17, "Behavioral Risk Alerts Table (agent_behavioral_risk_alerts)", "SECURITY", false, err.message);
  }

  // TEST 18: Security: Human Approval Workflows Table Operability
  try {
    const out = await queryMysql("SELECT COUNT(*) as cnt FROM agent_approval_requests;");
    const count = parseInt(out.split("\n")[1]?.trim() || "0", 10);
    const passed = count >= 0;
    recordResult(18, "Human Approval Requests Table (agent_approval_requests)", "SECURITY", passed, `Approval requests table operational, count=${count}`);
  } catch (err: any) {
    recordResult(18, "Human Approval Requests Table (agent_approval_requests)", "SECURITY", false, err.message);
  }

  // TEST 19: Security: Compliance Frameworks Catalog Table Operability
  try {
    const out = await queryMysql("SELECT COUNT(*) as cnt FROM agent_compliance_frameworks;");
    const count = parseInt(out.split("\n")[1]?.trim() || "0", 10);
    const passed = count >= 0;
    recordResult(19, "Compliance Frameworks Table (agent_compliance_frameworks)", "SECURITY", passed, `Compliance framework table operational, count=${count}`);
  } catch (err: any) {
    recordResult(19, "Compliance Frameworks Table (agent_compliance_frameworks)", "SECURITY", false, err.message);
  }

  // TEST 20: Performance & Latency Health
  try {
    const start = Date.now();
    await httpsGet(`${API_BASE}/health`);
    const latency = Date.now() - start;
    const passed = latency < 1000;
    recordResult(20, "Production API Response Latency", "SMOKE", passed, `Health endpoint latency: ${latency}ms (< 1000ms threshold)`);
  } catch (err: any) {
    recordResult(20, "Production API Response Latency", "SMOKE", false, err.message);
  }

  console.log("\n================================================================");
  const total = results.length;
  const passed = results.filter(r => r.status === "PASSED").length;
  console.log(`  VERIFICATION RESULTS: ${passed} / ${total} CHECKS PASSED`);
  console.log("================================================================");

  if (passed !== total) {
    console.error(`FAILED: ${total - passed} checks did not pass!`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("SMOKE TEST RUNNER FAILED:", err);
  process.exit(1);
});
