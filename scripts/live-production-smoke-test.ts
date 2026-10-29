import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

const API_BASE = "https://api.haza-aios.com/api/v1";
const WEB_BASE = "https://www.haza-aios.com";

const USER_ID = "b99f5271-60a9-475c-9a37-a1ada249b11e"; // Mussawar Hussain
const ORG_A_ID = "52a786e9-9892-4187-8830-17d52ef91f7e"; // LUMS
const ORG_B_ID = "a2b5787d-8f4a-465e-b1e6-196776180548"; // Haseeb Hospital
const WORKSPACE_A_ID = "b28f6d7d-0146-4c41-b3a3-bd120081582c"; // LUMS Workspace
const MEMBERSHIP_A_ID = "43984ede-bc1c-4fdc-a84e-555342d450c0"; // LUMS Owner Membership
const PLATFORM_ADMIN_PERM_ID = "3a969869-c08b-450b-a992-4fff38e29208";

const SUFFIX = randomUUID().slice(0, 8);
const SESSION_ID = randomUUID();
const TOKEN = `smoke_epic12_${randomUUID().replace(/-/g, "")}`;
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");

const PLATFORM_ROLE_ID = `smoke-role-${SUFFIX}`;
const ROLE_PERM_ID = `smoke-rp-${SUFFIX}`;
const MEM_ROLE_ID = `smoke-mr-${SUFFIX}`;

function runSql(sql: string) {
  const sanitized = sql.replace(/"/g, '\\"');
  const cmd = `powershell -File c:\\HAZA-APPS\\HAZA-AIOS\\scratch\\prod_db.ps1 -Query "${sanitized}"`;
  execSync(cmd, { stdio: "inherit" });
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
  console.log("HAZA-AIOS EPIC 12 — LIVE PRODUCTION SMOKE TEST SUITE");
  console.log(`Execution Time: ${new Date().toISOString()}`);
  console.log(`Suffix: ${SUFFIX}`);
  console.log("==================================================================");

  let installedAgentId: string | null = null;
  let authoredTemplateId: string | null = null;
  let privateTemplateId: string | null = null;
  let authoredAgentId: string | null = null;

  try {
    // -------------------------------------------------------------
    // PREREQUISITE: Create authenticated session in production
    // -------------------------------------------------------------
    console.log("\n[SETUP] Creating temporary test session in production MySQL...");
    runSql(`INSERT INTO auth_sessions (id, user_id, token_hash, auth_session_status, remember_me, expires_at) VALUES ('${SESSION_ID}', '${USER_ID}', '${TOKEN_HASH}', 'active', 0, DATE_ADD(NOW(), INTERVAL 2 HOUR));`);

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
    // STEP 3: Existing SIS Modules Non-Destructive Sanity Check
    // -------------------------------------------------------------
    const sisGradesRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/sis/grades`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (sisGradesRes.status === 200) {
      const gradesData = await sisGradesRes.json();
      record("3.1", "SIS Grades Module Access", "PASS", `HTTP 200 (${gradesData.grades?.length ?? 0} grades)`);
    } else {
      record("3.1", "SIS Grades Module Access", "FAIL", `Status ${sisGradesRes.status}`);
    }

    const sisSectionsRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/sis/sections`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (sisSectionsRes.status === 200) {
      const sectionsData = await sisSectionsRes.json();
      record("3.2", "SIS Sections Module Access", "PASS", `HTTP 200 (${sectionsData.sections?.length ?? 0} sections)`);
    } else {
      record("3.2", "SIS Sections Module Access", "FAIL", `Status ${sisSectionsRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 4: Marketplace Catalog Discovery
    // -------------------------------------------------------------
    const catalogRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/catalog?page=1&pageSize=10`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const catalogData = await catalogRes.json();
    if (catalogRes.status === 200 && catalogData.items?.length >= 3) {
      record("4.1", "Marketplace Catalog Discovery", "PASS", `Found ${catalogData.total} items in catalog`);
    } else {
      record("4.1", "Marketplace Catalog Discovery", "FAIL", `Status ${catalogRes.status}, items: ${catalogData.items?.length}`);
    }

    // -------------------------------------------------------------
    // STEP 5: Agent Search and Filtering
    // -------------------------------------------------------------
    const searchRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/catalog?search=Worksheet`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const searchData = await searchRes.json();
    const foundWorksheet = searchData.items?.some((i: any) => i.name.includes("Worksheet"));
    if (searchRes.status === 200 && foundWorksheet) {
      record("5.1", "Agent Search by Keyword", "PASS", `Matched ${searchData.items.length} items`);
    } else {
      record("5.1", "Agent Search by Keyword", "FAIL", `Search failed or Worksheet Creator not found`);
    }

    const categoryRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/catalog?category=education`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const categoryData = await categoryRes.json();
    if (categoryRes.status === 200 && categoryData.items?.length >= 1) {
      record("5.2", "Agent Filtering by Category", "PASS", `Found ${categoryData.items.length} education agents`);
    } else {
      record("5.2", "Agent Filtering by Category", "FAIL", `Status ${categoryRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 6: Agent Profile and Version History
    // -------------------------------------------------------------
    const worksheetTemplateId = "00000000-0000-4100-8000-000000000101";
    const profileRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/agents/${worksheetTemplateId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const profileData = await profileRes.json();
    if (profileRes.status === 200 && profileData.profile?.slug === "worksheet-creator") {
      record("6.1", "Agent Profile Retrieval", "PASS", `Retrieved ${profileData.profile.name} (v${profileData.profile.latestVersion})`);
    } else {
      record("6.1", "Agent Profile Retrieval", "FAIL", `Status ${profileRes.status}`);
    }

    const versionsRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/agents/${worksheetTemplateId}/versions`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const versionsData = await versionsRes.json();
    if (versionsRes.status === 200 && versionsData.versions?.length >= 1) {
      record("6.2", "Agent Version History Retrieval", "PASS", `Found ${versionsData.versions.length} versions`);
    } else {
      record("6.2", "Agent Version History Retrieval", "FAIL", `Status ${versionsRes.status}`);
    }

    const versionDetailsRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/agents/${worksheetTemplateId}/versions/1.0.0`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const versionDetailsData = await versionDetailsRes.json();
    if (versionDetailsRes.status === 200 && versionDetailsData.version?.version === "1.0.0") {
      record("6.3", "Agent Specific Version Details", "PASS", `Retrieved version 1.0.0 specification`);
    } else {
      record("6.3", "Agent Specific Version Details", "FAIL", `Status ${versionDetailsRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 7: Agent Installation
    // -------------------------------------------------------------
    const installRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/install`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateId: worksheetTemplateId,
        workspaceId: WORKSPACE_A_ID,
        customName: `Worksheet Creator Smoke ${SUFFIX}`,
      }),
    });
    const installData = await installRes.json();
    if (installRes.status === 201 && installData.agent?.id) {
      installedAgentId = installData.agent.id;
      record("7.1", "Agent Installation from Marketplace", "PASS", `Installed agent definition ID: ${installedAgentId}`);
    } else {
      record("7.1", "Agent Installation from Marketplace", "FAIL", `Status ${installRes.status}: ${JSON.stringify(installData)}`);
    }

    // -------------------------------------------------------------
    // STEP 8: Duplicate-Installation Prevention Guard (Idempotency)
    // -------------------------------------------------------------
    const dupRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/install`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateId: worksheetTemplateId,
        workspaceId: WORKSPACE_A_ID,
      }),
    });
    const dupData = await dupRes.json();
    if (dupRes.status === 201 && dupData.agent?.id === installedAgentId) {
      record("8.1", "Duplicate Installation Prevention Guard", "PASS", `Idempotent reuse of active instance: ${dupData.agent.id}`);
    } else {
      record("8.1", "Duplicate Installation Prevention Guard", "FAIL", `Expected idempotent reuse of ${installedAgentId}, got ${JSON.stringify(dupData)}`);
    }

    // -------------------------------------------------------------
    // STEP 9: Installed Agents Listing
    // -------------------------------------------------------------
    const installedListRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/installed?workspaceId=${WORKSPACE_A_ID}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const installedListData = await installedListRes.json();
    const foundInstalled = installedListData.installedAgents?.some((a: any) => a.agentDefinitionId === installedAgentId);
    if (installedListRes.status === 200 && foundInstalled) {
      record("9.1", "Installed Agents Query", "PASS", `Found ${installedListData.installedAgents.length} installed agents`);
    } else {
      record("9.1", "Installed Agents Query", "FAIL", `Status ${installedListRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 10: Publisher Submission Workflow
    // -------------------------------------------------------------
    const createPublisherRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/publisher/templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Smoke Math Tutor ${SUFFIX}`,
        slug: `smoke-math-tutor-${SUFFIX}`,
        description: "Automated smoke test agent authored by tenant publisher",
        summary: "Smoke test agent",
        category: "education",
        industry: "Education",
        version: "1.0.0",
        icon: "academic-cap",
        visibility: "approved_shared",
        capabilities: [{ capabilityId: "math.solve", name: "Solve Math", description: "Solves math problems", riskLevel: "low", requiredScopes: [] }],
        requiredPermissions: ["agent.read"],
      }),
    });
    const createPublisherData = await createPublisherRes.json();
    if (createPublisherRes.status === 201 && createPublisherData.template?.id) {
      authoredTemplateId = createPublisherData.template.id;
      record("10.1", "Publisher Authored Template Creation", "PASS", `Created template ID: ${authoredTemplateId} (draft)`);
    } else {
      record("10.1", "Publisher Authored Template Creation", "FAIL", `Status ${createPublisherRes.status}: ${JSON.stringify(createPublisherData)}`);
    }

    // Submit authored template for platform review
    const submitRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/publisher/templates/${authoredTemplateId}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (submitRes.status === 200) {
      record("10.2", "Publisher Submission for Review", "PASS", `Template ${authoredTemplateId} submitted for review`);
    } else {
      record("10.2", "Publisher Submission for Review", "FAIL", `Status ${submitRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 11: Publishing Approval Permissions (Denial Check)
    // -------------------------------------------------------------
    const unauthReviewRes = await fetch(`${API_BASE}/platform/marketplace/reviews`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (unauthReviewRes.status === 403) {
      record("11.1", "Platform Review RBAC Enforcement (Default Deny)", "PASS", `HTTP 403 Forbidden without platform.admin`);
    } else {
      record("11.1", "Platform Review RBAC Enforcement (Default Deny)", "FAIL", `Expected 403, got ${unauthReviewRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 12: Platform Administrator Review Workflow
    // -------------------------------------------------------------
    console.log("[SETUP] Assigning Platform Administrator role to test membership...");
    runSql(`INSERT INTO roles (id, organization_id, name, description, role_scope) VALUES ('${PLATFORM_ROLE_ID}', NULL, 'Platform Administrator Smoke', 'Full platform admin', 'platform');`);
    runSql(`INSERT INTO role_permissions (id, role_id, permission_id) VALUES ('${ROLE_PERM_ID}', '${PLATFORM_ROLE_ID}', '${PLATFORM_ADMIN_PERM_ID}');`);
    runSql(`INSERT INTO membership_roles (id, membership_id, role_id) VALUES ('${MEM_ROLE_ID}', '${MEMBERSHIP_A_ID}', '${PLATFORM_ROLE_ID}');`);

    const adminReviewListRes = await fetch(`${API_BASE}/platform/marketplace/reviews`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const adminReviewListData = await adminReviewListRes.json();
    const foundSubmission = adminReviewListData.submissions?.some((s: any) => s.id === authoredTemplateId);
    if (adminReviewListRes.status === 200 && foundSubmission) {
      record("12.1", "Platform Admin Review Queue Query", "PASS", `Found submitted template in review queue`);
    } else {
      record("12.1", "Platform Admin Review Queue Query", "FAIL", `Status ${adminReviewListRes.status}`);
    }

    // Approve the template
    const decisionRes = await fetch(`${API_BASE}/platform/marketplace/reviews/${authoredTemplateId}/decision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: "approved",
        reviewNotes: "Automated smoke test approval verified.",
      }),
    });
    if (decisionRes.status === 200) {
      record("12.2", "Platform Admin Review Decision (Approval)", "PASS", `Template ${authoredTemplateId} approved`);
    } else {
      record("12.2", "Platform Admin Review Decision (Approval)", "FAIL", `Status ${decisionRes.status}`);
    }

    // Publish the approved template
    const publishRes = await fetch(`${API_BASE}/platform/marketplace/reviews/${authoredTemplateId}/decision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: "published",
        reviewNotes: "Published to marketplace catalog.",
      }),
    });
    if (publishRes.status === 200) {
      record("12.3", "Platform Admin Publishing Decision", "PASS", `Template ${authoredTemplateId} published`);
    } else {
      record("12.3", "Platform Admin Publishing Decision", "FAIL", `Status ${publishRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 13: Explicit Version Upgrade Workflow
    // -------------------------------------------------------------
    // 1. Install the approved authored template v1.0.0 into workspace
    const installAuthoredRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/install`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateId: authoredTemplateId,
        workspaceId: WORKSPACE_A_ID,
        customName: `Authored Math Agent ${SUFFIX}`,
      }),
    });
    const installAuthoredData = await installAuthoredRes.json();
    authoredAgentId = installAuthoredData.agent?.id;
    if (installAuthoredRes.status === 201 && authoredAgentId) {
      record("13.1", "Authored Template Installation", "PASS", `Installed as agent ID: ${authoredAgentId} (v1.0.0)`);
    } else {
      record("13.1", "Authored Template Installation", "FAIL", `Status ${installAuthoredRes.status}`);
    }

    // 2. Publisher creates v2.0.0
    const v2Res = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/publisher/templates/${authoredTemplateId}/versions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "2.0.0",
        name: `Smoke Math Tutor ${SUFFIX} v2`,
        description: "Enhanced v2 mathematics reasoning instructions.",
        instructions: "Enhanced v2 mathematics reasoning instructions.",
        changelog: "Upgraded math engine to v2 with step-by-step reasoning.",
      }),
    });
    if (v2Res.status === 201) {
      record("13.2", "Publisher Version 2.0.0 Creation", "PASS", `Version 2.0.0 created`);
    } else {
      record("13.2", "Publisher Version 2.0.0 Creation", "FAIL", `Status ${v2Res.status}`);
    }

    // 2b. Platform Admin reviews and publishes the update
    const publishV2Res = await fetch(`${API_BASE}/platform/marketplace/reviews/${authoredTemplateId}/decision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: "published",
        reviewNotes: "Version 2.0.0 verified and published.",
      }),
    });
    if (publishV2Res.status === 200) {
      record("13.3", "Platform Admin Publishing Version 2.0.0", "PASS", `Version 2.0.0 published`);
    } else {
      record("13.3", "Platform Admin Publishing Version 2.0.0", "FAIL", `Status ${publishV2Res.status}`);
    }

    // 3. Upgrade the installed agent to 2.0.0
    const upgradeRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/installed/${authoredAgentId}/upgrade`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetVersion: "2.0.0",
      }),
    });
    const upgradeData = await upgradeRes.json();
    if (upgradeRes.status === 200 && upgradeData.agent?.installedVersion === "2.0.0") {
      record("13.4", "Explicit Agent Version Upgrade", "PASS", `Agent upgraded to v2.0.0`);
    } else {
      record("13.4", "Explicit Agent Version Upgrade", "FAIL", `Status ${upgradeRes.status}: ${JSON.stringify(upgradeData)}`);
    }

    // -------------------------------------------------------------
    // STEP 14: Safe Agent Uninstall
    // -------------------------------------------------------------
    const uninstallRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/installed/${installedAgentId}/uninstall`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Smoke test verification complete" }),
    });
    if (uninstallRes.status === 200) {
      record("14.1", "Safe Agent Uninstallation (Primary Agent)", "PASS", `Agent ${installedAgentId} archived, installation closed`);
    } else {
      record("14.1", "Safe Agent Uninstallation (Primary Agent)", "FAIL", `Status ${uninstallRes.status}`);
    }

    if (authoredAgentId) {
      const uninstallAuthoredRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/installed/${authoredAgentId}/uninstall`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Smoke test verification complete" }),
      });
      if (uninstallAuthoredRes.status === 200) {
        record("14.2", "Safe Agent Uninstallation (Authored Agent)", "PASS", `Agent ${authoredAgentId} uninstalled`);
      }
    }

    // -------------------------------------------------------------
    // STEP 15: Private-Agent Tenant Isolation
    // -------------------------------------------------------------
    const createPrivateRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/publisher/templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `LUMS Private Confidential Agent ${SUFFIX}`,
        slug: `lums-private-confidential-${SUFFIX}`,
        description: "Confidential private agent exclusively for LUMS tenant",
        category: "operations",
        industry: "Education",
        version: "1.0.0",
        icon: "shield-check",
        visibility: "private_organization",
      }),
    });
    const createPrivateData = await createPrivateRes.json();
    privateTemplateId = createPrivateData.template?.id;

    // Check catalog from Org B (Haseeb Hospital) -> MUST NOT contain this template
    const orgBCatalogRes = await fetch(`${API_BASE}/organizations/${ORG_B_ID}/marketplace/catalog?search=Confidential`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const orgBCatalogData = await orgBCatalogRes.json();
    const leakedToOrgB = orgBCatalogData.items?.some((i: any) => i.id === privateTemplateId);
    if (orgBCatalogRes.status === 200 && !leakedToOrgB) {
      record("15.1", "Private Agent Tenant Isolation Barrier", "PASS", `Private template not visible to foreign tenant (${ORG_B_ID})`);
    } else {
      record("15.1", "Private Agent Tenant Isolation Barrier", "FAIL", `Leak detected! Template visible in foreign tenant`);
    }

    // -------------------------------------------------------------
    // STEP 16: Marketplace Analytics
    // -------------------------------------------------------------
    const orgAnalyticsRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/marketplace/analytics`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const orgAnalyticsData = await orgAnalyticsRes.json();
    if (orgAnalyticsRes.status === 200 && orgAnalyticsData.analytics) {
      record("16.1", "Organization Marketplace Analytics", "PASS", `Total installations: ${orgAnalyticsData.analytics.totalInstallations}, active: ${orgAnalyticsData.analytics.activeInstallations}`);
    } else {
      record("16.1", "Organization Marketplace Analytics", "FAIL", `Status ${orgAnalyticsRes.status}`);
    }

    const platformAnalyticsRes = await fetch(`${API_BASE}/platform/marketplace/analytics`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const platformAnalyticsData = await platformAnalyticsRes.json();
    if (platformAnalyticsRes.status === 200 && platformAnalyticsData.analytics) {
      record("16.2", "Platform-Wide Marketplace Analytics", "PASS", `Platform published agents: ${platformAnalyticsData.analytics.totalPublishedAgents ?? platformAnalyticsData.analytics.publishedAgentsCount}`);
    } else {
      record("16.2", "Platform-Wide Marketplace Analytics", "FAIL", `Status ${platformAnalyticsRes.status}`);
    }

    // -------------------------------------------------------------
    // STEP 17: Audit History & Secret Redaction
    // -------------------------------------------------------------
    if (installedAgentId) {
      const auditRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${installedAgentId}/audit-history`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const auditData = await auditRes.json();
      if (auditRes.status === 200 && auditData.items?.length >= 1) {
        record("17.1", "Agent Audit Event Stream", "PASS", `Found ${auditData.items.length} audit entries (install, uninstall)`);
      } else {
        record("17.1", "Agent Audit Event Stream", "FAIL", `Status ${auditRes.status}`);
      }

      // Secret redaction verification
      const agentDetailsRes = await fetch(`${API_BASE}/organizations/${ORG_A_ID}/agents/${installedAgentId}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const agentDetails = await agentDetailsRes.json();
      const configStr = JSON.stringify(agentDetails.agent?.configuration ?? {});
      const hasSecrets = configStr.includes("apiKey") || configStr.includes("secret") || configStr.includes("password");
      if (agentDetailsRes.status === 200 && !hasSecrets) {
        record("17.2", "Secret Redaction & Security Boundary", "PASS", `No credentials or provider secrets present in agent definition`);
      } else {
        record("17.2", "Secret Redaction & Security Boundary", "FAIL", `Secret leakage or error retrieving agent details`);
      }
    }

  } catch (err: any) {
    console.error("FATAL ERROR IN LIVE PRODUCTION SMOKE TEST:", err);
    record("ERROR", "Unhandled Exception", "FAIL", err.message);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Strictly remove only synthetic test records
    // -------------------------------------------------------------
    console.log("\n[CLEANUP] Removing synthetic test records from production database...");

    if (installedAgentId) {
      runSql(`DELETE FROM ai_agent_installations WHERE agent_definition_id = '${installedAgentId}';`);
      runSql(`DELETE FROM ai_agent_definitions WHERE id = '${installedAgentId}';`);
    }
    if (authoredAgentId) {
      runSql(`DELETE FROM ai_agent_installations WHERE agent_definition_id = '${authoredAgentId}';`);
      runSql(`DELETE FROM ai_agent_definitions WHERE id = '${authoredAgentId}';`);
    }
    if (authoredTemplateId) {
      runSql(`DELETE FROM ai_agent_template_versions WHERE template_id = '${authoredTemplateId}';`);
      runSql(`DELETE FROM ai_agent_templates WHERE id = '${authoredTemplateId}';`);
    }
    if (privateTemplateId) {
      runSql(`DELETE FROM ai_agent_template_versions WHERE template_id = '${privateTemplateId}';`);
      runSql(`DELETE FROM ai_agent_templates WHERE id = '${privateTemplateId}';`);
    }

    // Clean up platform admin test role
    runSql(`DELETE FROM membership_roles WHERE id = '${MEM_ROLE_ID}';`);
    runSql(`DELETE FROM role_permissions WHERE id = '${ROLE_PERM_ID}';`);
    runSql(`DELETE FROM roles WHERE id = '${PLATFORM_ROLE_ID}';`);

    // Clean up test session
    runSql(`DELETE FROM auth_sessions WHERE id = '${SESSION_ID}';`);

    console.log("[CLEANUP] Production database clean-up complete.");
  }

  console.log("\n==================================================================");
  console.log("SMOKE TEST SUMMARY MATRIX");
  console.log("==================================================================");
  let passedCount = 0;
  let failedCount = 0;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} Step ${r.step}: ${r.name} [${r.status}]${r.details ? ` (${r.details})` : ""}`);
    if (r.status === "PASS") passedCount++;
    else failedCount++;
  }
  console.log(`\nTOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  if (failedCount > 0) {
    console.error("FATAL: Live production smoke tests FAILED!");
    process.exit(1);
  } else {
    console.log("SUCCESS: All Live Production Smoke Tests PASSED!");
  }
}

run().catch((e) => {
  console.error("Unhandled fatal runner error:", e);
  process.exit(1);
});
