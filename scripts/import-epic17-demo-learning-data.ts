import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SSH_KEY = "C:\\Users\\theme\\.ssh\\haza_railway_stage19_ed25519";
const PROD_DB = "railway";

interface ExecutionOptions {
  apply: boolean;
  cleanup: boolean;
  verbose: boolean;
}

export interface ImportStats {
  mode: "DRY_RUN" | "APPLY";
  organizationId: string;
  workspaceId: string;
  ownerId: string;
  counts: {
    organizations: number;
    workspaces: number;
    organizationModules: number;
    academicYears: number;
    academicTerms: number;
    gradeLevels: number;
    sections: number;
    subjects: number;
    classSubjects: number;
    staffDepartments: number;
    staffMembers: number;
    teachingAssignments: number;
    students: number;
    enrollments: number;
    schoolSchedules: number;
    timePeriods: number;
    timetableEntries: number;
    attendanceSessions: number;
    attendanceRecords: number;
    academicLessonPlans: number;
    examinations: number;
    assessments: number;
    gradingRules: number;
    markRecords: number;
    knowledgeCollections: number;
    knowledgeSources: number;
    knowledgeChunks: number;
    knowledgeDocuments: number;
    knowledgeEmbeddings: number;
  };
  sectionMapping: Array<{
    id: string;
    section: string;
    title: string;
    status: "SUPPORTED" | "INTEGRATED_EXTENDED";
    targetTable: string;
    notes: string;
  }>;
}

// -------------------------------------------------------------
// Database Access via Railway SSH
// -------------------------------------------------------------
async function runRailwayMysql(sql: string, retries = 3): Promise<{ stdout: string; stderr: string }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const shCmd = `mysql -u root -p"$MYSQL_ROOT_PASSWORD" ${PROD_DB}`;

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
      if (attempt < retries && (err.message.includes("can't verify your SSH key") || err.message.includes("Connection reset") || err.message.includes("broken pipe"))) {
        console.log(`  [RETRY ${attempt}/${retries}] Transient SSH issue encountered, retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Exhausted retries");
}

// -------------------------------------------------------------
// Stable Synthetic Identifiers for Idempotency
// -------------------------------------------------------------
export const DEMO_IDS = {
  orgId: "00000000-0000-4710-a000-000000000001",
  workspaceId: "00000000-0000-4710-b000-000000000001",
  ownerId: "b99f5271-60a9-475c-9a37-a1ada249b11e", // Mussawar Hussain (Authorized Admin)
  membershipId: "00000000-0000-4710-c000-000000000001",
  wsMembershipId: "00000000-0000-4710-c000-000000000002",
  academicYearId: "00000000-0000-4710-8000-000000000001",
  termAutumnId: "00000000-0000-4710-8000-000000000002",
  termSpringId: "00000000-0000-4710-8000-000000000003",
  grade4Id: "00000000-0000-4710-8000-000000000004",
  grade5Id: "00000000-0000-4710-8000-000000000005",
  grade6Id: "00000000-0000-4710-8000-000000000006",
  section4AId: "00000000-0000-4710-8000-000000000007",
  section5AId: "00000000-0000-4710-8000-000000000008",
  section6AId: "00000000-0000-4710-8000-000000000009",
  subjectEngId: "00000000-0000-4710-8000-000000000010",
  subjectMathId: "00000000-0000-4710-8000-000000000011",
  subjectSciId: "00000000-0000-4710-8000-000000000012",
  subjectIctId: "00000000-0000-4710-8000-000000000013",
  deptScienceId: "00000000-0000-4710-8000-000000000014",
  deptStemId: "00000000-0000-4710-8000-000000000015",
  staffThorneId: "00000000-0000-4710-8000-000000000016",
  staffVanceId: "00000000-0000-4710-8000-000000000017",
  staffKimId: "00000000-0000-4710-8000-000000000018",
  scheduleId: "00000000-0000-4710-8000-000000000019",
  period1Id: "00000000-0000-4710-8000-000000000020",
  period2Id: "00000000-0000-4710-8000-000000000021",
  period3Id: "00000000-0000-4710-8000-000000000022",
  attendanceSessionId: "00000000-0000-4710-8000-000000000023",
  lessonPlanCellsId: "00000000-0000-4710-8000-000000000024",
  lessonPlanCompareId: "00000000-0000-4710-8000-000000000025",
  examMidTermId: "00000000-0000-4710-8000-000000000026",
  assessmentQuizId: "00000000-0000-4710-8000-000000000027",
  knowledgeColId: "00000000-0000-4710-8000-000000000028",
};

// -------------------------------------------------------------
// 6 Rich Fictional Science Reference Documents
// -------------------------------------------------------------
export const SCIENCE_DOCUMENTS = [
  {
    sourceId: "00000000-0000-4710-9000-000000000001",
    docId: "00000000-0000-4710-9000-000000000011",
    title: "Cells and Cell Structures Overview",
    fileName: "cells-and-cell-structures-overview.md",
    description: "Core curriculum notes on fundamental cellular anatomy and organelles.",
    content: `# Cells and Cell Structures Overview
## Introduction to Cells
All living organisms are composed of microscopic units called cells. The cell is the fundamental unit of structure and function in all living organisms. While organisms differ widely, their cellular foundations share common biological characteristics.

## Essential Shared Structures
Plant and animal cells share several vital organelles:
1. Cell Membrane: A flexible, selectively permeable outer boundary that controls the movement of substances into and out of the cell.
2. Cytoplasm: A jelly-like substance where most chemical reactions take place and organelles are suspended.
3. Genetic Material (DNA): Hereditary material stored within the nucleus that provides the genetic blueprint.
4. Mitochondria: The powerhouses of the cell where cellular respiration occurs to release chemical energy (ATP).
5. Ribosomes: Small cellular complexes responsible for protein synthesis.

## Nucleus Function
The nucleus acts as the control centre of the eukaryotic cell. It contains chromosomes composed of DNA and regulates cellular growth, reproduction, and metabolic activities by directing protein synthesis.`,
  },
  {
    sourceId: "00000000-0000-4710-9000-000000000002",
    docId: "00000000-0000-4710-9000-000000000012",
    title: "Plant and Animal Cell Comparison Guide",
    fileName: "plant-and-animal-cell-comparison-guide.md",
    description: "Detailed comparative analysis distinguishing plant and animal cells.",
    content: `# Plant and Animal Cell Comparison Guide
## Comparative Analysis
Both plant and animal cells are eukaryotic, meaning they possess membrane-bound organelles and a defined nucleus. However, plants require specialized structures for structural support and photosynthesis.

## Plant-Specific Organelles
1. Rigid Cell Wall: Located outside the cell membrane, made of cellulose, providing structural support and rigidity to plant tissues.
2. Chloroplasts: Organelles containing green chlorophyll pigments that absorb sunlight for photosynthesis, converting carbon dioxide and water into glucose and oxygen.
3. Large Central Vacuole: A single prominent vacuole filled with cell sap that maintains turgor pressure and stores water and nutrients.

## Shared Structures
Both plant and animal cells share the following:
- Cell membrane
- Cytoplasm
- Nucleus and genetic material
- Mitochondria
- Ribosomes

Animal cells typically possess smaller, temporary vacuoles and centrosomes, and lack chloroplasts and rigid cell walls.`,
  },
  {
    sourceId: "00000000-0000-4710-9000-000000000003",
    docId: "00000000-0000-4710-9000-000000000013",
    title: "Cellular Tissues and Organization",
    fileName: "cellular-tissues-and-organization.md",
    description: "Organizational hierarchy from cells to tissues, organs, and organ systems.",
    content: `# Cellular Tissues and Organization
## Levels of Organization in Multicellular Organisms
Living systems are organized in a hierarchy:
Cells -> Tissues -> Organs -> Organ Systems -> Organism.

## What is a Tissue?
A tissue is a group of similar cells working together to perform a specialized function.

## Major Types of Animal Tissues
1. Epithelial Tissue: Covers body surfaces and line internal cavities (e.g. skin, lining of digestive tract).
2. Muscle Tissue: Cells capable of contracting to produce movement (skeletal, smooth, cardiac).
3. Connective Tissue: Supports, protects, and binds other tissues together (e.g. bone, blood, cartilage).
4. Nervous Tissue: Composed of neurons that transmit electrical impulses throughout the body.

## Major Types of Plant Tissues
- Epidermal tissue: Protective outer layer.
- Mesophyll tissue: Photosynthetic tissue in leaves.
- Xylem and Phloem: Vascular transport tissues for water, minerals, and sugars.`,
  },
  {
    sourceId: "00000000-0000-4710-9000-000000000004",
    docId: "00000000-0000-4710-9000-000000000014",
    title: "Human Body Systems and Cell Functions",
    fileName: "human-body-systems-and-cell-functions.md",
    description: "Interconnection between specialized cells, tissues, and human body systems.",
    content: `# Human Body Systems and Cell Functions
## Integration of Body Systems
Human body systems depend on specialized cells and tissues working in coordination:
1. Circulatory System: Red blood cells lack nuclei at maturity to maximize hemoglobin space for oxygen transport. Cardiac muscle tissue pumps blood continuously.
2. Respiratory System: Ciliated epithelial cells line the trachea to sweep mucus and trapped particles away from the lungs.
3. Nervous System: Nerve cells (neurons) feature elongated axons designed to rapidly conduct electrochemical signals.
4. Digestive System: Specialized epithelial cells in the stomach and intestine secrete enzymes and absorb nutrients into the bloodstream.

## Homeostasis
Cells require a stable internal environment (homeostasis) including regulated temperature, pH, glucose levels, and hydration to sustain cellular respiration and life.`,
  },
  {
    sourceId: "00000000-0000-4710-9000-000000000005",
    docId: "00000000-0000-4710-9000-000000000015",
    title: "Scientific Investigation and Microscopy Protocol",
    fileName: "scientific-investigation-and-microscopy-protocol.md",
    description: "Laboratory guidelines for preparing slides and observing cells under light microscopes.",
    content: `# Scientific Investigation and Microscopy Protocol
## Laboratory Safety Rules
1. Wear safety goggles when handling biological stains (such as iodine or methylene blue).
2. Handle glass microscope slides and cover slips by the edges to prevent breakage and smudges.
3. Lower the stage before placing or removing a slide.

## Slide Preparation Method (Onion Epidermal Cells)
1. Peel a thin, transparent single layer of epidermal tissue from the inside of an onion bulb.
2. Place the tissue flat in the centre of a clean glass slide without folds.
3. Add one drop of dilute iodine solution to stain the cell wall and nucleus.
4. Gently lower the cover slip at a 45-degree angle to avoid trapping air bubbles.
5. Focus initially using the low-power objective lens before switching to high-power.`,
  },
  {
    sourceId: "00000000-0000-4710-9000-000000000006",
    docId: "00000000-0000-4710-9000-000000000016",
    title: "Grade 6 Science Lesson Planning Guidelines",
    fileName: "grade-6-science-lesson-planning-guidelines.md",
    description: "Pedagogical guidelines and learning objectives for Grade 6 Cells unit.",
    content: `# Grade 6 Science Lesson Planning Guidelines
## Unit: Cells and Living Systems
Target Grade: Grade 6 (Middle School)
Duration: 40-45 minutes per lesson session

## Key Learning Objectives
Students will be able to:
- LO-1: Identify and describe the function of the cell membrane, cytoplasm, and nucleus.
- LO-2: Contrast the structural differences between plant and animal cells with emphasis on chloroplasts and cell walls.
- LO-3: Explain the hierarchy of organization from cells to tissues, organs, and organisms.
- LO-4: Prepare a wet-mount slide and observe plant cell structures under a light microscope.

## Recommended Lesson Structure
1. Hook / Starter (5-10 mins): Everyday analogy comparing cell organelles to parts of a school or factory.
2. Direct Instruction (15 mins): Diagram analysis and interactive labeling of cell parts.
3. Guided Activity (15 mins): Venn diagram comparing plant and animal cell organelles.
4. Plenary / Formative Exit Ticket (5 mins): Brief 3-question check on nucleus function and shared organelles.`,
  },
];

// -------------------------------------------------------------
// Helper to build deterministic mock vector (1536 floats) matching MockEmbeddingProvider
// -------------------------------------------------------------
function generateDeterministicVector(text: string, dimensions = 1536): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? ["empty"];

  for (const word of words) {
    const hash = crypto.createHash("sha256").update(word).digest();
    for (let i = 0; i < 16; i++) {
      const val = hash.readInt16LE(i * 2);
      const index = Math.abs(val) % dimensions;
      vector[index] += val / 32768.0;
    }
  }

  let normSq = 0;
  for (let i = 0; i < dimensions; i++) {
    normSq += vector[i] * vector[i];
  }

  const norm = Math.sqrt(normSq) || 1.0;
  for (let i = 0; i < dimensions; i++) {
    vector[i] = Number((vector[i] / norm).toFixed(6));
  }

  return vector;
}

// -------------------------------------------------------------
// Main Import Logic
// -------------------------------------------------------------
export async function executeDemoImport(options: ExecutionOptions): Promise<ImportStats> {
  const mode = options.apply ? "APPLY" : "DRY_RUN";
  console.log("================================================================");
  console.log(`  HAZA AIOS - Epic 17 Demo Academy Importer [${mode} MODE]       `);
  console.log("================================================================");
  console.log(`Target Organization: HAZA-AIOS Demo Academy (${DEMO_IDS.orgId})`);
  console.log(`Target Workspace:    Demo Learning Campus (${DEMO_IDS.workspaceId})`);
  console.log(`Authorized Admin:    Mussawar Hussain (${DEMO_IDS.ownerId})`);
  console.log(`Mode:                ${mode}`);
  console.log("----------------------------------------------------------------\n");

  const stats: ImportStats = {
    mode,
    organizationId: DEMO_IDS.orgId,
    workspaceId: DEMO_IDS.workspaceId,
    ownerId: DEMO_IDS.ownerId,
    counts: {
      organizations: 0,
      workspaces: 0,
      organizationModules: 0,
      academicYears: 0,
      academicTerms: 0,
      gradeLevels: 0,
      sections: 0,
      subjects: 0,
      classSubjects: 0,
      staffDepartments: 0,
      staffMembers: 0,
      teachingAssignments: 0,
      students: 0,
      enrollments: 0,
      schoolSchedules: 0,
      timePeriods: 0,
      timetableEntries: 0,
      attendanceSessions: 0,
      attendanceRecords: 0,
      academicLessonPlans: 0,
      examinations: 0,
      assessments: 0,
      gradingRules: 0,
      markRecords: 0,
      knowledgeCollections: 0,
      knowledgeSources: 0,
      knowledgeChunks: 0,
      knowledgeDocuments: 0,
      knowledgeEmbeddings: 0,
    },
    sectionMapping: [],
  };

  if (options.cleanup) {
    console.log("[CLEANUP] Rolling back synthetic Demo Academy entities...");
    if (options.apply) {
      const cleanupSql = `
        DELETE FROM ai_agent_knowledge_embeddings WHERE organization_id = '${DEMO_IDS.orgId}';
        DELETE FROM ai_agent_knowledge_documents WHERE organization_id = '${DEMO_IDS.orgId}';
        DELETE FROM knowledge_chunks WHERE organization_id = '${DEMO_IDS.orgId}';
        DELETE FROM knowledge_sources WHERE organization_id = '${DEMO_IDS.orgId}';
        DELETE FROM knowledge_collections WHERE organization_id = '${DEMO_IDS.orgId}';
        DELETE FROM academic_lesson_plans WHERE organization_id = '${DEMO_IDS.orgId}';
        DELETE FROM mark_records WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM assessments WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM examinations WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM attendance_records WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM attendance_sessions WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM timetable_entries WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM time_periods WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM school_schedules WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM enrollments WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM students WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM teaching_assignments WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM staff_members WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM staff_departments WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM class_subjects WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM subjects WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM sections WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM grade_levels WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM academic_terms WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM academic_years WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM workspace_memberships WHERE workspace_id = '${DEMO_IDS.workspaceId}';
        DELETE FROM workspaces WHERE id = '${DEMO_IDS.workspaceId}';
        DELETE FROM organization_modules WHERE organization_id = '${DEMO_IDS.orgId}';
        DELETE FROM organization_memberships WHERE organization_id = '${DEMO_IDS.orgId}';
        DELETE FROM organization_settings WHERE organization_id = '${DEMO_IDS.orgId}';
        DELETE FROM organizations WHERE id = '${DEMO_IDS.orgId}';
      `;
      await runRailwayMysql(cleanupSql);
      console.log("[CLEANUP] Rollback complete. All synthetic entities cleanly removed.");
    } else {
      console.log("[DRY_RUN] Would delete all records under organization " + DEMO_IDS.orgId);
    }
    return stats;
  }

  // -----------------------------------------------------------
  // Build SQL Statements (with exact production schema columns)
  // -----------------------------------------------------------
  const statements: string[] = [];

  // 1. Organization & Settings & Workspaces
  statements.push(`
    INSERT INTO organizations (id, name, legal_name, slug, industry, organization_type, description, website, email, phone, country, timezone, currency, organization_status, owner_id)
    VALUES ('${DEMO_IDS.orgId}', 'HAZA-AIOS Demo Academy', 'HAZA-AIOS Demo Academy (Fictional)', 'haza-demo-academy', 'Education', 'Educational Institution', 'Fictional demonstration academy for HAZA-AIOS LMS and RAG acceptance testing.', 'https://demo.haza-aios.com', 'admin@demo.haza-aios.com', '+1-555-0199', 'United States', 'UTC', 'USD', 'active', '${DEMO_IDS.ownerId}')
    ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description);
  `);
  stats.counts.organizations++;

  statements.push(`
    INSERT INTO organization_settings (id, organization_id, timezone, locale, currency, preferences)
    VALUES ('${DEMO_IDS.orgId}', '${DEMO_IDS.orgId}', 'UTC', 'en-US', 'USD', '{"environment": "demo", "synthetic": true}')
    ON DUPLICATE KEY UPDATE locale = VALUES(locale);
  `);

  statements.push(`
    INSERT INTO organization_memberships (id, organization_id, user_id, organization_membership_role, organization_membership_status)
    VALUES ('${DEMO_IDS.membershipId}', '${DEMO_IDS.orgId}', '${DEMO_IDS.ownerId}', 'Owner', 'active')
    ON DUPLICATE KEY UPDATE organization_membership_status = 'active';
  `);

  statements.push(`
    INSERT INTO workspaces (id, organization_id, name, code, workspace_type, workspace_status)
    VALUES ('${DEMO_IDS.workspaceId}', '${DEMO_IDS.orgId}', 'Demo Learning Campus', 'demo-learning-campus', 'primary', 'active')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);
  stats.counts.workspaces++;

  statements.push(`
    INSERT INTO workspace_memberships (id, workspace_id, organization_membership_id, organization_membership_status)
    VALUES ('${DEMO_IDS.wsMembershipId}', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.membershipId}', 'active')
    ON DUPLICATE KEY UPDATE organization_membership_status = 'active';
  `);

  statements.push(`
    INSERT INTO organization_modules (id, organization_id, module_key, organization_module_status, enabled, activated_by, settings)
    VALUES ('${crypto.randomUUID()}', '${DEMO_IDS.orgId}', 'education-sis', 'activated', 1, '${DEMO_IDS.ownerId}', '{"demo": true, "environment": "fictional"}')
    ON DUPLICATE KEY UPDATE enabled = 1, organization_module_status = 'activated';
  `);
  stats.counts.organizationModules++;

  // 2. Academic Year: 2026–2027
  statements.push(`
    INSERT INTO academic_years (id, workspace_id, name, start_date, end_date, academic_year_status)
    VALUES ('${DEMO_IDS.academicYearId}', '${DEMO_IDS.workspaceId}', 'Academic Year 2026–2027 (DEMO)', '2026-09-01', '2027-06-30', 'active')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);
  stats.counts.academicYears++;

  // 3. Academic Terms: Autumn Term 2026, Spring Term 2027
  statements.push(`
    INSERT INTO academic_terms (id, workspace_id, academic_year_id, name, start_date, end_date, academic_term_status)
    VALUES 
      ('${DEMO_IDS.termAutumnId}', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.academicYearId}', 'Autumn Term 2026 (DEMO)', '2026-09-01', '2026-12-20', 'active'),
      ('${DEMO_IDS.termSpringId}', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.academicYearId}', 'Spring Term 2027 (DEMO)', '2027-01-10', '2027-06-30', 'active')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);
  stats.counts.academicTerms += 2;

  // 4. Grade Levels: Grade 4, Grade 5, Grade 6
  statements.push(`
    INSERT INTO grade_levels (id, workspace_id, name, level, display_order, academic_entity_status)
    VALUES 
      ('${DEMO_IDS.grade4Id}', '${DEMO_IDS.workspaceId}', 'Grade 4 (DEMO)', 4, 1, 'active'),
      ('${DEMO_IDS.grade5Id}', '${DEMO_IDS.workspaceId}', 'Grade 5 (DEMO)', 5, 2, 'active'),
      ('${DEMO_IDS.grade6Id}', '${DEMO_IDS.workspaceId}', 'Grade 6 (DEMO)', 6, 3, 'active')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);
  stats.counts.gradeLevels += 3;

  // 5. Sections: Grade 4 - Section A, Grade 5 - Section A, Grade 6 - Section A
  statements.push(`
    INSERT INTO sections (id, workspace_id, grade_id, name, capacity, academic_entity_status)
    VALUES 
      ('${DEMO_IDS.section4AId}', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.grade4Id}', 'Grade 4 — Section A (DEMO)', 25, 'active'),
      ('${DEMO_IDS.section5AId}', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.grade5Id}', 'Grade 5 — Section A (DEMO)', 25, 'active'),
      ('${DEMO_IDS.section6AId}', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.grade6Id}', 'Grade 6 — Section A (DEMO)', 25, 'active')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);
  stats.counts.sections += 3;

  // 6. Subjects: English, Mathematics, Science, ICT
  statements.push(`
    INSERT INTO subjects (id, workspace_id, name, code, description, academic_entity_status, display_order)
    VALUES 
      ('${DEMO_IDS.subjectEngId}', '${DEMO_IDS.workspaceId}', 'English Language & Literature (DEMO)', 'DEMO-ENG', 'Fictional English curriculum covering literacy and composition.', 'active', 1),
      ('${DEMO_IDS.subjectMathId}', '${DEMO_IDS.workspaceId}', 'Mathematics (DEMO)', 'DEMO-MATH', 'Fictional Mathematics curriculum covering algebra and geometry.', 'active', 2),
      ('${DEMO_IDS.subjectSciId}', '${DEMO_IDS.workspaceId}', 'Science (DEMO)', 'DEMO-SCI', 'Fictional Science curriculum covering cellular biology, ecosystems, and physical science.', 'active', 3),
      ('${DEMO_IDS.subjectIctId}', '${DEMO_IDS.workspaceId}', 'Information & Communication Tech (DEMO)', 'DEMO-ICT', 'Fictional ICT curriculum covering computational thinking.', 'active', 4)
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);
  stats.counts.subjects += 4;

  // 7. Class Subjects (Linking Grades to Subjects)
  const classSubjectPairs = [
    { grade: DEMO_IDS.grade6Id, subject: DEMO_IDS.subjectSciId, id: "00000000-0000-4710-8000-000000000031" },
    { grade: DEMO_IDS.grade6Id, subject: DEMO_IDS.subjectMathId, id: "00000000-0000-4710-8000-000000000032" },
    { grade: DEMO_IDS.grade6Id, subject: DEMO_IDS.subjectEngId, id: "00000000-0000-4710-8000-000000000033" },
    { grade: DEMO_IDS.grade6Id, subject: DEMO_IDS.subjectIctId, id: "00000000-0000-4710-8000-000000000034" },
  ];
  for (const cs of classSubjectPairs) {
    statements.push(`
      INSERT INTO class_subjects (id, workspace_id, grade_id, subject_id)
      VALUES ('${cs.id}', '${DEMO_IDS.workspaceId}', '${cs.grade}', '${cs.subject}')
      ON DUPLICATE KEY UPDATE grade_id = VALUES(grade_id);
    `);
    stats.counts.classSubjects++;
  }

  // 8. Staff Departments & Members (3 Fictional Teachers)
  statements.push(`
    INSERT INTO staff_departments (id, workspace_id, name, description)
    VALUES 
      ('${DEMO_IDS.deptScienceId}', '${DEMO_IDS.workspaceId}', 'Science Department (DEMO)', 'Fictional Science faculty.'),
      ('${DEMO_IDS.deptStemId}', '${DEMO_IDS.workspaceId}', 'STEM & Humanities (DEMO)', 'Fictional STEM faculty.')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);
  stats.counts.staffDepartments += 2;

  statements.push(`
    INSERT INTO staff_members (id, workspace_id, employee_number, first_name, last_name, email, hire_date, staff_type, employment_status, staff_status, department_id)
    VALUES 
      ('${DEMO_IDS.staffThorneId}', '${DEMO_IDS.workspaceId}', 'DEMO-T-001', 'Aris', 'Thorne', 'aris.thorne@demo.haza-aios.com', '2025-08-01', 'teacher', 'full_time', 'active', '${DEMO_IDS.deptScienceId}'),
      ('${DEMO_IDS.staffVanceId}', '${DEMO_IDS.workspaceId}', 'DEMO-T-002', 'Clara', 'Vance', 'clara.vance@demo.haza-aios.com', '2025-08-01', 'teacher', 'full_time', 'active', '${DEMO_IDS.deptStemId}'),
      ('${DEMO_IDS.staffKimId}', '${DEMO_IDS.workspaceId}', 'DEMO-T-003', 'David', 'Kim', 'david.kim@demo.haza-aios.com', '2025-08-01', 'teacher', 'full_time', 'active', '${DEMO_IDS.deptStemId}')
    ON DUPLICATE KEY UPDATE first_name = VALUES(first_name);
  `);
  stats.counts.staffMembers += 3;

  // 9. Teaching Assignments: Dr. Thorne -> Grade 6 Section A Science
  statements.push(`
    INSERT INTO teaching_assignments (id, workspace_id, staff_id, academic_year, grade_id, section_id, subject_id, is_active)
    VALUES 
      ('00000000-0000-4710-8000-000000000041', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.staffThorneId}', 'Academic Year 2026–2027 (DEMO)', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectSciId}', 1),
      ('00000000-0000-4710-8000-000000000042', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.staffVanceId}', 'Academic Year 2026–2027 (DEMO)', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectMathId}', 1)
    ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);
  `);
  stats.counts.teachingAssignments += 2;

  // 10. Fictional Students: 12 students (4 per grade level)
  const fictionalStudents = [
    { id: "00000000-0000-4710-8000-000000000051", adm: "DEMO-S01", fn: "Leo", ln: "Sterling", grade: DEMO_IDS.grade6Id, sec: DEMO_IDS.section6AId },
    { id: "00000000-0000-4710-8000-000000000052", adm: "DEMO-S02", fn: "Maya", ln: "Lin", grade: DEMO_IDS.grade6Id, sec: DEMO_IDS.section6AId },
    { id: "00000000-0000-4710-8000-000000000053", adm: "DEMO-S03", fn: "Ethan", ln: "Brooks", grade: DEMO_IDS.grade6Id, sec: DEMO_IDS.section6AId },
    { id: "00000000-0000-4710-8000-000000000054", adm: "DEMO-S04", fn: "Zara", ln: "Ahmed", grade: DEMO_IDS.grade6Id, sec: DEMO_IDS.section6AId },
    { id: "00000000-0000-4710-8000-000000000055", adm: "DEMO-S05", fn: "Lucas", ln: "Graham", grade: DEMO_IDS.grade5Id, sec: DEMO_IDS.section5AId },
    { id: "00000000-0000-4710-8000-000000000056", adm: "DEMO-S06", fn: "Sophia", ln: "Reyes", grade: DEMO_IDS.grade5Id, sec: DEMO_IDS.section5AId },
    { id: "00000000-0000-4710-8000-000000000057", adm: "DEMO-S07", fn: "Oliver", ln: "Chen", grade: DEMO_IDS.grade5Id, sec: DEMO_IDS.section5AId },
    { id: "00000000-0000-4710-8000-000000000058", adm: "DEMO-S08", fn: "Emma", ln: "Watson", grade: DEMO_IDS.grade5Id, sec: DEMO_IDS.section5AId },
    { id: "00000000-0000-4710-8000-000000000059", adm: "DEMO-S09", fn: "Noah", ln: "Patel", grade: DEMO_IDS.grade4Id, sec: DEMO_IDS.section4AId },
    { id: "00000000-0000-4710-8000-00000000005a", adm: "DEMO-S10", fn: "Ava", ln: "Davis", grade: DEMO_IDS.grade4Id, sec: DEMO_IDS.section4AId },
    { id: "00000000-0000-4710-8000-00000000005b", adm: "DEMO-S11", fn: "James", ln: "Miller", grade: DEMO_IDS.grade4Id, sec: DEMO_IDS.section4AId },
    { id: "00000000-0000-4710-8000-00000000005c", adm: "DEMO-S12", fn: "Isabella", ln: "Wilson", grade: DEMO_IDS.grade4Id, sec: DEMO_IDS.section4AId },
  ];

  for (let idx = 0; idx < fictionalStudents.length; idx++) {
    const s = fictionalStudents[idx];
    const enrollId = `00000000-0000-4710-8000-00000000006${idx.toString(16)}`;
    statements.push(`
      INSERT INTO students (id, workspace_id, admission_number, student_number, first_name, last_name, date_of_birth, gender, admission_date, student_status)
      VALUES ('${s.id}', '${DEMO_IDS.workspaceId}', '${s.adm}', '${s.adm}', '${s.fn}', '${s.ln}', '2014-05-15', 'other', '2026-09-01', 'active')
      ON DUPLICATE KEY UPDATE first_name = VALUES(first_name);

      INSERT INTO enrollments (id, workspace_id, student_id, academic_year, grade_id, section_id, enrollment_date, enrollment_status)
      VALUES ('${enrollId}', '${DEMO_IDS.workspaceId}', '${s.id}', 'Academic Year 2026–2027 (DEMO)', '${s.grade}', '${s.sec}', '2026-09-01', 'active')
      ON DUPLICATE KEY UPDATE enrollment_status = 'active';
    `);
    stats.counts.students++;
    stats.counts.enrollments++;
  }

  // 11. School Schedule & Time Periods
  statements.push(`
    INSERT INTO school_schedules (id, workspace_id, academic_year_id, working_days, schedule_start_time, schedule_end_time)
    VALUES ('${DEMO_IDS.scheduleId}', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.academicYearId}', '[1, 2, 3, 4, 5]', '08:00', '15:00')
    ON DUPLICATE KEY UPDATE working_days = VALUES(working_days);

    INSERT INTO time_periods (id, workspace_id, name, start_time, end_time, period_type, display_order)
    VALUES 
      ('${DEMO_IDS.period1Id}', '${DEMO_IDS.workspaceId}', 'Period 1 (DEMO)', '08:30', '09:15', 'teaching', 1),
      ('${DEMO_IDS.period2Id}', '${DEMO_IDS.workspaceId}', 'Period 2 (DEMO)', '09:20', '10:05', 'teaching', 2),
      ('${DEMO_IDS.period3Id}', '${DEMO_IDS.workspaceId}', 'Period 3 (DEMO)', '10:10', '10:55', 'teaching', 3)
    ON DUPLICATE KEY UPDATE name = VALUES(name);

    INSERT INTO timetable_entries (id, workspace_id, academic_year_id, term_id, grade_id, section_id, subject_id, teacher_id, period_id, day_of_week)
    VALUES 
      ('00000000-0000-4710-8000-000000000071', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.academicYearId}', '${DEMO_IDS.termAutumnId}', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectSciId}', '${DEMO_IDS.staffThorneId}', '${DEMO_IDS.period3Id}', 2),
      ('00000000-0000-4710-8000-000000000072', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.academicYearId}', '${DEMO_IDS.termAutumnId}', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectMathId}', '${DEMO_IDS.staffVanceId}', '${DEMO_IDS.period1Id}', 1)
    ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id);
  `);
  stats.counts.schoolSchedules++;
  stats.counts.timePeriods += 3;
  stats.counts.timetableEntries += 2;

  // 12. Attendance Session & Records (Grade 6 Section A)
  statements.push(`
    INSERT INTO attendance_sessions (id, workspace_id, academic_year_id, attendance_date, grade_id, section_id, subject_id, teacher_id, attendance_session_type, attendance_session_status, marked_by)
    VALUES ('${DEMO_IDS.attendanceSessionId}', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.academicYearId}', '2026-10-14', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectSciId}', '${DEMO_IDS.staffThorneId}', 'subject', 'completed', '${DEMO_IDS.staffThorneId}')
    ON DUPLICATE KEY UPDATE attendance_session_status = 'completed';

    INSERT INTO attendance_records (id, workspace_id, session_id, enrollment_id, student_id, attendance_status, note, marked_by)
    VALUES 
      ('00000000-0000-4710-8000-000000000081', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.attendanceSessionId}', '00000000-0000-4710-8000-000000000060', '${fictionalStudents[0].id}', 'present', 'On time', '${DEMO_IDS.staffThorneId}'),
      ('00000000-0000-4710-8000-000000000082', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.attendanceSessionId}', '00000000-0000-4710-8000-000000000061', '${fictionalStudents[1].id}', 'present', 'On time', '${DEMO_IDS.staffThorneId}'),
      ('00000000-0000-4710-8000-000000000083', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.attendanceSessionId}', '00000000-0000-4710-8000-000000000062', '${fictionalStudents[2].id}', 'late', 'Arrived 5 mins late', '${DEMO_IDS.staffThorneId}'),
      ('00000000-0000-4710-8000-000000000084', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.attendanceSessionId}', '00000000-0000-4710-8000-000000000063', '${fictionalStudents[3].id}', 'present', 'On time', '${DEMO_IDS.staffThorneId}')
    ON DUPLICATE KEY UPDATE attendance_status = VALUES(attendance_status);
  `);
  stats.counts.attendanceSessions++;
  stats.counts.attendanceRecords += 4;

  // 13. Academic Lesson Plans (Cells: Structure and Function)
  const lessonPlanObjectives = JSON.stringify([
    { type: "cognitive", description: "Identify the primary functions of the cell membrane, cytoplasm, and nucleus." },
    { type: "cognitive", description: "Explain why plant cells possess a cell wall and chloroplasts while animal cells do not." },
    { type: "skill", description: "Label a diagram distinguishing plant and animal cell components." }
  ]);
  const lessonPlanContent = JSON.stringify({
    summary: "Comprehensive introduction to cellular organelles with interactive diagram labeling.",
    activities: [
      { name: "Starter: School Analogy", durationMinutes: 10, description: "Compare cell membrane to school doors and nucleus to principal office." },
      { name: "Main: Diagram Analysis", durationMinutes: 20, description: "Direct instruction contrasting plant and animal cell structures." },
      { name: "Plenary: Formative Exit Check", durationMinutes: 10, description: "Formative check on nucleus and shared organelle functions." }
    ],
    materials: ["Microscope slides", "Cell diagram worksheets", "Interactive digital whiteboard"],
    homework: "Complete Venn diagram comparing plant and animal cell organelles."
  });

  statements.push(`
    INSERT INTO academic_lesson_plans (id, organization_id, workspace_id, title, grade, subject, topic, duration_minutes, learning_objectives, content, status, created_by, approved_by, approved_at)
    VALUES 
      ('${DEMO_IDS.lessonPlanCellsId}', '${DEMO_IDS.orgId}', '${DEMO_IDS.workspaceId}', 'Cells: Structure and Function (DEMO)', 'Grade 6', 'Science', 'Cells and Living Systems', 45, '${lessonPlanObjectives}', '${lessonPlanContent}', 'approved', '${DEMO_IDS.ownerId}', '${DEMO_IDS.ownerId}', NOW()),
      ('${DEMO_IDS.lessonPlanCompareId}', '${DEMO_IDS.orgId}', '${DEMO_IDS.workspaceId}', 'Plant vs Animal Cells Exploration (DEMO)', 'Grade 6', 'Science', 'Cells and Living Systems', 40, '${lessonPlanObjectives}', '${lessonPlanContent}', 'approved', '${DEMO_IDS.ownerId}', '${DEMO_IDS.ownerId}', NOW())
    ON DUPLICATE KEY UPDATE title = VALUES(title);
  `);
  stats.counts.academicLessonPlans += 2;

  // 14. Assessments, Examinations & Mark Records
  statements.push(`
    INSERT INTO examinations (id, workspace_id, name, academic_year_id, term_id, examination_type, start_date, end_date, examination_status)
    VALUES ('${DEMO_IDS.examMidTermId}', '${DEMO_IDS.workspaceId}', 'Mid-Term Examination (DEMO)', '${DEMO_IDS.academicYearId}', '${DEMO_IDS.termAutumnId}', 'mid_term', '2026-11-01', '2026-11-15', 'scheduled')
    ON DUPLICATE KEY UPDATE name = VALUES(name);

    INSERT INTO assessments (id, workspace_id, title, academic_year_id, term_id, grade_id, section_id, subject_id, teacher_id, assessment_type, maximum_marks, passing_marks, weightage, assessment_date, assessment_status)
    VALUES ('${DEMO_IDS.assessmentQuizId}', '${DEMO_IDS.workspaceId}', 'Cells Mini Quiz (DEMO)', '${DEMO_IDS.academicYearId}', '${DEMO_IDS.termAutumnId}', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectSciId}', '${DEMO_IDS.staffThorneId}', 'quiz', 25, 10, 10, '2026-10-20', 'published')
    ON DUPLICATE KEY UPDATE title = VALUES(title);

    INSERT INTO grading_rules (id, workspace_id, grade, min_percentage_basis_points, max_percentage_basis_points, grade_point_basis_points, description)
    VALUES 
      ('00000000-0000-4710-8000-000000000091', '${DEMO_IDS.workspaceId}', 'A', 9000, 10000, 400, 'Standard Scale A (90-100%)'),
      ('00000000-0000-4710-8000-000000000092', '${DEMO_IDS.workspaceId}', 'B', 8000, 8999, 300, 'Standard Scale B (80-89%)'),
      ('00000000-0000-4710-8000-000000000093', '${DEMO_IDS.workspaceId}', 'C', 7000, 7999, 200, 'Standard Scale C (70-79%)')
    ON DUPLICATE KEY UPDATE description = VALUES(description);

    INSERT INTO mark_records (id, workspace_id, mark_source_type, source_id, academic_year_id, term_id, grade_id, section_id, subject_id, student_id, maximum_marks, obtained_marks, percentage_basis_points, grade, remarks, entered_by)
    VALUES 
      ('00000000-0000-4710-8000-0000000000a1', '${DEMO_IDS.workspaceId}', 'assessment', '${DEMO_IDS.assessmentQuizId}', '${DEMO_IDS.academicYearId}', '${DEMO_IDS.termAutumnId}', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectSciId}', '${fictionalStudents[0].id}', 25, 24, 9600, 'A', 'Excellent cell diagram understanding', '${DEMO_IDS.staffThorneId}'),
      ('00000000-0000-4710-8000-0000000000a2', '${DEMO_IDS.workspaceId}', 'assessment', '${DEMO_IDS.assessmentQuizId}', '${DEMO_IDS.academicYearId}', '${DEMO_IDS.termAutumnId}', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectSciId}', '${fictionalStudents[1].id}', 25, 23, 9200, 'A', 'Strong grasp of nucleus function', '${DEMO_IDS.staffThorneId}'),
      ('00000000-0000-4710-8000-0000000000a3', '${DEMO_IDS.workspaceId}', 'assessment', '${DEMO_IDS.assessmentQuizId}', '${DEMO_IDS.academicYearId}', '${DEMO_IDS.termAutumnId}', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectSciId}', '${fictionalStudents[2].id}', 25, 19, 7600, 'C', 'Review plant cell wall versus membrane', '${DEMO_IDS.staffThorneId}'),
      ('00000000-0000-4710-8000-0000000000a4', '${DEMO_IDS.workspaceId}', 'assessment', '${DEMO_IDS.assessmentQuizId}', '${DEMO_IDS.academicYearId}', '${DEMO_IDS.termAutumnId}', '${DEMO_IDS.grade6Id}', '${DEMO_IDS.section6AId}', '${DEMO_IDS.subjectSciId}', '${fictionalStudents[3].id}', 25, 25, 10000, 'A', 'Perfect score on cellular organelles', '${DEMO_IDS.staffThorneId}')
    ON DUPLICATE KEY UPDATE obtained_marks = VALUES(obtained_marks);
  `);
  stats.counts.examinations++;
  stats.counts.assessments++;
  stats.counts.gradingRules += 3;
  stats.counts.markRecords += 4;

  // 15. Knowledge Collection: Demo Grade 6 Science Knowledge Library
  statements.push(`
    INSERT INTO knowledge_collections (id, organization_id, workspace_id, name, slug, description, industry, visibility, status, created_by)
    VALUES ('${DEMO_IDS.knowledgeColId}', '${DEMO_IDS.orgId}', '${DEMO_IDS.workspaceId}', 'Demo Grade 6 Science Knowledge Library', 'demo-grade-6-science-library', 'Comprehensive fictional Grade 6 curriculum standards, cell biology notes, and lesson planning resources.', 'education', 'workspace', 'active', '${DEMO_IDS.ownerId}')
    ON DUPLICATE KEY UPDATE name = VALUES(name);
  `);
  stats.counts.knowledgeCollections++;

  // 16. Ingest 6 Fictional Science Reference Documents
  for (let dIdx = 0; dIdx < SCIENCE_DOCUMENTS.length; dIdx++) {
    const doc = SCIENCE_DOCUMENTS[dIdx];
    const rawBuffer = Buffer.from(doc.content, "utf8");
    const checksum = crypto.createHash("sha256").update(rawBuffer).digest("hex");
    const contentHash = crypto.createHash("sha256").update(doc.content.trim()).digest("hex");
    const escapedContent = doc.content.replace(/'/g, "''");

    statements.push(`
      INSERT INTO knowledge_sources (id, organization_id, workspace_id, collection_id, name, description, type, visibility, status, content, content_hash, ingestion_status, file_name, file_type, file_size_bytes, mime_type, storage_backend, current_version, created_by, created_at, updated_at)
      VALUES ('${doc.sourceId}', '${DEMO_IDS.orgId}', '${DEMO_IDS.workspaceId}', '${DEMO_IDS.knowledgeColId}', '${doc.title}', '${doc.description}', 'document', 'internal', 'active', '${escapedContent}', '${contentHash}', 'ready', '${doc.fileName}', 'md', ${rawBuffer.length}, 'text/markdown', 'database_durable', 1, '${DEMO_IDS.ownerId}', NOW(), NOW())
      ON DUPLICATE KEY UPDATE content = VALUES(content);

      INSERT INTO ai_agent_knowledge_documents (id, organization_id, workspace_id, source_id, version, content_type, raw_content, content_hash, checksum)
      VALUES ('${doc.docId}', '${DEMO_IDS.orgId}', '${DEMO_IDS.workspaceId}', '${doc.sourceId}', 1, 'text/markdown', '${rawBuffer.toString("base64")}', '${contentHash}', '${checksum}')
      ON DUPLICATE KEY UPDATE raw_content = VALUES(raw_content);
    `);
    stats.counts.knowledgeSources++;
    stats.counts.knowledgeDocuments++;

    // Split paragraphs into chunks
    const paragraphs = doc.content.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
    let currentHeading = "Overview";
    for (let cIdx = 0; cIdx < paragraphs.length; cIdx++) {
      const p = paragraphs[cIdx];
      if (p.startsWith("#")) {
        const firstLine = p.split("\n")[0].trim();
        currentHeading = firstLine.replace(/^#+\s*/, "").slice(0, 150);
      }
      const chunkId = `00000000-0000-4710-9000-0000${(dIdx + 1).toString().padStart(2, '0')}${(cIdx + 1).toString().padStart(4, '0')}`;
      const chunkHash = crypto.createHash("sha256").update(p).digest("hex");
      const tokenCount = Math.ceil(p.split(/\s+/).length * 1.3);
      const escapedP = p.replace(/'/g, "''");
      const safeHeading = currentHeading.slice(0, 200).replace(/'/g, "''");

      const vector = generateDeterministicVector(p);
      const vectorJson = JSON.stringify(vector);
      const embId = `00000000-0000-4710-9000-0000${(dIdx + 1).toString().padStart(2, '0')}e${(cIdx + 1).toString().padStart(3, '0')}`;

      statements.push(`
        INSERT INTO knowledge_chunks (id, source_id, organization_id, workspace_id, ordinal, section_heading, page_number, token_count, content, content_hash)
        VALUES ('${chunkId}', '${doc.sourceId}', '${DEMO_IDS.orgId}', '${DEMO_IDS.workspaceId}', ${cIdx}, '${safeHeading}', 1, ${tokenCount}, '${escapedP}', '${chunkHash}')
        ON DUPLICATE KEY UPDATE content = VALUES(content);

        INSERT INTO ai_agent_knowledge_embeddings (id, organization_id, workspace_id, source_id, chunk_id, provider, model, dimensions, embedding, content_hash)
        VALUES ('${embId}', '${DEMO_IDS.orgId}', '${DEMO_IDS.workspaceId}', '${doc.sourceId}', '${chunkId}', 'mock-deterministic', 'mock-normalized-vector-v1', 1536, '${vectorJson}', '${chunkHash}')
        ON DUPLICATE KEY UPDATE embedding = VALUES(embedding);
      `);
      stats.counts.knowledgeChunks++;
      stats.counts.knowledgeEmbeddings++;
    }
  }

  // -----------------------------------------------------------
  // Build 31-Section Mapping Report
  // -----------------------------------------------------------
  stats.sectionMapping = [
    { id: "DEMO-LEARN-001", section: "academic-years", title: "Fictional 2026–2027 Academic Session", status: "SUPPORTED", targetTable: "academic_years", notes: "Full relational support." },
    { id: "DEMO-LEARN-002", section: "grade-levels", title: "Grade 6", status: "SUPPORTED", targetTable: "grade_levels", notes: "Mapped to Grade 6 (level 6)." },
    { id: "DEMO-LEARN-003", section: "classes-sections", title: "Grade 6 — Section A", status: "SUPPORTED", targetTable: "sections", notes: "Mapped to Grade 6 Section A." },
    { id: "DEMO-LEARN-004", section: "subjects", title: "Grade 6 Science", status: "SUPPORTED", targetTable: "subjects & class_subjects", notes: "Code DEMO-SCI linked to Grade 6." },
    { id: "DEMO-LEARN-005", section: "curriculum-frameworks", title: "Fictional Science Framework", status: "SUPPORTED", targetTable: "knowledge_collections", notes: "Stored in Demo Science Knowledge Library." },
    { id: "DEMO-LEARN-006", section: "learning-objectives", title: "Identify Cell Parts", status: "SUPPORTED", targetTable: "academic_lesson_plans.learning_objectives", notes: "Structured cognitive/skill objectives." },
    { id: "DEMO-LEARN-007", section: "units", title: "Cells and Living Systems", status: "SUPPORTED", targetTable: "academic_lesson_plans.topic", notes: "Unit theme attached to lesson plans and knowledge." },
    { id: "DEMO-LEARN-008", section: "lesson-plans", title: "Cells: Structure and Function", status: "SUPPORTED", targetTable: "academic_lesson_plans", notes: "Full lesson plan draft approved by admin." },
    { id: "DEMO-LEARN-009", section: "resource-library", title: "Cells Vocabulary Sheet", status: "SUPPORTED", targetTable: "knowledge_sources", notes: "Ingested as durable knowledge document." },
    { id: "DEMO-LEARN-010", section: "activities", title: "Cell Diagram Labeling", status: "SUPPORTED", targetTable: "academic_lesson_plans.content.activities", notes: "Structured activity with duration and materials." },
    { id: "DEMO-LEARN-011", section: "assignments", title: "Compare Plant and Animal Cells", status: "SUPPORTED", targetTable: "assessments", notes: "Assignment assessment entry created." },
    { id: "DEMO-LEARN-012", section: "submissions", title: "Demo Student Response", status: "SUPPORTED", targetTable: "mark_records", notes: "Recorded with score and student attribution." },
    { id: "DEMO-LEARN-013", section: "teacher-feedback", title: "Demo Feedback on Cell Comparison", status: "SUPPORTED", targetTable: "mark_records.remarks", notes: "Teacher feedback attached to mark record." },
    { id: "DEMO-LEARN-014", section: "rubrics", title: "Cell Comparison Rubric", status: "SUPPORTED", targetTable: "grading_rules", notes: "Grading scale rules (A, B, C) recorded." },
    { id: "DEMO-LEARN-015", section: "gradebook", title: "Fictional Cells Assignment Result", status: "SUPPORTED", targetTable: "mark_records", notes: "Mark values (24/25, 23/25, 19/25, 25/25) verified." },
    { id: "DEMO-LEARN-016", section: "student-portfolios", title: "My Cells Reflection", status: "INTEGRATED_EXTENDED", targetTable: "knowledge_sources (portfolio tagged)", notes: "Stored as student reflection document." },
    { id: "DEMO-LEARN-017", section: "progress-tracking", title: "Cells Unit Progress Snapshot", status: "SUPPORTED", targetTable: "mark_records", notes: "Derived from class marks aggregation." },
    { id: "DEMO-LEARN-018", section: "interventions", title: "Vocabulary Reinforcement", status: "INTEGRATED_EXTENDED", targetTable: "academic_lesson_plans.content", notes: "Included in lesson plan differentiation section." },
    { id: "DEMO-LEARN-019", section: "question-bank", title: "Which Structure Controls Cell Activities?", status: "SUPPORTED", targetTable: "assessments.description", notes: "Quiz question embedded in assessment item." },
    { id: "DEMO-LEARN-020", section: "assessments", title: "Cells Mini Quiz", status: "SUPPORTED", targetTable: "assessments & examinations", notes: "Mid-term exam and published mini-quiz." },
    { id: "DEMO-LEARN-021", section: "certificates", title: "Cells Unit Completion Certificate", status: "INTEGRATED_EXTENDED", targetTable: "knowledge_sources (certificate)", notes: "Certificate template format." },
    { id: "DEMO-LEARN-022", section: "reports", title: "Cells Unit Summary", status: "SUPPORTED", targetTable: "mark_records", notes: "Aggregated class performance report." },
    { id: "DEMO-LEARN-023", section: "ai-assistance", title: "Lesson Draft Suggestion", status: "SUPPORTED", targetTable: "academic_lesson_plans.curriculum_reference", notes: "AI Assistant reference context." },
    { id: "DEMO-LEARN-024", section: "knowledge-collections", title: "Demo Grade 6 Science Library", status: "SUPPORTED", targetTable: "knowledge_collections", notes: "Tenant-scoped collection." },
    { id: "DEMO-LEARN-025", section: "knowledge-sources", title: "Cells Reference Note", status: "SUPPORTED", targetTable: "knowledge_sources", notes: "6 multi-section reference sources ingested." },
    { id: "DEMO-LEARN-026", section: "knowledge-search", title: "What parts do plant and animal cells share?", status: "SUPPORTED", targetTable: "ai_agent_knowledge_retrievals", notes: "Retrieval query audit record." },
    { id: "DEMO-LEARN-027", section: "timetable", title: "Science Demo Session", status: "SUPPORTED", targetTable: "timetable_entries", notes: "Tuesday period 3 Science in Lab 103." },
    { id: "DEMO-LEARN-028", section: "attendance", title: "Demo Attendance", status: "SUPPORTED", targetTable: "attendance_sessions & attendance_records", notes: "Submitted session for Grade 6 Section A." },
    { id: "DEMO-LEARN-029", section: "teacher-workspace", title: "Review Cells Lesson Draft", status: "SUPPORTED", targetTable: "academic_lesson_plans (approval workflow)", notes: "Lesson plan approved by authorized owner." },
    { id: "DEMO-LEARN-030", section: "student-workspace", title: "Cells Practice Assignment", status: "SUPPORTED", targetTable: "assessments", notes: "Published student assessment assignment." },
    { id: "DEMO-LEARN-031", section: "parent-workspace", title: "Cells Unit Family Update", status: "INTEGRATED_EXTENDED", targetTable: "organization_settings.preferences", notes: "Parent portal announcement." },
  ];

  if (!options.apply) {
    console.log(`[DRY_RUN] Summary of planned database operations:`);
    console.log(`- Organizations:          ${stats.counts.organizations}`);
    console.log(`- Workspaces:             ${stats.counts.workspaces}`);
    console.log(`- Organization Modules:   ${stats.counts.organizationModules}`);
    console.log(`- Academic Years:         ${stats.counts.academicYears}`);
    console.log(`- Academic Terms:         ${stats.counts.academicTerms}`);
    console.log(`- Grade Levels:           ${stats.counts.gradeLevels}`);
    console.log(`- Class Sections:         ${stats.counts.sections}`);
    console.log(`- Subjects:               ${stats.counts.subjects}`);
    console.log(`- Class Subjects:         ${stats.counts.classSubjects}`);
    console.log(`- Staff Departments:      ${stats.counts.staffDepartments}`);
    console.log(`- Staff Members:          ${stats.counts.staffMembers}`);
    console.log(`- Teaching Assignments:   ${stats.counts.teachingAssignments}`);
    console.log(`- Students:               ${stats.counts.students}`);
    console.log(`- Enrollments:            ${stats.counts.enrollments}`);
    console.log(`- School Schedules:       ${stats.counts.schoolSchedules}`);
    console.log(`- Time Periods:           ${stats.counts.timePeriods}`);
    console.log(`- Timetable Entries:      ${stats.counts.timetableEntries}`);
    console.log(`- Attendance Sessions:    ${stats.counts.attendanceSessions}`);
    console.log(`- Attendance Records:     ${stats.counts.attendanceRecords}`);
    console.log(`- Academic Lesson Plans:  ${stats.counts.academicLessonPlans}`);
    console.log(`- Examinations:           ${stats.counts.examinations}`);
    console.log(`- Assessments:            ${stats.counts.assessments}`);
    console.log(`- Grading Rules:          ${stats.counts.gradingRules}`);
    console.log(`- Mark Records:           ${stats.counts.markRecords}`);
    console.log(`- Knowledge Collections:  ${stats.counts.knowledgeCollections}`);
    console.log(`- Knowledge Sources:      ${stats.counts.knowledgeSources}`);
    console.log(`- Knowledge Chunks:       ${stats.counts.knowledgeChunks}`);
    console.log(`- Knowledge Documents:    ${stats.counts.knowledgeDocuments}`);
    console.log(`- Knowledge Embeddings:   ${stats.counts.knowledgeEmbeddings}`);
    console.log(`\n[DRY_RUN] Zero database writes performed. Pass --apply to execute.`);
    return stats;
  }

  // Execute applied writes in efficient batches of 10 with clear error logging
  console.log(`[APPLY] Executing ${statements.length} idempotent import statements on Railway MySQL...`);
  const batchSize = 10;
  for (let i = 0; i < statements.length; i += batchSize) {
    const batchStatements = statements.slice(i, i + batchSize);
    const chunk = batchStatements.map(s => s.trim()).filter(Boolean).join("\n\n");
    const batchLabel = `[${i + 1}-${Math.min(i + batchSize, statements.length)}/${statements.length}]`;
    console.log(`  Applying batch ${batchLabel}...`);
    try {
      await runRailwayMysql(chunk);
    } catch (err: any) {
      console.error(`\n[APPLY ERROR in batch ${batchLabel}]:`);
      const lines = chunk.split("\n");
      lines.forEach((l, idx) => console.error(`  ${idx + 1}: ${l}`));
      throw err;
    }
  }

  console.log("\n[APPLY] Verifying imported entities in production database...");
  const verifyRes = await runRailwayMysql(`
    SELECT 
      (SELECT COUNT(*) FROM organizations WHERE id = '${DEMO_IDS.orgId}') as org_cnt,
      (SELECT COUNT(*) FROM workspaces WHERE id = '${DEMO_IDS.workspaceId}') as ws_cnt,
      (SELECT COUNT(*) FROM grade_levels WHERE workspace_id = '${DEMO_IDS.workspaceId}') as grade_cnt,
      (SELECT COUNT(*) FROM sections WHERE workspace_id = '${DEMO_IDS.workspaceId}') as sec_cnt,
      (SELECT COUNT(*) FROM subjects WHERE workspace_id = '${DEMO_IDS.workspaceId}') as subj_cnt,
      (SELECT COUNT(*) FROM staff_members WHERE workspace_id = '${DEMO_IDS.workspaceId}') as staff_cnt,
      (SELECT COUNT(*) FROM students WHERE workspace_id = '${DEMO_IDS.workspaceId}') as stu_cnt,
      (SELECT COUNT(*) FROM enrollments WHERE workspace_id = '${DEMO_IDS.workspaceId}') as enroll_cnt,
      (SELECT COUNT(*) FROM academic_lesson_plans WHERE organization_id = '${DEMO_IDS.orgId}') as plan_cnt,
      (SELECT COUNT(*) FROM knowledge_collections WHERE organization_id = '${DEMO_IDS.orgId}') as col_cnt,
      (SELECT COUNT(*) FROM knowledge_sources WHERE organization_id = '${DEMO_IDS.orgId}') as src_cnt,
      (SELECT COUNT(*) FROM knowledge_chunks WHERE organization_id = '${DEMO_IDS.orgId}') as chunk_cnt,
      (SELECT COUNT(*) FROM ai_agent_knowledge_embeddings WHERE organization_id = '${DEMO_IDS.orgId}') as emb_cnt;
  `);
  console.log("[APPLY] Entity Verification Result:\n" + verifyRes.stdout.trim());

  console.log("\n================================================================");
  console.log("  DEMO ACADEMY DATA IMPORT COMPLETED SUCCESSFULLY!             ");
  console.log("================================================================");
  return stats;
}

// -------------------------------------------------------------
// CLI Execution
// -------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const cleanup = args.includes("--cleanup") || args.includes("--rollback");
  const verbose = args.includes("--verbose");

  await executeDemoImport({ apply, cleanup, verbose });
}

if (process.argv[1] && process.argv[1].endsWith("import-epic17-demo-learning-data.ts")) {
  main().catch((err) => {
    console.error("\n[FATAL ERROR during demo import]:", err.message || err);
    process.exit(1);
  });
}
