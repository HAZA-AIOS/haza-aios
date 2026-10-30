import { spawn } from "node:child_process";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";

async function runRailwayMysql(sql: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
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
      'mysql -u root -p"$MYSQL_ROOT_PASSWORD" railway',
    ]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`MySQL execution failed (exit ${code}): ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    child.stdin.write(sql);
    child.stdin.end();
  });
}

async function main() {
  console.log("Cleaning up all smoke test records in production...");
  await runRailwayMysql(`
    DELETE FROM ai_agent_messages WHERE agent_run_id IN (SELECT id FROM ai_agent_runs WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %'));
    DELETE FROM ai_agent_runtime_usage WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %');
    DELETE FROM ai_agent_run_events WHERE run_id IN (SELECT id FROM ai_agent_runs WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %'));
    DELETE FROM ai_agent_run_attempts WHERE run_id IN (SELECT id FROM ai_agent_runs WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %'));
    DELETE FROM ai_agent_approval_decisions WHERE approval_request_id IN (SELECT id FROM ai_agent_approval_requests WHERE run_id IN (SELECT id FROM ai_agent_runs WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %')));
    DELETE FROM ai_agent_approval_requests WHERE run_id IN (SELECT id FROM ai_agent_runs WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %'));
    DELETE FROM ai_agent_runs WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %');
    DELETE FROM ai_agent_messages WHERE conversation_id IN (SELECT id FROM ai_agent_conversations WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %'));
    DELETE FROM ai_agent_conversations WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %');
    DELETE FROM ai_agent_configuration_revisions WHERE agent_id IN (SELECT id FROM ai_agent_definitions WHERE name LIKE 'Smoke %');
    DELETE FROM ai_agent_definitions WHERE name LIKE 'Smoke %';
    DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke.reviewer.%');
    DELETE FROM membership_roles WHERE membership_id IN (SELECT id FROM organization_memberships WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke.reviewer.%'));
    DELETE FROM organization_memberships WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke.reviewer.%');
    DELETE FROM users WHERE email LIKE 'smoke.reviewer.%';
  `);
  console.log("Cleanup finished.");
}

main().catch(console.error);
