import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeDatabaseConfig } from "./test-database-guard.js";
import { loadConfig } from "../../src/config/env.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
  path.resolve(currentDir, "../../.env.test.local"),
  path.resolve(currentDir, "../../../.env.test.local"),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const equalsIdx = line.indexOf("=");
      if (equalsIdx > 0) {
        const key = line.slice(0, equalsIdx).trim();
        const value = line.slice(equalsIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
    break;
  }
}

// If integration tests are enabled, fail closed immediately if configuration is unsafe
if (process.env.RUN_DB_INTEGRATION_TESTS === "true") {
  const config = loadConfig({ ...process.env, NODE_ENV: "test" });
  assertSafeDatabaseConfig(config.database, process.env.NODE_ENV || "test");
}
