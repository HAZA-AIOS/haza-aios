import { spawn } from "child_process";
import fs from "fs";
import path from "path";

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
      if (attempt < retries && (err.message.includes("can't verify your SSH key") || err.message.includes("Connection reset"))) {
        console.log(`  [RETRY ${attempt}/${retries}] Retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Exhausted retries");
}

async function main() {
  console.log("=== Checking Production Database Migrations ===");
  const migRows = await runRailwayMysql("SELECT id, hash, FROM_UNIXTIME(created_at/1000) as applied_at FROM `__drizzle_migrations` ORDER BY id DESC LIMIT 5;");
  console.log("Latest applied migrations:\n" + migRows.stdout.trim());

  // Check if 0023 was applied
  const checkCol = await runRailwayMysql("SHOW COLUMNS FROM `ai_agent_definitions` LIKE 'active_revision%';");
  console.log("\nChecking ai_agent_definitions columns:\n" + checkCol.stdout.trim());

  if (!checkCol.stdout.includes("active_revision_number")) {
    console.log("\nMigration 0023 not yet applied in production. Applying now...");
    const migFile = path.resolve("apps/api/src/database/migrations/0023_agent_configuration_builder.sql");
    const migSql = fs.readFileSync(migFile, "utf-8");
    const statements = migSql.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.replace(/\s+/g, " ").substring(0, 60);
      console.log(`  Executing [${i + 1}/${statements.length}]: ${preview}...`);
      await runRailwayMysql(stmt);
    }

    // Record migration in __drizzle_migrations
    const journalPath = path.resolve("apps/api/src/database/migrations/meta/_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const entry23 = journal.entries.find((e: any) => e.idx === 23);
    if (entry23) {
      console.log(`Recording migration 23 (${entry23.tag}) in __drizzle_migrations...`);
      await runRailwayMysql(`INSERT INTO \`__drizzle_migrations\` (hash, created_at) VALUES ('${entry23.tag}', UNIX_TIMESTAMP() * 1000);`);
    }

    console.log("\nMigration 0023 applied and recorded successfully!");
  } else {
    console.log("\nMigration 0023 already applied in production!");
  }

  // Verify linkage and row count
  const revCount = await runRailwayMysql("SELECT count(*) as count FROM `ai_agent_configuration_revisions`;");
  console.log("\nai_agent_configuration_revisions row count: " + revCount.stdout.trim());

  const linkCheck = await runRailwayMysql("SELECT d.id, d.name, d.active_revision_number, d.active_revision_id, r.version, r.status FROM `ai_agent_definitions` d JOIN `ai_agent_configuration_revisions` r ON d.active_revision_id = r.id LIMIT 5;");
  console.log("\nActive revision linkage in production:\n" + linkCheck.stdout.trim());
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
