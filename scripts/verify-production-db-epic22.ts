import { spawn } from "node:child_process";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";
const PROD_DB = "railway";

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

async function main() {
  console.log("=== CHECKING PRODUCTION __drizzle_migrations ===");
  const migs = await queryMysql("SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 10;");
  console.log(migs);

  console.log("=== CHECKING PRODUCTION TABLE COUNT ===");
  const tables = await queryMysql("SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'railway';");
  console.log(tables);

  console.log("=== CHECKING PRODUCTION FOREIGN KEY COUNT ===");
  const fks = await queryMysql("SELECT COUNT(*) as fk_count FROM information_schema.table_constraints WHERE constraint_schema = 'railway' AND constraint_type = 'FOREIGN KEY';");
  console.log(fks);

  console.log("=== VERIFYING ALL 28 EPIC 22 TABLES ===");
  const epic22Tables = [
    "agent_governance_profiles",
    "agent_ownership_assignments",
    "agent_governance_audit_log",
    "agent_approval_requests",
    "agent_approval_decisions",
    "agent_approval_escalations",
    "agent_security_profiles",
    "agent_secret_references",
    "agent_security_events",
    "agent_compliance_events",
    "agent_audit_integrity_chains",
    "agent_compliance_frameworks",
    "agent_compliance_controls",
    "agent_compliance_control_mappings",
    "agent_compliance_evidence",
    "agent_compliance_evidence_packages",
    "agent_compliance_retention_policies",
    "agent_compliance_legal_holds",
    "agent_compliance_investigations",
    "agent_risk_configurations",
    "agent_risk_register",
    "agent_risk_assessments",
    "agent_trust_profiles",
    "agent_trust_assessment_history",
    "agent_behavioral_risk_alerts",
    "agent_risk_mitigations",
    "agent_risk_exceptions",
    "agent_risk_review_history",
  ];

  const checkTablesSql = `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'railway'
      AND table_name IN (${epic22Tables.map((t) => `'${t}'`).join(",")})
    ORDER BY table_name;
  `;
  const foundTables = await queryMysql(checkTablesSql);
  const foundList = foundTables.trim().split("\n").filter((l) => l.trim() && l.trim() !== "table_name");
  console.log(`Found ${foundList.length} / 28 Epic 22 tables:\n${foundList.join(", ")}`);
}

main().catch(console.error);
