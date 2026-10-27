import { describe, expect, it } from "vitest";
import {
  assertCapabilityPermitted,
  readPagePagination,
  redactSensitiveConfig,
  validateActivationPrerequisites,
  validateHumanApprovalPolicy,
  validateUpdateAgentStatus,
} from "../src/modules/agents/validation/agent-validation.js";
import { ApiError } from "../src/common/errors/api-error.js";
import type { AgentDefinitionWithTools, AgentTemplateRecord } from "../src/modules/agents/agent.types.js";

describe("Agent Platform Validation & Security", () => {
  describe("validateActivationPrerequisites", () => {
    const mockTemplate: AgentTemplateRecord = {
      id: "00000000-0000-0000-0000-000000000001",
      slug: "test-template",
      name: "Test Template",
      description: "Test description",
      version: "1.0.0",
      category: "Education",
      industry: "Education",
      status: "available",
      icon: "📝",
      capabilities: [],
      requiredPermissions: [],
      configurationSchema: {
        type: "object",
        required: ["apiKeyEndpoint", "gradeSubject"],
        properties: {
          apiKeyEndpoint: { type: "string" },
          gradeSubject: { type: "string" },
          optionalNote: { type: "string" },
        },
      },
      inputSchema: {},
      outputSchema: {},
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("passes when all required fields from template schema are satisfied", () => {
      expect(() => {
        validateActivationPrerequisites(mockTemplate, {
          apiKeyEndpoint: "https://api.example.com",
          gradeSubject: "Math Grade 5",
        });
      }).not.toThrow();
    });

    it("throws VALIDATION_FAILED when required fields are missing", () => {
      expect(() => {
        validateActivationPrerequisites(mockTemplate, {
          apiKeyEndpoint: "https://api.example.com",
        });
      }).toThrowError(ApiError);

      try {
        validateActivationPrerequisites(mockTemplate, {
          apiKeyEndpoint: "https://api.example.com",
        });
      } catch (err: any) {
        expect(err.code).toBe("VALIDATION_FAILED");
        expect(err.message).toContain("missing [gradeSubject]");
      }
    });
  });

  describe("redactSensitiveConfig", () => {
    it("redacts keys containing forbidden secret patterns", () => {
      const input = {
        name: "Test Agent",
        model: {
          provider: "mock",
          apiKey: "secret_value_123",
          token: "bearer_xyz",
        },
        credentials: {
          password: "supersecretpassword",
          client_secret: "clientsecretval",
        },
        regularSetting: 42,
      };

      const redacted = redactSensitiveConfig(input) as Record<string, any>;
      expect(redacted.name).toBe("Test Agent");
      expect(redacted.model.provider).toBe("mock");
      expect(redacted.model.apiKey).toBe("[REDACTED]");
      expect(redacted.model.token).toBe("[REDACTED]");
      expect(redacted.credentials).toBe("[REDACTED]");
      expect(redacted.regularSetting).toBe(42);
    });

    it("redacts string values matching secret signatures", () => {
      const input = {
        serviceKey: "sk-1234567890abcdefghijklmnopqrstuvwxyz",
        authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgN",
        safeString: "regular-identifier-123",
      };

      const redacted = redactSensitiveConfig(input) as Record<string, any>;
      expect(redacted.serviceKey).toBe("[REDACTED]");
      expect(redacted.authHeader).toBe("[REDACTED]");
      expect(redacted.safeString).toBe("regular-identifier-123");
    });
  });

  describe("assertCapabilityPermitted (Default-Deny)", () => {
    const mockAgent: AgentDefinitionWithTools = {
      id: "00000000-0000-0000-0000-000000000002",
      organizationId: "00000000-0000-0000-0000-000000000010",
      workspaceId: "00000000-0000-0000-0000-000000000020",
      templateId: null,
      agentKey: "math-tutor",
      name: "Math Tutor",
      description: "Tutors students",
      status: "active",
      enabled: true,
      instructions: "",
      configuration: {
        tools: ["calculate", "explain"],
      },
      modelProvider: "mock",
      modelSelection: "mock-gpt-4o",
      humanApprovalPolicy: null,
      createdBy: "00000000-0000-0000-0000-000000000030",
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      tools: [
        {
          id: "t1",
          agentId: "00000000-0000-0000-0000-000000000002",
          toolKey: "calculate",
          status: "active",
          configuration: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    it("permits authorized capability", () => {
      expect(() => {
        assertCapabilityPermitted(mockAgent, "calculate");
      }).not.toThrow();
    });

    it("denies unauthorized capability under default-deny policy", () => {
      expect(() => {
        assertCapabilityPermitted(mockAgent, "delete_database");
      }).toThrowError(ApiError);

      try {
        assertCapabilityPermitted(mockAgent, "delete_database");
      } catch (err: any) {
        expect(err.code).toBe("FORBIDDEN");
        expect(err.statusCode).toBe(403);
        expect(err.message).toContain("is not permitted to use capability 'delete_database'");
      }
    });
  });

  describe("validateUpdateAgentStatus", () => {
    const orgId = "11111111-1111-4111-8111-111111111111";
    const agentId = "22222222-2222-4222-8222-222222222222";

    it("accepts valid lifecycle status transitions including 'suspended'", () => {
      const statuses = ["active", "configured", "paused", "disabled", "archived", "suspended"];
      for (const status of statuses) {
        const validated = validateUpdateAgentStatus(orgId, agentId, { status });
        expect(validated.status).toBe(status);
      }
    });

    it("rejects unsupported lifecycle statuses", () => {
      expect(() => {
        validateUpdateAgentStatus(orgId, agentId, { status: "exploding" });
      }).toThrowError(ApiError);
    });
  });

  describe("validateHumanApprovalPolicy", () => {
    it("parses valid approval policy", () => {
      const policy = validateHumanApprovalPolicy({
        required: true,
        approverRoles: ["owner", "admin", "compliance_officer"],
        escalationTimeoutHours: 48,
        fallbackAction: "escalate",
        sensitiveCapabilities: ["financial_export"],
      });

      expect(policy?.required).toBe(true);
      expect(policy?.approverRoles).toEqual(["owner", "admin", "compliance_officer"]);
      expect(policy?.escalationTimeoutHours).toBe(48);
      expect(policy?.fallbackAction).toBe("escalate");
      expect(policy?.sensitiveCapabilities).toEqual(["financial_export"]);
    });

    it("defaults approverRoles to owner and admin if empty or omitted", () => {
      const policy = validateHumanApprovalPolicy({
        required: true,
      });
      expect(policy?.approverRoles).toEqual(["owner", "admin"]);
      expect(policy?.fallbackAction).toBeUndefined();
    });

    it("rejects invalid approval policy formats", () => {
      expect(() => {
        validateHumanApprovalPolicy("not an object");
      }).toThrowError(ApiError);

      expect(() => {
        validateHumanApprovalPolicy({ required: true, fallbackAction: "invalid_action" });
      }).toThrowError(ApiError);
    });
  });

  describe("readPagePagination", () => {
    it("parses page and pageSize query parameters", () => {
      const url = new URL("https://api.example.com/agents?page=3&pageSize=15");
      const pagination = readPagePagination(url);
      expect(pagination.page).toBe(3);
      expect(pagination.pageSize).toBe(15);
    });

    it("clamps pageSize within bounds and handles offset fallback", () => {
      const url = new URL("https://api.example.com/agents?offset=40&limit=200");
      const pagination = readPagePagination(url);
      expect(pagination.pageSize).toBe(100); // clamped to 100 max
      expect(pagination.page).toBe(1);
    });
  });
});
