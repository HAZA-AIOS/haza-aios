import mysql, { type RowDataPacket } from "mysql2/promise";
import { loadConfig } from "../../config/env.js";

type ForeignKeyRow = RowDataPacket & {
  table_name: string;
  column_name: string;
  referenced_table_name: string;
  referenced_column_name: string;
  constraint_name: string;
};
type CountRow = RowDataPacket & { total: number };
const config = loadConfig(process.env).database;
const db = await mysql.createConnection({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.name,
});

function quoted(value: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new Error("Invalid schema identifier.");
  return `\`${value}\``;
}

async function count(query: string) {
  const [rows] = await db.query<CountRow[]>(query);
  return Number(rows[0]?.total ?? 0);
}

try {
  await db.query("SET TRANSACTION READ ONLY");
  await db.query("START TRANSACTION");
  const [foreignKeys] = await db.query<ForeignKeyRow[]>(
    `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
            REFERENCED_TABLE_NAME AS referenced_table_name,
            REFERENCED_COLUMN_NAME AS referenced_column_name,
            CONSTRAINT_NAME AS constraint_name
       FROM information_schema.key_column_usage
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`,
  );
  const groups = new Map<string, ForeignKeyRow[]>();
  for (const key of foreignKeys) {
    const id = `${key.table_name}:${key.constraint_name}`;
    groups.set(id, [...(groups.get(id) ?? []), key]);
  }
  const checks: Array<{ name: string; failures: number }> = [];
  for (const [name, columns] of groups) {
    const child = quoted(columns[0]!.table_name);
    const parent = quoted(columns[0]!.referenced_table_name);
    const match = columns
      .map((key) => `c.${quoted(key.column_name)} = p.${quoted(key.referenced_column_name)}`)
      .join(" AND ");
    const populated = columns
      .map((key) => `c.${quoted(key.column_name)} IS NOT NULL`)
      .join(" AND ");
    checks.push({
      name: `foreign_key:${name}`,
      failures: await count(
        `SELECT COUNT(*) AS total FROM ${child} c LEFT JOIN ${parent} p ON ${match} WHERE ${populated} AND p.${quoted(columns[0]!.referenced_column_name)} IS NULL`,
      ),
    });
  }
  const tenantChecks: Array<[string, string]> = [
    [
      "agent_run_workspace",
      "SELECT COUNT(*) AS total FROM ai_agent_runs r JOIN workspaces w ON w.id = r.workspace_id WHERE r.organization_id <> w.organization_id",
    ],
    [
      "workflow_run_workspace",
      "SELECT COUNT(*) AS total FROM workflow_runs r JOIN workspaces w ON w.id = r.workspace_id WHERE r.organization_id <> w.organization_id",
    ],
    [
      "usage_workspace",
      "SELECT COUNT(*) AS total FROM usage_meter_events u JOIN workspaces w ON w.id = u.workspace_id WHERE u.organization_id <> w.organization_id",
    ],
    [
      "usage_agent_source",
      "SELECT COUNT(*) AS total FROM usage_meter_events u LEFT JOIN ai_agent_runs r ON r.id = u.source_id AND r.organization_id = u.organization_id AND r.workspace_id = u.workspace_id WHERE u.source_type = 'agent_run' AND r.id IS NULL",
    ],
    [
      "usage_workflow_source",
      "SELECT COUNT(*) AS total FROM usage_meter_events u LEFT JOIN workflow_runs r ON r.id = u.source_id AND r.organization_id = u.organization_id AND r.workspace_id = u.workspace_id WHERE u.source_type = 'workflow_run' AND r.id IS NULL",
    ],
    [
      "subscription_account",
      "SELECT COUNT(*) AS total FROM organization_subscriptions s JOIN billing_accounts a ON a.id = s.billing_account_id WHERE s.organization_id <> a.organization_id",
    ],
    [
      "statement_subscription",
      "SELECT COUNT(*) AS total FROM billing_statements b JOIN organization_subscriptions s ON s.id = b.subscription_id WHERE b.organization_id <> s.organization_id",
    ],
  ];
  for (const [name, query] of tenantChecks) {
    checks.push({ name: `tenant:${name}`, failures: await count(query) });
  }
  await db.query("COMMIT");
  const failures = checks.filter((check) => check.failures > 0);
  console.info(
    JSON.stringify({
      database: config.name,
      foreignKeyChecks: groups.size,
      tenantChecks: tenantChecks.length,
      failures,
      status: failures.length ? "FAILED" : "PASS",
    }),
  );
  if (failures.length) process.exitCode = 1;
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
}
