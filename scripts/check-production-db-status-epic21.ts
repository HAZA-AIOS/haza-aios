import { spawn } from "node:child_process";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";
const PROD_DB = "railway";

export async function runRailwayMysql(sql: string, targetDb = PROD_DB, retries = 3): Promise<{ stdout: string; stderr: string }> {
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
  console.log("  HAZA AIOS - Production Database Pre-Flight Status (Epic 21)   ");
  console.log("================================================================");

  // 1. Check migrations in __drizzle_migrations
  console.log("\n[1] Querying __drizzle_migrations in production...");
  const migrationRes = await runRailwayMysql(
    "SELECT id, hash, FROM_UNIXTIME(created_at / 1000) as applied_time FROM __drizzle_migrations ORDER BY id DESC LIMIT 10;"
  );
  console.log(migrationRes.stdout.trim());

  // 2. Count total tables in production
  console.log("\n[2] Checking total tables in production...");
  const countRes = await runRailwayMysql(
    "SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'railway';"
  );
  console.log(countRes.stdout.trim());

  // 3. Check Epic 19 tables
  console.log("\n[3] Checking Epic 19 tables in production...");
  const epic19Res = await runRailwayMysql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'railway' AND table_name LIKE 'agent_%' ORDER BY table_name;"
  );
  console.log(epic19Res.stdout.trim());

  // 4. Check Epic 20 tables
  console.log("\n[4] Checking Epic 20 tables in production...");
  const epic20Res = await runRailwayMysql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'railway' AND table_name LIKE 'autonomous_%' ORDER BY table_name;"
  );
  console.log(epic20Res.stdout.trim());

  // 5. Check whether any Epic 21 tables already exist
  console.log("\n[5] Checking for any premature Epic 21 tables in production...");
  const epic21Check = await runRailwayMysql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'railway' AND table_name IN ('agent_trace_spans', 'agent_evaluation_datasets', 'agent_evaluation_cases', 'agent_evaluation_runs', 'agent_slo_definitions', 'agent_reliability_metrics', 'agent_alert_rules', 'agent_incidents');"
  );
  const foundEpic21 = epic21Check.stdout.trim().split("\n").filter(l => l && !l.includes("table_name"));
  if (foundEpic21.length > 0) {
    console.log("WARNING: Found premature Epic 21 tables:", foundEpic21);
  } else {
    console.log("CONFIRMED: Zero Epic 21 tables present in production. Clean pre-migration state.");
  }

  // 6. Check foreign key consistency
  console.log("\n[6] Checking foreign key integrity on existing tables...");
  const fkRes = await runRailwayMysql(
    "SELECT COUNT(*) as total_fks FROM information_schema.table_constraints WHERE constraint_schema = 'railway' AND constraint_type = 'FOREIGN KEY';"
  );
  console.log(fkRes.stdout.trim());

  console.log("\n================================================================");
  console.log("  PRE-FLIGHT DATABASE VERIFICATION COMPLETE                     ");
  console.log("================================================================");
}

if (process.argv[1]?.includes("check-production-db-status-epic21")) {
  main().catch((err) => {
    console.error("Fatal preflight error:", err);
    process.exit(1);
  });
}
