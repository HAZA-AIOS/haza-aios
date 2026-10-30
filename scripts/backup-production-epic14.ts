import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";
const DEST_DIR = "C:\\Users\\theme\\HAZA-AIOS-Private\\production-backups\\epic14";

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS - Production Backup Utility (Epic 14 Release)       ");
  console.log("================================================================");

  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const dumpFileName = `haza-aios-production-epic14-backup_${timestamp}.sql`;
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

    child.on("error", (err) => {
      reject(err);
    });
  });

  const stats = fs.statSync(dumpFilePath);
  console.log(`[INFO] Dump completed. File size: ${stats.size.toLocaleString()} bytes`);

  if (stats.size < 100_000) {
    throw new Error(`Backup file is suspiciously small (${stats.size} bytes). Potential truncated dump.`);
  }

  // Validate trailing text contains Dump completed
  const trailingBuffer = Buffer.alloc(4096);
  const fd = fs.openSync(dumpFilePath, "r");
  const readStart = Math.max(0, stats.size - 4096);
  fs.readSync(fd, trailingBuffer, 0, 4096, readStart);
  fs.closeSync(fd);
  const trailingText = trailingBuffer.toString("utf8");

  if (!trailingText.includes("Dump completed")) {
    throw new Error("Dump does not contain final 'Dump completed' marker. Dump may be incomplete.");
  }

  console.log("[PASS] Validated dump completeness: 'Dump completed' signature found.");

  // Compute SHA-256
  console.log("[EXEC] Computing SHA-256 checksum...");
  const hash = crypto.createHash("sha256");
  const fileBuffer = fs.readFileSync(dumpFilePath);
  hash.update(fileBuffer);
  const sha256 = hash.digest("hex").toUpperCase();

  fs.writeFileSync(checksumFilePath, `${sha256} *${dumpFileName}\n`);
  console.log(`[SUCCESS] Backup Verified:`);
  console.log(`  File:   ${dumpFilePath}`);
  console.log(`  Size:   ${stats.size.toLocaleString()} bytes`);
  console.log(`  SHA256: ${sha256}`);
  console.log("================================================================");
}

main().catch((err) => {
  console.error("[FATAL ERROR]:", err);
  process.exit(1);
});
