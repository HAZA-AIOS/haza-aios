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
  const memRoleDesc = await runRailwayMysql("DESCRIBE membership_roles;");
  console.log("=== DESCRIBE membership_roles ===\n" + memRoleDesc);

  const authDesc = await runRailwayMysql("DESCRIBE auth_sessions;");
  console.log("=== DESCRIBE auth_sessions ===\n" + authDesc);
}

main().catch(console.error);
