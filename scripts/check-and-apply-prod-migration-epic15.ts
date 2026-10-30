import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";

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
  console.log("  HAZA AIOS - Production Database Migration 0025 Check & Apply   ");
  console.log("================================================================");

  // 1. Inspect recent migrations
  const migRows = await runRailwayMysql("SELECT id, hash, FROM_UNIXTIME(created_at/1000) as applied_at FROM `__drizzle_migrations` ORDER BY id DESC LIMIT 5;");
  console.log("\n[PROD] Latest applied migrations in __drizzle_migrations:\n" + migRows.stdout.trim());

  // 2. Check if 0025 is already applied
  const checkTable = await runRailwayMysql("SHOW TABLES LIKE 'academic_lesson_plans';");
  console.log("\n[PROD] Checking academic_lesson_plans table presence:\n" + checkTable.stdout.trim());

  if (!checkTable.stdout.includes("academic_lesson_plans")) {
    console.log("\n[PROD] Migration 0025 NOT yet applied in production. Applying statements now...");
    const migFile = path.resolve("apps/api/src/database/migrations/0025_academic_lesson_plans.sql");
    const migSql = fs.readFileSync(migFile, "utf-8");
    const statements = migSql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);

    console.log(`[PROD] Found ${statements.length} statements in migration 0025.`);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.replace(/\s+/g, " ").substring(0, 70);
      console.log(`  Applying [${i + 1}/${statements.length}]: ${preview}...`);
      await runRailwayMysql(stmt);
    }

    // 3. Record migration in __drizzle_migrations
    const journalPath = path.resolve("apps/api/src/database/migrations/meta/_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const entry25 = journal.entries.find((e: any) => e.idx === 25);
    if (entry25) {
      console.log(`\n[PROD] Recording migration 25 (${entry25.tag}) in __drizzle_migrations...`);
      await runRailwayMysql(`INSERT INTO \`__drizzle_migrations\` (hash, created_at) VALUES ('${entry25.tag}', UNIX_TIMESTAMP() * 1000);`);
    }

    console.log("\n[SUCCESS] Migration 0025 applied and recorded in production successfully!");
  } else {
    console.log("\n[PROD] Migration 0025 is ALREADY applied in production.");
  }

  // 4. Verify columns and table
  const colRes = await runRailwayMysql("SHOW COLUMNS FROM `academic_lesson_plans`;");
  console.log("\n[PROD] Verified columns in academic_lesson_plans:\n" + colRes.stdout.trim());

  console.log("\n================================================================");
  console.log("  PRODUCTION DATABASE IS FULLY UP TO DATE (Migration 0025)       ");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR] Migration check/apply failed:", err);
  process.exit(1);
});
