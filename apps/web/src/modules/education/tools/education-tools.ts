import { ToolRegistry } from "../../../agents/runtime/tools/ToolRegistry";
import { educationDomainService } from "../services/education-domain.service";

// 1. Education Context Tool
ToolRegistry.register({
  definition: {
    id: "education_context",
    name: "Education Context Tool",
    description: "Retrieve authorized education context for the organization.",
    category: "Education",
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: { academicYear: { type: "string" }, term: { type: "string" } } },
    permissions: ["education:read"],
    status: "active"
  },
  execute: async (input, context) => {
    return await educationDomainService.getEducationContext(context.organizationId, context.userId);
  }
});

// 2. School Data Lookup Tool
ToolRegistry.register({
  definition: {
    id: "school_data_lookup",
    name: "School Data Lookup Tool",
    description: "Retrieve approved school information.",
    category: "Education",
    inputSchema: { 
      type: "object", 
      properties: { schoolId: { type: "string" } },
      required: ["schoolId"]
    },
    outputSchema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
    permissions: ["education:school:read"],
    status: "active"
  },
  execute: async (input, context) => {
    if (!input.schoolId) throw new Error("schoolId is required");
    return await educationDomainService.lookupSchool(input.schoolId, context.organizationId);
  }
});

// 3. Curriculum Context Tool
ToolRegistry.register({
  definition: {
    id: "curriculum_context",
    name: "Curriculum Context Tool",
    description: "Retrieve authorized academic information needed by the Worksheet Creator.",
    category: "Education",
    inputSchema: { 
      type: "object", 
      properties: { subject: { type: "string" }, grade: { type: "string" } },
      required: ["subject", "grade"]
    },
    outputSchema: { type: "object", properties: { subject: { type: "string" }, standards: { type: "array" } } },
    permissions: ["education:curriculum:read"],
    status: "active"
  },
  execute: async (input, context) => {
    if (!input.subject || !input.grade) throw new Error("subject and grade are required");
    return await educationDomainService.getCurriculumContext(input.subject, input.grade, context.organizationId);
  }
});

// 4. Worksheet Context Tool
ToolRegistry.register({
  definition: {
    id: "worksheet_context",
    name: "Worksheet Context Tool",
    description: "Provide relevant organization-specific context to the Worksheet Creator Agent.",
    category: "Education",
    inputSchema: { 
      type: "object", 
      properties: { topic: { type: "string" } },
      required: ["topic"]
    },
    outputSchema: { type: "object", properties: { orgPreferences: { type: "string" } } },
    permissions: ["education:worksheet:read"],
    status: "active"
  },
  execute: async (input, context) => {
    if (!input.topic) throw new Error("topic is required");
    return await educationDomainService.getWorksheetContext(input.topic, context.organizationId);
  }
});
