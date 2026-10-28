import type { JsonRecord, HumanApprovalPolicy, AgentCapability } from "../agents/agent.types.js";

export type MarketplaceVisibility = "platform" | "private_organization" | "approved_shared";

export type PublishingStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "published"
  | "rejected"
  | "deprecated"
  | "withdrawn";

export type PublisherType = "platform" | "organization";

export type AgentTemplateVersionRecord = {
  id: string;
  templateId: string;
  version: string;
  name: string;
  description: string;
  instructions: string | null;
  configurationSchema: JsonRecord;
  inputSchema: JsonRecord;
  outputSchema: JsonRecord;
  capabilities: AgentCapability[];
  requiredPermissions: string[];
  defaultApprovalPolicy?: HumanApprovalPolicy | null;
  changelog: string | null;
  status: PublishingStatus;
  reviewNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentInstallationRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  templateId: string;
  templateVersionId: string | null;
  installedVersion: string;
  agentDefinitionId: string;
  installedBy: string;
  status: "active" | "uninstalled" | "upgraded";
  installedAt: Date;
  uninstalledAt: Date | null;
  uninstalledBy: string | null;
  metadata: JsonRecord | null;
};

export type MarketplaceCatalogFilter = {
  category?: string;
  industry?: string;
  search?: string;
  publisher?: string;
  visibility?: "platform" | "private_organization" | "approved_shared";
  capability?: string;
  page?: number;
  pageSize?: number;
};

export type MarketplaceCatalogItemDto = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  latestVersion: string;
  category: string;
  industry: string;
  icon: string;
  publisherType: PublisherType;
  publisherName: string;
  visibility: MarketplaceVisibility;
  publishingStatus: PublishingStatus;
  capabilities: AgentCapability[];
  requiredPermissions: string[];
  installed: boolean;
  installedVersion: string | null;
  hasUpdateAvailable: boolean;
  publishedAt: string | null;
};

export type MarketplaceAgentProfileDto = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  latestVersion: string;
  category: string;
  industry: string;
  icon: string;
  publisherType: PublisherType;
  publisherName: string;
  publisherOrganizationId: string | null;
  visibility: MarketplaceVisibility;
  publishingStatus: PublishingStatus;
  capabilities: AgentCapability[];
  requiredPermissions: string[];
  configurationSchema: JsonRecord;
  inputSchema: JsonRecord;
  outputSchema: JsonRecord;
  defaultApprovalPolicy: HumanApprovalPolicy | null;
  versions: MarketplaceVersionSummaryDto[];
  installed: boolean;
  installedInstanceId: string | null;
  installedVersion: string | null;
  hasUpdateAvailable: boolean;
  publishedAt: string | null;
};

export type MarketplaceVersionSummaryDto = {
  id: string;
  version: string;
  changelog: string | null;
  status: PublishingStatus;
  publishedAt: string | null;
};

export type MarketplaceInstallInput = {
  organizationId: string;
  workspaceId: string;
  templateId: string;
  version?: string;
  name?: string;
  description?: string;
  instructions?: string;
  configuration?: JsonRecord;
  modelProvider?: string;
  modelSelection?: string;
  humanApprovalPolicy?: HumanApprovalPolicy;
  installedBy: string;
};

export type MarketplaceUpgradeInput = {
  organizationId: string;
  agentId: string;
  targetVersion: string;
  updatedBy: string;
};

export type MarketplaceUninstallInput = {
  organizationId: string;
  agentId: string;
  userId: string;
  reason?: string;
};

export type MarketplaceReviewDecisionInput = {
  decision: "under_review" | "approved" | "rejected" | "published" | "deprecated" | "withdrawn";
  reviewNotes?: string;
  reviewerUserId: string;
};

export type MarketplaceReviewSubmissionDto = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  category: string;
  industry: string;
  publisherType: string;
  publisherOrganizationId: string | null;
  publisherOrganizationName: string | null;
  publisherUserId: string | null;
  publisherUserEmail: string | null;
  publishingStatus: string;
  reviewNotes: string | null;
  updatedAt: string;
  template?: any;
};

export type MarketplaceAnalyticsDto = {
  totalPublishedAgents: number;
  publishedAgentsCount: number;
  totalInstallations: number;
  totalInstallationsCount: number;
  activeInstallations: number;
  activeInstallationsCount: number;
  pendingSubmissions: number;
  pendingReviewsCount: number;
  agentsByIndustry: Record<string, number>;
  agentsByCategory: Record<string, number>;
  versionAdoption: Array<{
    templateName: string;
    version: string;
    installCount: number;
  }>;
};
