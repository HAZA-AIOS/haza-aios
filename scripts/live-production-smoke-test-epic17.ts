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

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Epic 17 Live Production Smoke Test Suite          ");
  console.log("  Target API: " + API_BASE);
  console.log("  Target Web: " + WEB_BASE);
  console.log("================================================================\n");

  const results: Array<{ test: string; status: "PASS" | "FAIL"; details: string }> = [];

  // 1. API Health Check
  try {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    if (res.ok) {
      const data = await res.json();
      results.push({ test: "1. API /health check", status: "PASS", details: `HTTP 200 OK (${JSON.stringify(data)})` });
    } else {
      results.push({ test: "1. API /health check", status: "FAIL", details: `HTTP ${res.status}` });
    }
  } catch (err: any) {
    results.push({ test: "1. API /health check", status: "FAIL", details: err.message });
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

  // 3. Production MySQL Schema Audit for Migration 0027
  try {
    const sql = `
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = '${PROD_DB}' 
        AND table_name IN ('knowledge_collections', 'knowledge_sources', 'knowledge_chunks', 'ai_agent_knowledge_documents', 'ai_agent_knowledge_embeddings', 'ai_agent_knowledge_retrievals')
      ORDER BY table_name;
    `;
    const res = await runRailwayMysql(sql);
    const tables = res.stdout.trim().split("\n").map((l) => l.trim()).filter((l) => l && !l.toLowerCase().includes("table_name"));
    if (tables.length === 6) {
      results.push({ test: "3. Production MySQL Migration 0027 6 Tables", status: "PASS", details: `All 6 tables active: ${tables.join(", ")}` });
    } else {
      results.push({ test: "3. Production MySQL Migration 0027 6 Tables", status: "FAIL", details: `Found only ${tables.length} tables: ${tables.join(", ")}` });
    }
  } catch (err: any) {
    results.push({ test: "3. Production MySQL Migration 0027 6 Tables", status: "FAIL", details: err.message });
  }

  // 4. Verification of extended columns in knowledge_sources and knowledge_chunks
  try {
    const sql = `
      SELECT COUNT(*) as cnt FROM information_schema.columns 
      WHERE table_schema = '${PROD_DB}' AND (
        (table_name = 'knowledge_sources' AND column_name IN ('collection_id', 'file_name', 'file_type', 'file_size_bytes', 'mime_type', 'storage_uri', 'current_version'))
        OR
        (table_name = 'knowledge_chunks' AND column_name IN ('section_heading', 'page_number', 'token_count', 'content_hash'))
      );
    `;
    const res = await runRailwayMysql(sql);
    const count = parseInt(res.stdout.trim().split("\n").pop() || "0", 10);
    if (count >= 11) {
      results.push({ test: "4. Extended Schema Columns Verification", status: "PASS", details: `Verified ${count} extended columns across sources and chunks.` });
    } else {
      results.push({ test: "4. Extended Schema Columns Verification", status: "FAIL", details: `Found only ${count} extended columns.` });
    }
  } catch (err: any) {
    results.push({ test: "4. Extended Schema Columns Verification", status: "FAIL", details: err.message });
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

  // 6. Direct Production DML Test: Knowledge Collection Lifecycle
  const testColId = "00000000-0000-4700-9000-000000000001";
  const testSrcId = "00000000-0000-4700-9000-000000000002";
  const testChunkId = "00000000-0000-4700-9000-000000000003";

  try {
    const insertSql = `
      INSERT INTO knowledge_collections (id, organization_id, workspace_id, name, slug, industry, visibility, status, created_by)
      VALUES ('${testColId}', '${prodOrgId}', '${prodWsId}', 'Live Smoke Test Curriculum', 'live-smoke-test', 'education', 'workspace', 'active', '${prodUserId}')
      ON DUPLICATE KEY UPDATE name = 'Live Smoke Test Curriculum';

      INSERT INTO knowledge_sources (id, organization_id, workspace_id, collection_id, name, description, type, visibility, status, content, content_hash, ingestion_status, created_by, created_at, updated_at)
      VALUES ('${testSrcId}', '${prodOrgId}', '${prodWsId}', '${testColId}', 'Chemistry Neutralization Standard', 'Neutralization reactions', 'document', 'internal', 'active', 'Acids react with bases to form salts and water.', 'hash-smoke-1', 'ready', '${prodUserId}', NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = 'Chemistry Neutralization Standard';

      INSERT INTO knowledge_chunks (id, source_id, organization_id, workspace_id, ordinal, section_heading, page_number, token_count, content, content_hash)
      VALUES ('${testChunkId}', '${testSrcId}', '${prodOrgId}', '${prodWsId}', 0, 'Acids and Bases', 1, 12, 'Acids react with bases to form salts and water in neutralization reactions.', 'chunk-hash-smoke-1')
      ON DUPLICATE KEY UPDATE content = 'Acids react with bases to form salts and water in neutralization reactions.';
    `;
    await runRailwayMysql(insertSql);
    results.push({ test: "6. Production Knowledge Entity Ingestion", status: "PASS", details: `Inserted collection ${testColId}, source ${testSrcId}, chunk ${testChunkId}` });
  } catch (err: any) {
    results.push({ test: "6. Production Knowledge Entity Ingestion", status: "FAIL", details: err.message });
  }

  // 7. Verify Ingested Records in Production MySQL
  try {
    const verifySql = `
      SELECT c.name as col_name, s.name as src_name, k.content 
      FROM knowledge_chunks k
      INNER JOIN knowledge_sources s ON s.id = k.source_id
      INNER JOIN knowledge_collections c ON c.id = s.collection_id
      WHERE k.id = '${testChunkId}';
    `;
    const res = await runRailwayMysql(verifySql);
    if (res.stdout.includes("Chemistry Neutralization Standard")) {
      results.push({ test: "7. Production Relational Integrity & Querying", status: "PASS", details: "Confirmed cross-table join integrity: collection -> source -> chunk." });
    } else {
      results.push({ test: "7. Production Relational Integrity & Querying", status: "FAIL", details: "Unable to verify relational join: " + res.stdout });
    }
  } catch (err: any) {
    results.push({ test: "7. Production Relational Integrity & Querying", status: "FAIL", details: err.message });
  }

  // 8. Clean up smoke test entities
  try {
    const cleanupSql = `
      DELETE FROM knowledge_chunks WHERE id = '${testChunkId}';
      DELETE FROM knowledge_sources WHERE id = '${testSrcId}';
      DELETE FROM knowledge_collections WHERE id = '${testColId}';
    `;
    await runRailwayMysql(cleanupSql);
    results.push({ test: "8. Smoke Test Entity Cleanup", status: "PASS", details: "Cleanly deleted test records without foreign key violations." });
  } catch (err: any) {
    results.push({ test: "8. Smoke Test Entity Cleanup", status: "FAIL", details: err.message });
  }

  // 9. Final Results Summary
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
    console.log("\n>>> ALL 8 PRODUCTION SMOKE CRITERIA VERIFIED 100% SUCCESSFUL! <<<");
  } else {
    console.error("\n>>> ONE OR MORE SMOKE CHECKS FAILED! <<<");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR in smoke test]:", err.message || err);
  process.exit(1);
});

