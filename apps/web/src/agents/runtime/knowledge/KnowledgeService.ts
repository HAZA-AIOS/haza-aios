import type { KnowledgeSource } from "../../agent.types";

const MOCK_KNOWLEDGE_DB: KnowledgeSource[] = [
  {
    id: "ks-academic-guidelines",
    organizationId: "org-1", // Assume default mock org
    name: "School Academic Guidelines",
    description: "Official school guidelines for academic standards, grading, and instruction.",
    type: "document",
    status: "active",
    visibility: "internal",
    content: "All worksheets must align with state standards. Ensure difficulty is appropriate. Maintain an encouraging tone.",
    createdBy: "admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ks-worksheet-formatting",
    organizationId: "org-1",
    name: "Worksheet Formatting Rules",
    description: "Required formatting rules for all generated worksheets.",
    type: "text",
    status: "active",
    visibility: "public",
    content: "Worksheets must include a header for Name, Date, and Grade. Questions must be numbered. Use Clear Sans font.",
    createdBy: "admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ks-grade5-science",
    organizationId: "org-1",
    name: "Grade 5 Science Curriculum",
    description: "Curriculum topics for 5th grade science.",
    type: "text",
    status: "active",
    visibility: "internal",
    content: "Key topics: Ecosystems, Water Cycle, Solar System, States of Matter, Basic Forces.",
    createdBy: "teacher",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "ks-org2-secret",
    organizationId: "org-2",
    name: "Org 2 Secret Policy",
    description: "Should not be readable by org 1.",
    type: "text",
    status: "active",
    visibility: "internal",
    content: "This is a secret policy for organization 2 only.",
    createdBy: "admin2",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export class KnowledgeServiceClass {
  async getKnowledgeSources(organizationId: string): Promise<KnowledgeSource[]> {
    return MOCK_KNOWLEDGE_DB.filter(k => k.organizationId === organizationId && k.status === "active");
  }

  async getKnowledgeSourceById(id: string, organizationId: string): Promise<KnowledgeSource | null> {
    const source = MOCK_KNOWLEDGE_DB.find(k => k.id === id && k.organizationId === organizationId);
    return source || null;
  }
}

export const KnowledgeService = new KnowledgeServiceClass();
