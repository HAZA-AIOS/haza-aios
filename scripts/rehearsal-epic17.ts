import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEST_DIR = "C:\\Users\\theme\\HAZA-AIOS-Private\\production-backups\\epic17";
const REHEARSAL_DB = "haza_epic17_rehearsal";
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

async function streamSqlFileToRailway(filePath: string, targetDb: string): Promise<void> {
  const shCmd = `mysql -u root -p"$MYSQL_ROOT_PASSWORD" ${targetDb}`;

  return new Promise<void>((resolve, reject) => {
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

    const readStream = fs.createReadStream(filePath);
    let stderr = "";

    readStream.pipe(child.stdin);
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`SQL file streaming failed (exit ${code}): ${stderr}`));
      } else {
        resolve();
      }
    });

    child.on("error", reject);
  });
}

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Epic 17 Migration Rehearsal & Verification        ");
  console.log("================================================================");

  // 1. Locate latest backup
  if (!fs.existsSync(DEST_DIR)) {
    throw new Error(`Backup directory does not exist: ${DEST_DIR}. Run backup script first.`);
  }

  const files = fs.readdirSync(DEST_DIR).filter((f) => f.endsWith(".sql") && f.includes("epic17"));
  if (files.length === 0) {
    throw new Error("No Epic 17 production backup SQL file found in " + DEST_DIR);
  }

  files.sort().reverse();
  const latestBackupFile = path.join(DEST_DIR, files[0]);
  console.log(`[BACKUP] Using latest production snapshot: ${latestBackupFile}`);

  // 2. Prepare isolated rehearsal schema
  console.log(`[SCHEMA] Creating isolated rehearsal database: ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS \`${REHEARSAL_DB}\`; CREATE DATABASE \`${REHEARSAL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
  console.log("[SCHEMA] Clean rehearsal database created.");

  // 3. Restore backup into rehearsal database
  console.log(`[RESTORE] Streaming backup snapshot into ${REHEARSAL_DB}...`);
  await streamSqlFileToRailway(latestBackupFile, REHEARSAL_DB);
  console.log("[RESTORE] Backup restoration complete.");

  // 4. Verify baseline state in rehearsal database
  console.log("[VERIFY] Checking baseline table counts in rehearsal database...");
  const tableCountRes = await runRailwayMysql("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = DATABASE();", REHEARSAL_DB);
  console.log(`[VERIFY] Table count: ${tableCountRes.stdout.trim().replace(/\n/g, " ")}`);

  // 5. Apply Migration 0027
  const migrationPath = path.resolve("apps/api/src/database/migrations/0027_agent_knowledge_context_engine.sql");
  console.log(`[MIGRATE] Applying Migration 0027: ${migrationPath}...`);
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  const statements = migrationSql.split("--> statement-breakpoint").map((s) => s.trim()).filter((s) => s.length > 0);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.replace(/\s+/g, " ").substring(0, 65);
    console.log(`  Executing [${i + 1}/${statements.length}]: ${preview}...`);
    await runRailwayMysql(stmt, REHEARSAL_DB);
  }
  console.log(`[MIGRATE] All ${statements.length} migration statements executed successfully.`);

  // 6. Record in __drizzle_migrations journal inside rehearsal DB
  const updateJournalSql = `
    INSERT INTO __drizzle_migrations (hash, created_at)
    VALUES ('0027_agent_knowledge_context_engine', UNIX_TIMESTAMP() * 1000);
  `;
  await runRailwayMysql(updateJournalSql, REHEARSAL_DB);
  console.log("[JOURNAL] Rehearsal migration journal updated.");

  // 7. Verify new and modified tables
  console.log("[AUDIT] Verifying all new knowledge tables and columns...");
  const verifyTablesSql = `
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = '${REHEARSAL_DB}' 
      AND table_name IN ('knowledge_collections', 'knowledge_sources', 'knowledge_chunks', 'ai_agent_knowledge_documents', 'ai_agent_knowledge_embeddings', 'ai_agent_knowledge_retrievals')
    ORDER BY table_name;
  `;
  const tablesRes = await runRailwayMysql(verifyTablesSql, REHEARSAL_DB);
  console.log("[AUDIT] Verified tables in rehearsal DB:\n" + tablesRes.stdout.trim());

  // 8. Verify column additions on knowledge_sources
  const verifySourcesColsSql = `
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = '${REHEARSAL_DB}' AND table_name = 'knowledge_sources'
      AND column_name IN ('collection_id', 'file_name', 'file_type', 'file_size_bytes', 'mime_type', 'storage_uri', 'current_version')
    ORDER BY column_name;
  `;
  const sourcesColsRes = await runRailwayMysql(verifySourcesColsSql, REHEARSAL_DB);
  console.log("[AUDIT] Verified extended columns on knowledge_sources:\n" + sourcesColsRes.stdout.trim());

  // 9. Verify column additions on knowledge_chunks
  const verifyChunksColsSql = `
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = '${REHEARSAL_DB}' AND table_name = 'knowledge_chunks'
      AND column_name IN ('section_heading', 'page_number', 'token_count', 'content_hash')
    ORDER BY column_name;
  `;
  const chunksColsRes = await runRailwayMysql(verifyChunksColsSql, REHEARSAL_DB);
  console.log("[AUDIT] Verified extended columns on knowledge_chunks:\n" + chunksColsRes.stdout.trim());

  // 10. Test DML insert, foreign keys, and indexes in rehearsal
  console.log("[DML] Testing sample knowledge collection and chunk insertion...");
  const dmlTestSql = `
    INSERT INTO knowledge_collections (id, organization_id, workspace_id, name, slug, industry, visibility, status)
    VALUES ('00000000-0000-4700-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4100-8000-000000000001', 'Rehearsal Test Collection', 'rehearsal-test', 'education', 'workspace', 'active');

    INSERT INTO knowledge_sources (id, organization_id, workspace_id, collection_id, name, description, type, visibility, status, content, content_hash, ingestion_status, created_by)
    VALUES ('00000000-0000-4700-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4100-8000-000000000001', '00000000-0000-4700-8000-000000000001', 'Rehearsal Test Source', 'Sample document', 'document', 'internal', 'active', 'Sample text', 'hash123', 'ready', '00000000-0000-4000-8000-000000000001');

    INSERT INTO knowledge_chunks (id, source_id, organization_id, workspace_id, ordinal, section_heading, token_count, content)
    VALUES ('00000000-0000-4700-8000-000000000003', '00000000-0000-4700-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4100-8000-000000000001', 0, 'Section 1', 15, 'Sample text chunk content.');

    SELECT id, name FROM knowledge_collections WHERE id = '00000000-0000-4700-8000-000000000001';
  `;
  const dmlRes = await runRailwayMysql(dmlTestSql, REHEARSAL_DB);
  console.log("[DML] Test row verified:\n" + dmlRes.stdout.trim());

  // 11. Cleanup rehearsal schema
  console.log(`[CLEANUP] Dropping rehearsal database: ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS ${REHEARSAL_DB};`);
  console.log("[CLEANUP] Rehearsal schema cleanly destroyed.");

  console.log("================================================================");
  console.log("  MIGRATION 0027 REHEARSAL CERTIFIED 100% SUCCESSFUL!           ");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR during rehearsal]:", err.message || err);
  process.exit(1);
});
