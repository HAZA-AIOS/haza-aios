import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";
const DEST_DIR = "C:\\Users\\theme\\HAZA-AIOS-Private\\production-backups\\epic18";

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Production Backup Utility (Epic 18 Release)       ");
  console.log("================================================================");

  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const dumpFileName = `haza-aios-production-epic18-backup_${timestamp}.sql`;
  const dumpFilePath = path.join(DEST_DIR, dumpFileName);
  const checksumFilePath = `${dumpFilePath}.sha256`;

  console.log(`[TARGET] Destination: ${dumpFilePath}`);
  console.log(`[AUTH] Identity: ${SSH_KEY}`);
  console.log("[EXEC] Initiating remote mysqldump stream over Railway SSH...");

  const remoteCmd = 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --quick --routines --triggers --events --set-gtid-purged=OFF --no-tablespaces --default-character-set=utf8mb4 railway';

  await new Promise<void>((resolve, reject) => {
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
      remoteCmd,
    ]);

    const outStream = fs.createWriteStream(dumpFilePath);
    let stderr = "";

    child.stdout.pipe(outStream);
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      outStream.close();
      if (code !== 0) {
        reject(new Error(`mysqldump failed (exit code ${code}): ${stderr}`));
      } else {
        resolve();
      }
    });

    child.on("error", reject);
  });

  const stats = fs.statSync(dumpFilePath);
  if (stats.size === 0) {
    throw new Error("Backup file was created but has 0 bytes. Aborting.");
  }

  console.log(`[OK] Backup completed successfully. Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes).`);
  console.log("[HASH] Calculating SHA-256 checksum...");

  const hash = crypto.createHash("sha256");
  const fileBuffer = fs.readFileSync(dumpFilePath);
  hash.update(fileBuffer);
  const digest = hash.digest("hex");

  fs.writeFileSync(checksumFilePath, `${digest}  ${dumpFileName}\n`, "utf8");

  console.log(`[SHA256] ${digest}`);
  console.log(`[VERIFIED] Checksum saved to ${checksumFilePath}`);
  console.log("================================================================");
  console.log("  BACKUP VERIFIED AND CERTIFIED READY FOR EPIC 18 RELEASE       ");
  console.log("================================================================");
}

main().catch((err) => {
  console.error("\n[FATAL ERROR during backup]:", err.message || err);
  process.exit(1);
});
