import { runRailwayMysql } from "./check-production-db-status-epic21";

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Production Database Post-Migration 0031 Verification");
  console.log("================================================================");

  // 1. Verify latest migration in __drizzle_migrations
  console.log("\n[1] Checking latest migration in __drizzle_migrations...");
  const migrationRes = await runRailwayMysql(
    "SELECT id, hash, created_at, FROM_UNIXTIME(created_at / 1000) as applied_time FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;"
  );
  console.log(migrationRes.stdout.trim());

  // 2. Count total tables in production
  console.log("\n[2] Checking total tables in production...");
  const countRes = await runRailwayMysql(
    "SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'railway';"
  );
  console.log(countRes.stdout.trim());

  // 3. Verify all 8 Epic 21 tables exist
  console.log("\n[3] Verifying all 8 Epic 21 tables...");
  const epic21Check = await runRailwayMysql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'railway' AND table_name IN ('agent_trace_spans', 'agent_evaluation_datasets', 'agent_evaluation_cases', 'agent_evaluation_runs', 'agent_slo_definitions', 'agent_reliability_metrics', 'agent_alert_rules', 'agent_incidents') ORDER BY table_name;"
  );
  console.log(epic21Check.stdout.trim());

  // 4. Verify total foreign keys
  console.log("\n[4] Verifying total foreign key count...");
  const fkRes = await runRailwayMysql(
    "SELECT COUNT(*) as total_fks FROM information_schema.table_constraints WHERE constraint_schema = 'railway' AND constraint_type = 'FOREIGN KEY';"
  );
  console.log(fkRes.stdout.trim());

  // 5. Verify Epic 21 specific foreign keys
  console.log("\n[5] Verifying Epic 21 foreign keys count (expecting 22)...");
  const epic21Fks = await runRailwayMysql(
    "SELECT COUNT(*) as epic21_fks FROM information_schema.table_constraints WHERE constraint_schema = 'railway' AND constraint_type = 'FOREIGN KEY' AND table_name IN ('agent_trace_spans', 'agent_evaluation_datasets', 'agent_evaluation_cases', 'agent_evaluation_runs', 'agent_slo_definitions', 'agent_reliability_metrics', 'agent_alert_rules', 'agent_incidents');"
  );
  console.log(epic21Fks.stdout.trim());

  // 6. Verify non-primary indexes on Epic 21 tables
  console.log("\n[6] Verifying non-primary indexes on Epic 21 tables (expecting 25)...");
  const idxRes = await runRailwayMysql(
    "SELECT COUNT(DISTINCT table_name, index_name) as epic21_indexes FROM information_schema.statistics WHERE table_schema = 'railway' AND index_name != 'PRIMARY' AND table_name IN ('agent_trace_spans', 'agent_evaluation_datasets', 'agent_evaluation_cases', 'agent_evaluation_runs', 'agent_slo_definitions', 'agent_reliability_metrics', 'agent_alert_rules', 'agent_incidents');"
  );
  console.log(idxRes.stdout.trim());

  // 7. Verify baseline customer data integrity
  console.log("\n[7] Verifying baseline customer data integrity (organizations, workspaces, users)...");
  const baselineRes = await runRailwayMysql(
    "SELECT (SELECT COUNT(*) FROM organizations) as total_orgs, (SELECT COUNT(*) FROM workspaces) as total_workspaces, (SELECT COUNT(*) FROM users) as total_users;"
  );
  console.log(baselineRes.stdout.trim());

  console.log("\n================================================================");
  console.log("  PRODUCTION DATABASE VERIFICATION COMPLETE                     ");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("Fatal verification error:", err);
  process.exit(1);
});

