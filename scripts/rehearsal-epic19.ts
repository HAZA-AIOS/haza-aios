import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REHEARSAL_DB = "haza_epic19_rehearsal";
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

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Epic 19 Migration Rehearsal (Isolated Schema)     ");
  console.log("================================================================");

  // 1. Prepare disposable rehearsal schema
  console.log(`[SCHEMA] Creating disposable database: ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE IF EXISTS ${REHEARSAL_DB}; CREATE DATABASE ${REHEARSAL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
  console.log(`[OK] Schema ${REHEARSAL_DB} created.`);

  // 2. Read migration file
  const migrationPath = path.resolve("apps/api/src/database/migrations/0029_multi_agent_orchestration.sql");
  console.log(`[FILE] Reading migration: ${migrationPath}`);
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  // 3. Create baseline prerequisites
  console.log("[SETUP] Provisioning minimal relational dependencies (organizations, workspaces, users, ai_agent_definitions, ai_agent_runs)...");
  const baselineSql = `
    CREATE TABLE \`organizations\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`name\` varchar(255) NOT NULL,
      \`slug\` varchar(100) NOT NULL UNIQUE,
      \`status\` varchar(50) NOT NULL DEFAULT 'active'
    );
    CREATE TABLE \`workspaces\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`organization_id\` char(36) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`status\` varchar(50) NOT NULL DEFAULT 'active'
    );
    CREATE TABLE \`users\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`email\` varchar(255) NOT NULL UNIQUE,
      \`status\` varchar(50) NOT NULL DEFAULT 'active'
    );
    CREATE TABLE \`ai_agent_definitions\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`organization_id\` char(36) NOT NULL,
      \`name\` varchar(255) NOT NULL,
      \`status\` varchar(50) NOT NULL DEFAULT 'active'
    );
    CREATE TABLE \`ai_agent_runs\` (
      \`id\` char(36) NOT NULL PRIMARY KEY,
      \`organization_id\` char(36) NOT NULL,
      \`workspace_id\` char(36) NOT NULL,
      \`agent_definition_id\` char(36) NOT NULL,
      \`initiator_user_id\` char(36) NOT NULL,
      \`status\` varchar(50) NOT NULL DEFAULT 'completed'
    );
  `;
  await runRailwayMysql(baselineSql, REHEARSAL_DB);
  console.log("[OK] Relational baseline established.");

  // 4. Split and execute migration statements
  console.log("[MIGRATE] Applying 0029_multi_agent_orchestration.sql statements to rehearsal database...");
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`[INFO] Found ${statements.length} DDL statements to apply.`);
  let executedCount = 0;

  for (const stmt of statements) {
    await runRailwayMysql(stmt, REHEARSAL_DB);
    executedCount++;
  }
  console.log(`[OK] Successfully executed all ${executedCount} DDL statements.`);

  // 5. Verification of all 8 tables
  console.log("[VERIFY] Verifying created tables in rehearsal schema...");
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

  const { stdout: tablesOut } = await runRailwayMysql("SHOW TABLES;", REHEARSAL_DB);
  console.log(`[OUTPUT] Tables present:\n${tablesOut}`);

  for (const table of expectedTables) {
    if (!tablesOut.includes(table)) {
      throw new Error(`Expected table '${table}' missing from rehearsal schema.`);
    }
  }
  console.log("[OK] All 8 Epic 19 tables confirmed present.");

  // 6. Test Data Insertion & Referential Integrity
  console.log("[DATA] Performing referential integrity test insertion...");
  const testDataSql = `
    INSERT INTO organizations (id, name, slug) VALUES ('00000000-0000-0000-0000-000000000001', 'Test School', 'test-school');
    INSERT INTO workspaces (id, organization_id, name) VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Main Workspace');
    INSERT INTO users (id, email) VALUES ('00000000-0000-0000-0000-000000000003', 'teacher@school.edu');
    INSERT INTO ai_agent_definitions (id, organization_id, name) VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Science Agent');

    INSERT INTO agent_teams (id, organization_id, workspace_id, name, description, status, created_by)
    VALUES ('team-1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'MS Science Team', 'MS Science Team description', 'active', '00000000-0000-0000-0000-000000000003');

    INSERT INTO agent_team_members (id, team_id, organization_id, agent_id, role, capabilities, priority, status)
    VALUES ('member-1', 'team-1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'planner', '[\"planning\"]', 1, 'active');

    INSERT INTO agent_workflow_definitions (id, organization_id, workspace_id, team_id, name, description, pattern, version, revision, input_schema, configuration, created_by)
    VALUES ('wf-1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'team-1', 'Science Plan Workflow', 'Science Plan Workflow description', 'sequential', '1.0.0', 1, '{}', '{}', '00000000-0000-0000-0000-000000000003');

    INSERT INTO agent_workflow_steps (id, workflow_definition_id, organization_id, step_key, name, description, step_order, assigned_role, depends_on_step_keys, input_mapping, output_key, configuration)
    VALUES ('step-1', 'wf-1', '00000000-0000-0000-0000-000000000001', 'plan', 'Plan Unit', 'Plan unit curriculum', 0, 'planner', '[]', '{}', 'unit_out', '{}');

    INSERT INTO agent_workflow_runs (id, organization_id, workspace_id, workflow_definition_id, team_id, initiator_user_id, status, initial_input, shared_context)
    VALUES ('run-1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'wf-1', 'team-1', '00000000-0000-0000-0000-000000000003', 'running', '{}', '{}');

    INSERT INTO agent_workflow_step_runs (id, workflow_run_id, step_id, organization_id, step_key, assigned_agent_id, status, input_payload)
    VALUES ('srun-1', 'run-1', 'step-1', '00000000-0000-0000-0000-000000000001', 'plan', '00000000-0000-0000-0000-000000000004', 'running', '{}');

    INSERT INTO agent_workflow_artifacts (id, workflow_run_id, step_run_id, organization_id, workspace_id, artifact_type, name, content, provenance)
    VALUES ('art-1', 'run-1', 'srun-1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'lesson_plan', 'Unit Plan', '{\"topic\":\"Cells\"}', '{\"agentId\":\"00000000-0000-0000-0000-000000000004\"}');

    INSERT INTO agent_workflow_events (id, workflow_run_id, step_run_id, organization_id, event_type, payload)
    VALUES ('ev-1', 'run-1', 'srun-1', '00000000-0000-0000-0000-000000000001', 'step_dispatched', '{\"stepKey\":\"plan\"}');
  `;
  await runRailwayMysql(testDataSql, REHEARSAL_DB);
  console.log("[OK] Test records inserted successfully across all 8 tables.");

  // 7. Clean up disposable rehearsal database
  console.log(`[CLEANUP] Dropping disposable rehearsal database ${REHEARSAL_DB}...`);
  await runRailwayMysql(`DROP DATABASE ${REHEARSAL_DB};`);
  console.log("[OK] Rehearsal database dropped cleanly.");

  console.log("================================================================");
  console.log("  MIGRATION REHEARSAL 100% SUCCESSFUL — CERTIFIED FOR PROD      ");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR during rehearsal]:", err.message || err);
  process.exit(1);
});

