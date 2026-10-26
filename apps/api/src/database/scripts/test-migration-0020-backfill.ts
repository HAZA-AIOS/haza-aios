import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mysql, { type RowDataPacket, type Connection } from "mysql2/promise";
import { loadConfig } from "../../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mandatory Safeguard Validation
const config = loadConfig(process.env).database;

function assertSafeguards(cfg: typeof config) {
  const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!allowedHosts.has(cfg.host)) {
    throw new Error(`[SAFEGUARD VIOLATION] Host '${cfg.host}' is NOT an approved local loopback host.`);
  }
  if (cfg.port !== 3307) {
    throw new Error(`[SAFEGUARD VIOLATION] Port '${cfg.port}' is NOT the authorized isolated MySQL 8.4.9 port 3307.`);
  }
  if (cfg.name !== "haza_epic10n_rehearsal") {
    throw new Error(`[SAFEGUARD VIOLATION] Database '${cfg.name}' is NOT the authorized rehearsal target 'haza_epic10n_rehearsal'.`);
  }
}

assertSafeguards(config);

interface TestCaseResult {
  id: string;
  name: string;
  inputScenario: string;
  expectedResult: string;
  actualResult: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const testResults: TestCaseResult[] = [];

async function run() {
  const startTime = Date.now();
  console.log("================================================================================");
  console.log("  HAZA-AIOS - Migration 0020 Automated Regression Test Suite (RB-003)           ");
  console.log("================================================================================");
  console.log(`Target Host:     ${config.host}`);
  console.log(`Target Port:     ${config.port}`);
  console.log(`Target Database: ${config.name}`);

  const db: Connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.name,
    multipleStatements: true,
  });

  try {
    // 1. Confirm live server identity
    const [identityRows] = await db.query<RowDataPacket[]>(
      "SELECT DATABASE() AS currentDatabase, @@hostname AS serverHostname, @@port AS serverPort, VERSION() AS serverVersion, USER() AS currentUser"
    );
    const identity = identityRows[0];
    console.log(`Connected Server Version: ${identity.serverVersion}`);
    console.log(`Connected User:           ${identity.currentUser}`);
    console.log(`Verified Active DB:       ${identity.currentDatabase}`);
    console.log(`Verified Port:            ${identity.serverPort}`);

    if (identity.currentDatabase !== "haza_epic10n_rehearsal") {
      throw new Error(`[RUNTIME SAFEGUARD ERROR] Connected database is '${identity.currentDatabase}', expected 'haza_epic10n_rehearsal'`);
    }
    if (Number(identity.serverPort) !== 3307) {
      throw new Error(`[RUNTIME SAFEGUARD ERROR] Connected port is '${identity.serverPort}', expected 3307`);
    }

    // 2. Query available workspaces for tenant isolation testing
    const [wsRows] = await db.query<RowDataPacket[]>(
      "SELECT id, name FROM workspaces ORDER BY id LIMIT 2"
    );
    if (wsRows.length < 2) {
      throw new Error("At least two workspaces are required in haza_epic10n_rehearsal for tenant isolation testing.");
    }
    const ws1 = wsRows[0].id;
    const ws2 = wsRows[1].id;
    console.log(`Workspace 1 (Tenant A):   ${ws1} (${wsRows[0].name})`);
    console.log(`Workspace 2 (Tenant B):   ${ws2} (${wsRows[1].name})`);

    // 3. Clean up any existing synthetic test fixtures
    await db.query("DELETE FROM portal_update_requests WHERE id LIKE 'synth-bf-%'");

    // 4. Test Malformed JSON Rejection at Schema Level
    try {
      await db.query(
        "INSERT INTO portal_update_requests (id, workspace_id, requester_user_id, requester_role, request_type, status, payload) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ["synth-bf-malformed-json", ws1, "user-test", "guardian", "admission_enquiry", "submitted", "{bad-json-syntax:"]
      );
      testResults.push({
        id: "TC-BF-00",
        name: "Malformed JSON rejection at schema level",
        inputScenario: "Inserting invalid JSON text '{bad-json-syntax:' into payload column",
        expectedResult: "MySQL rejects invalid JSON with ER_INVALID_JSON_TEXT",
        actualResult: "Insert unexpectedly succeeded without syntax validation error",
        status: "FAIL",
      });
    } catch (err: unknown) {
      const errCode = (err as { code?: string }).code;
      const isExpected = errCode === "ER_INVALID_JSON_TEXT" || String(err).includes("Invalid JSON text");
      testResults.push({
        id: "TC-BF-00",
        name: "Malformed JSON rejection at schema level",
        inputScenario: "Inserting invalid JSON text '{bad-json-syntax:' into payload column",
        expectedResult: "MySQL rejects invalid JSON with ER_INVALID_JSON_TEXT",
        actualResult: `Rejected cleanly: ${errCode || err}`,
        status: isExpected ? "PASS" : "FAIL",
      });
    }

    // 5. Seed Synthetic Test Matrix Records
    const seedRecords: Array<{
      id: string;
      workspace_id: string;
      request_type: string;
      payload: string;
      reference_number: string | null;
      application_number: string | null;
    }> = [
      // TC-BF-01: Unique enquiry reference number
      {
        id: "synth-bf-01-enq-unique",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: "ENQ-SYNTH-UNIQUE-001", studentName: "Student One" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-02: Unique application number
      {
        id: "synth-bf-02-app-unique",
        workspace_id: ws1,
        request_type: "admission_application",
        payload: JSON.stringify({ applicationNumber: "APP-SYNTH-UNIQUE-001", studentName: "Student Two" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-03: Duplicate enquiry references within same workspace
      {
        id: "synth-bf-03-enq-dup-a",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: "ENQ-COLLIDE-SAME-WS", studentName: "Student Dup A" }),
        reference_number: null,
        application_number: null,
      },
      {
        id: "synth-bf-03-enq-dup-b",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: "ENQ-COLLIDE-SAME-WS", studentName: "Student Dup B" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-04: Duplicate application numbers within same workspace
      {
        id: "synth-bf-04-app-dup-a",
        workspace_id: ws1,
        request_type: "admission_application",
        payload: JSON.stringify({ applicationNumber: "APP-COLLIDE-SAME-WS", studentName: "Student App Dup A" }),
        reference_number: null,
        application_number: null,
      },
      {
        id: "synth-bf-04-app-dup-b",
        workspace_id: ws1,
        request_type: "admission_application",
        payload: JSON.stringify({ applicationNumber: "APP-COLLIDE-SAME-WS", studentName: "Student App Dup B" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-05: Identical references across separate workspaces (Tenant Isolation)
      {
        id: "synth-bf-05-enq-cross-ws1",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: "ENQ-SHARED-CROSS-TENANT", studentName: "Student Shared WS1" }),
        reference_number: null,
        application_number: null,
      },
      {
        id: "synth-bf-05-enq-cross-ws2",
        workspace_id: ws2,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: "ENQ-SHARED-CROSS-TENANT", studentName: "Student Shared WS2" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-06: Identical application numbers across separate workspaces (Tenant Isolation)
      {
        id: "synth-bf-06-app-cross-ws1",
        workspace_id: ws1,
        request_type: "admission_application",
        payload: JSON.stringify({ applicationNumber: "APP-SHARED-CROSS-TENANT", studentName: "Student App Shared WS1" }),
        reference_number: null,
        application_number: null,
      },
      {
        id: "synth-bf-06-app-cross-ws2",
        workspace_id: ws2,
        request_type: "admission_application",
        payload: JSON.stringify({ applicationNumber: "APP-SHARED-CROSS-TENANT", studentName: "Student App Shared WS2" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-07: Missing JSON identifiers
      {
        id: "synth-bf-07-enq-missing-key",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ notes: "No referenceNumber key in payload", studentName: "Student No Ref" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-08: Explicit NULL JSON identifiers
      {
        id: "synth-bf-08-enq-explicit-null",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: null, studentName: "Student Null Ref" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-09: Empty string JSON identifiers
      {
        id: "synth-bf-09-enq-empty-string",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: "", studentName: "Student Empty Ref" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-10: String "null" JSON identifiers
      {
        id: "synth-bf-10-enq-string-null",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: "null", studentName: "Student Str Null Ref" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-11: Numeric JSON identifier (unsupported/non-standard type)
      {
        id: "synth-bf-11-enq-numeric",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: 998877, studentName: "Student Numeric Ref" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-12: Preservation of existing non-NULL identifiers
      {
        id: "synth-bf-12-enq-pre-existing",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: "NEW-REF-OVERWRITE-ATTEMPT", studentName: "Student Pre Existing" }),
        reference_number: "PRE-EXISTING-REF-001",
        application_number: null,
      },
      // TC-BF-13: Candidate colliding with pre-existing non-NULL identifier in same workspace
      {
        id: "synth-bf-13-enq-collide-existing",
        workspace_id: ws1,
        request_type: "admission_enquiry",
        payload: JSON.stringify({ referenceNumber: "PRE-EXISTING-REF-001", studentName: "Student Collide Pre Existing" }),
        reference_number: null,
        application_number: null,
      },
      // TC-BF-14: Unintended request type with referenceNumber in payload
      {
        id: "synth-bf-14-wrong-request-type",
        workspace_id: ws1,
        request_type: "student_profile_update",
        payload: JSON.stringify({ referenceNumber: "ENQ-WRONG-REQ-TYPE-001", studentName: "Student Wrong Type" }),
        reference_number: null,
        application_number: null,
      },
    ];

    for (const rec of seedRecords) {
      await db.query(
        "INSERT INTO portal_update_requests (id, workspace_id, requester_user_id, requester_role, request_type, status, payload, reference_number, application_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          rec.id,
          rec.workspace_id,
          "synth-requester-id",
          "guardian",
          rec.request_type,
          "submitted",
          rec.payload,
          rec.reference_number,
          rec.application_number,
        ]
      );
    }
    console.log(`Seeded ${seedRecords.length} synthetic test records successfully.`);

    // 6. Read and execute Migration 0020 SQL
    const migrationFile = resolve(__dirname, "../migrations/0020_backfill_portal_request_identifiers.sql");
    const migrationSql = readFileSync(migrationFile, "utf-8");
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Executing Migration 0020 (${statements.length} SQL statements)...`);
    const t0 = Date.now();
    for (const stmt of statements) {
      await db.query(stmt);
    }
    const tMigration = Date.now() - t0;
    console.log(`Migration 0020 backfill executed in ${tMigration} ms.`);

    // 7. Fetch and verify actual records
    const [fetchedRows] = await db.query<RowDataPacket[]>(
      "SELECT id, workspace_id, request_type, reference_number, application_number FROM portal_update_requests WHERE id LIKE 'synth-bf-%'"
    );
    const rowMap = new Map<string, RowDataPacket>();
    for (const r of fetchedRows) {
      rowMap.set(r.id, r);
    }

    // Evaluate each test case
    function checkCase(
      id: string,
      name: string,
      rowId: string,
      col: "reference_number" | "application_number",
      expectedVal: string | null,
      inputScenario: string,
      expectedDesc: string
    ) {
      const row = rowMap.get(rowId);
      const actualVal = row ? row[col] : undefined;
      const passed = actualVal === expectedVal;
      testResults.push({
        id,
        name,
        inputScenario,
        expectedResult: expectedDesc,
        actualResult: `${col} = ${actualVal === null ? "NULL" : `'${actualVal}'`}`,
        status: passed ? "PASS" : "FAIL",
      });
    }

    // TC-BF-01
    checkCase(
      "TC-BF-01",
      "Unique enquiry reference-number backfill",
      "synth-bf-01-enq-unique",
      "reference_number",
      "ENQ-SYNTH-UNIQUE-001",
      "Valid single enquiry with referenceNumber in JSON payload",
      "reference_number backfilled to 'ENQ-SYNTH-UNIQUE-001'"
    );

    // TC-BF-02
    checkCase(
      "TC-BF-02",
      "Unique application-number backfill",
      "synth-bf-02-app-unique",
      "application_number",
      "APP-SYNTH-UNIQUE-001",
      "Valid single application with applicationNumber in JSON payload",
      "application_number backfilled to 'APP-SYNTH-UNIQUE-001'"
    );

    // TC-BF-03: Duplicate enquiry references in same workspace
    const dupEnqA = rowMap.get("synth-bf-03-enq-dup-a")?.reference_number;
    const dupEnqB = rowMap.get("synth-bf-03-enq-dup-b")?.reference_number;
    testResults.push({
      id: "TC-BF-03",
      name: "Duplicate references within one workspace",
      inputScenario: "Two admission_enquiry requests in same workspace with identical referenceNumber 'ENQ-COLLIDE-SAME-WS'",
      expectedResult: "Both rows skipped by HAVING count(*) = 1 guard (remain NULL) to avoid unique constraint collision",
      actualResult: `dup_a: ${dupEnqA === null ? "NULL" : `'${dupEnqA}'`}, dup_b: ${dupEnqB === null ? "NULL" : `'${dupEnqB}'`}`,
      status: dupEnqA === null && dupEnqB === null ? "PASS" : "FAIL",
    });

    // TC-BF-04: Duplicate application numbers in same workspace
    const dupAppA = rowMap.get("synth-bf-04-app-dup-a")?.application_number;
    const dupAppB = rowMap.get("synth-bf-04-app-dup-b")?.application_number;
    testResults.push({
      id: "TC-BF-04",
      name: "Duplicate applications within one workspace",
      inputScenario: "Two admission_application requests in same workspace with identical applicationNumber 'APP-COLLIDE-SAME-WS'",
      expectedResult: "Both rows skipped by HAVING count(*) = 1 guard (remain NULL) to avoid unique constraint collision",
      actualResult: `dup_a: ${dupAppA === null ? "NULL" : `'${dupAppA}'`}, dup_b: ${dupAppB === null ? "NULL" : `'${dupAppB}'`}`,
      status: dupAppA === null && dupAppB === null ? "PASS" : "FAIL",
    });

    // TC-BF-05: Identical references across separate workspaces (Tenant Isolation)
    const crossEnq1 = rowMap.get("synth-bf-05-enq-cross-ws1")?.reference_number;
    const crossEnq2 = rowMap.get("synth-bf-05-enq-cross-ws2")?.reference_number;
    testResults.push({
      id: "TC-BF-05",
      name: "Identical references across separate workspaces (Tenant Isolation)",
      inputScenario: "Two admission_enquiry requests with identical referenceNumber 'ENQ-SHARED-CROSS-TENANT' in distinct workspaces",
      expectedResult: "Both rows successfully backfilled; composite unique index (workspace_id, reference_number) allows multi-tenant reuse",
      actualResult: `ws1: ${crossEnq1 === null ? "NULL" : `'${crossEnq1}'`}, ws2: ${crossEnq2 === null ? "NULL" : `'${crossEnq2}'`}`,
      status: crossEnq1 === "ENQ-SHARED-CROSS-TENANT" && crossEnq2 === "ENQ-SHARED-CROSS-TENANT" ? "PASS" : "FAIL",
    });

    // TC-BF-06: Identical application numbers across separate workspaces (Tenant Isolation)
    const crossApp1 = rowMap.get("synth-bf-06-app-cross-ws1")?.application_number;
    const crossApp2 = rowMap.get("synth-bf-06-app-cross-ws2")?.application_number;
    testResults.push({
      id: "TC-BF-06",
      name: "Identical applications across separate workspaces (Tenant Isolation)",
      inputScenario: "Two admission_application requests with identical applicationNumber 'APP-SHARED-CROSS-TENANT' in distinct workspaces",
      expectedResult: "Both rows successfully backfilled; composite unique index (workspace_id, application_number) allows multi-tenant reuse",
      actualResult: `ws1: ${crossApp1 === null ? "NULL" : `'${crossApp1}'`}, ws2: ${crossApp2 === null ? "NULL" : `'${crossApp2}'`}`,
      status: crossApp1 === "APP-SHARED-CROSS-TENANT" && crossApp2 === "APP-SHARED-CROSS-TENANT" ? "PASS" : "FAIL",
    });

    // TC-BF-07
    checkCase(
      "TC-BF-07",
      "Missing JSON identifier field",
      "synth-bf-07-enq-missing-key",
      "reference_number",
      null,
      "Payload contains other keys but no referenceNumber key",
      "reference_number remains NULL (IS NOT NULL filter)"
    );

    // TC-BF-08
    checkCase(
      "TC-BF-08",
      "Explicit NULL JSON identifier",
      "synth-bf-08-enq-explicit-null",
      "reference_number",
      null,
      "Payload contains {\"referenceNumber\": null}",
      "reference_number remains NULL (!= 'null' filter)"
    );

    // TC-BF-09
    checkCase(
      "TC-BF-09",
      "Empty string JSON identifier",
      "synth-bf-09-enq-empty-string",
      "reference_number",
      null,
      "Payload contains {\"referenceNumber\": \"\"}",
      "reference_number remains NULL (!= '' filter)"
    );

    // TC-BF-10
    checkCase(
      "TC-BF-10",
      "String 'null' JSON identifier",
      "synth-bf-10-enq-string-null",
      "reference_number",
      null,
      "Payload contains {\"referenceNumber\": \"null\"}",
      "reference_number remains NULL (!= 'null' filter)"
    );

    // TC-BF-11
    checkCase(
      "TC-BF-11",
      "Numeric JSON identifier coercion",
      "synth-bf-11-enq-numeric",
      "reference_number",
      "998877",
      "Payload contains numeric {\"referenceNumber\": 998877}",
      "reference_number coerced to string '998877'"
    );

    // TC-BF-12
    checkCase(
      "TC-BF-12",
      "Preservation of existing non-NULL identifier",
      "synth-bf-12-enq-pre-existing",
      "reference_number",
      "PRE-EXISTING-REF-001",
      "Row already had reference_number = 'PRE-EXISTING-REF-001' before migration",
      "reference_number preserved without modification"
    );

    // TC-BF-13
    checkCase(
      "TC-BF-13",
      "Collision with pre-existing identifier in same workspace",
      "synth-bf-13-enq-collide-existing",
      "reference_number",
      null,
      "Candidate payload has referenceNumber equal to an already-populated row in the workspace",
      "Candidate skipped by existing.id IS NULL check (remains NULL)"
    );

    // TC-BF-14
    checkCase(
      "TC-BF-14",
      "Request type filtering",
      "synth-bf-14-wrong-request-type",
      "reference_number",
      null,
      "Request has request_type = 'student_profile_update' with referenceNumber in payload",
      "reference_number remains NULL (not an admission_enquiry)"
    );

    // 8. Idempotency Test: Execute Migration 0020 SQL a Second Time
    console.log("Re-executing Migration 0020 SQL to verify idempotency...");
    const tIdempotency0 = Date.now();
    for (const stmt of statements) {
      await db.query(stmt);
    }
    const tIdempotency = Date.now() - tIdempotency0;

    const [postSecondRows] = await db.query<RowDataPacket[]>(
      "SELECT id, reference_number, application_number FROM portal_update_requests WHERE id LIKE 'synth-bf-%'"
    );
    let idempotencyMismatch = false;
    for (const postRow of postSecondRows) {
      const prior = rowMap.get(postRow.id);
      if (
        prior?.reference_number !== postRow.reference_number ||
        prior?.application_number !== postRow.application_number
      ) {
        idempotencyMismatch = true;
        break;
      }
    }
    testResults.push({
      id: "TC-BF-15",
      name: "Migration idempotency under repeated execution",
      inputScenario: "Execute migration 0020 SQL statements a second consecutive time against the database",
      expectedResult: "Zero unintended modifications; all synthetic records remain 100% identical to first run",
      actualResult: idempotencyMismatch ? "State modified on second execution" : `Zero changes detected (${tIdempotency} ms)`,
      status: idempotencyMismatch ? "FAIL" : "PASS",
    });

    // 9. Unique Index Enforcement Test: Attempt inserting duplicate directly
    let uniqueIndexEnforced = false;
    try {
      await db.query(
        "INSERT INTO portal_update_requests (id, workspace_id, requester_user_id, requester_role, request_type, status, payload, reference_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          "synth-bf-unique-index-test",
          ws1,
          "synth-requester",
          "guardian",
          "admission_enquiry",
          "submitted",
          "{}",
          "ENQ-SYNTH-UNIQUE-001", // Collides with TC-BF-01 backfilled row
        ]
      );
    } catch (err: unknown) {
      const errCode = (err as { code?: string }).code;
      if (errCode === "ER_DUP_ENTRY" || String(err).includes("Duplicate entry")) {
        uniqueIndexEnforced = true;
      }
    }
    testResults.push({
      id: "TC-BF-16",
      name: "Unique index enforcement on backfilled columns",
      inputScenario: "Insert direct duplicate (workspace_id, reference_number) colliding with backfilled record",
      expectedResult: "MySQL enforces portal_requests_workspace_ref_num_unique and throws ER_DUP_ENTRY",
      actualResult: uniqueIndexEnforced ? "ER_DUP_ENTRY thrown as expected" : "Duplicate allowed without error",
      status: uniqueIndexEnforced ? "PASS" : "FAIL",
    });

    // 10. Clean up synthetic records
    console.log("Cleaning up synthetic test fixtures...");
    await db.query("DELETE FROM portal_update_requests WHERE id LIKE 'synth-bf-%'");

    // 11. Foreign Key & Tenant Isolation Integrity Check
    console.log("Executing schema referential integrity check...");
    const [foreignKeys] = await db.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
              REFERENCED_TABLE_NAME AS referenced_table_name,
              REFERENCED_COLUMN_NAME AS referenced_column_name,
              CONSTRAINT_NAME AS constraint_name
         FROM information_schema.key_column_usage
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`
    );
    const groups = new Map<string, RowDataPacket[]>();
    for (const key of foreignKeys) {
      const id = `${key.table_name}:${key.constraint_name}`;
      groups.set(id, [...(groups.get(id) ?? []), key]);
    }
    let fkFailures = 0;
    for (const [, columns] of groups) {
      const child = `\`${columns[0].table_name}\``;
      const parent = `\`${columns[0].referenced_table_name}\``;
      const match = columns
        .map((k) => `c.\`${k.column_name}\` = p.\`${k.referenced_column_name}\``)
        .join(" AND ");
      const populated = columns
        .map((k) => `c.\`${k.column_name}\` IS NOT NULL`)
        .join(" AND ");
      const [cntRows] = await db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM ${child} c LEFT JOIN ${parent} p ON ${match} WHERE ${populated} AND p.\`${columns[0].referenced_column_name}\` IS NULL`
      );
      if (Number(cntRows[0]?.total ?? 0) > 0) fkFailures++;
    }

    const tenantChecks: Array<[string, string]> = [
      ["agent_run_workspace", "SELECT COUNT(*) AS total FROM ai_agent_runs r JOIN workspaces w ON w.id = r.workspace_id WHERE r.organization_id <> w.organization_id"],
      ["workflow_run_workspace", "SELECT COUNT(*) AS total FROM workflow_runs r JOIN workspaces w ON w.id = r.workspace_id WHERE r.organization_id <> w.organization_id"],
      ["usage_workspace", "SELECT COUNT(*) AS total FROM usage_meter_events u JOIN workspaces w ON w.id = u.workspace_id WHERE u.organization_id <> w.organization_id"],
      ["usage_agent_source", "SELECT COUNT(*) AS total FROM usage_meter_events u LEFT JOIN ai_agent_runs r ON r.id = u.source_id AND r.organization_id = u.organization_id AND r.workspace_id = u.workspace_id WHERE u.source_type = 'agent_run' AND r.id IS NULL"],
      ["usage_workflow_source", "SELECT COUNT(*) AS total FROM usage_meter_events u LEFT JOIN workflow_runs r ON r.id = u.source_id AND r.organization_id = u.organization_id AND r.workspace_id = u.workspace_id WHERE u.source_type = 'workflow_run' AND r.id IS NULL"],
      ["subscription_account", "SELECT COUNT(*) AS total FROM organization_subscriptions s JOIN billing_accounts a ON a.id = s.billing_account_id WHERE s.organization_id <> a.organization_id"],
      ["statement_subscription", "SELECT COUNT(*) AS total FROM billing_statements b JOIN organization_subscriptions s ON s.id = b.subscription_id WHERE b.organization_id <> s.organization_id"],
    ];
    let tenantFailures = 0;
    for (const [, query] of tenantChecks) {
      const [tRows] = await db.query<RowDataPacket[]>(query);
      if (Number(tRows[0]?.total ?? 0) > 0) tenantFailures++;
    }

    testResults.push({
      id: "TC-BF-17",
      name: "Post-backfill referential integrity & tenant isolation",
      inputScenario: "Execute complete DB-18 integrity audit (207 foreign keys and 7 tenant boundary rules)",
      expectedResult: "0 foreign key violations, 0 tenant boundary violations",
      actualResult: `FK checks: ${groups.size} (${fkFailures} failures), Tenant checks: ${tenantChecks.length} (${tenantFailures} failures)`,
      status: fkFailures === 0 && tenantFailures === 0 ? "PASS" : "FAIL",
    });

    const totalDuration = Date.now() - startTime;
    const passedCount = testResults.filter((r) => r.status === "PASS").length;
    const failedCount = testResults.filter((r) => r.status === "FAIL").length;

    console.log("\n================================================================================");
    console.log("  MIGRATION 0020 REGRESSION TEST RESULTS MATRIX                                 ");
    console.log("================================================================================");
    for (const r of testResults) {
      const mark = r.status === "PASS" ? "✓" : "✗";
      console.log(`[${mark}] ${r.id.padEnd(10)} | ${r.status.padEnd(4)} | ${r.name}`);
      console.log(`    Input:    ${r.inputScenario}`);
      console.log(`    Expected: ${r.expectedResult}`);
      console.log(`    Actual:   ${r.actualResult}`);
    }

    console.log("--------------------------------------------------------------------------------");
    console.log(`Total Test Cases:    ${testResults.length}`);
    console.log(`Passed:              ${passedCount}`);
    console.log(`Failed:              ${failedCount}`);
    console.log(`Total Duration:      ${totalDuration} ms`);
    console.log("================================================================================");

    if (failedCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await db.end();
  }
}

await run();
