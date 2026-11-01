/**
 * Epic 17 fictional learning fixture validation and dry-run preview.
 * Never connects to databases, HTTP services, or production systems.
 * Usage: node scripts/preview-epic17-learning-fixtures.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(root, "apps/api/src/database/fixtures/epic17-learning-demo.json");
const data = JSON.parse(readFileSync(fixturePath, "utf8"));
const fail = (message) => { throw new Error(`Fixture validation failed: ${message}`); };

if (data.synthetic !== true || data.usage?.productionAutoSeed !== false || data.usage?.mode !== "fixture-only") {
  fail("synthetic fixture-only / no-production-auto-seed guard missing");
}
if (!data.school?.name?.includes("FICTIONAL")) fail("fictional school marker missing");
if (!Array.isArray(data.sections) || data.sections.length !== 31) fail("expected 31 sections");
const ids = new Set();
const keys = new Set();
for (const section of data.sections) {
  if (section.synthetic !== true || section.visibility !== "demo-only") fail(`unsafe section ${section.id}`);
  if (!section.id || !section.section || !section.title || !section.content) fail("incomplete record");
  if (ids.has(section.id) || keys.has(section.section)) fail(`duplicate ${section.id}`);
  ids.add(section.id); keys.add(section.section);
}
const forbidden = /@(?:gmail|yahoo|outlook)\.com|\b(?:030\d|031\d|032\d|033\d|034\d)-?\d{7}\b/i;
if (forbidden.test(JSON.stringify(data))) fail("possible real contact information detected");
const report = {
  fixtureSet: data.fixtureSet,
  mode: "DRY_RUN_ONLY",
  recordCount: data.sections.length,
  sections: data.sections.map(({ id, section, title }) => ({ id, section, title })),
  databaseWrites: 0,
  apiCalls: 0,
  nextStep: "Implement authenticated domain mapping and import adapter; use isolated test database and obtain verified target tenant before any writes."
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
