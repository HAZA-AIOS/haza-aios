import * as React from "react";

export type ModuleCategory = "industry" | "platform" | "organization" | "utility";

export type ModuleIndustry =
  | "Education"
  | "Healthcare"
  | "Corporate"
  | "Government"
  | "Cross-Industry"
  | "Platform";

export type ModuleLifecycleStatus =
  | "registered"
  | "available"
  | "activated"
  | "enabled"
  | "disabled"
  | "deactivated";

export interface ModulePermission {
  key: string;
  name: string;
  description: string;
}

export interface ModuleNavigationItem {
  id: string;
  label: string;
  icon?: string;
  route: string;
  order: number;
  requiredPermission?: string;
  badge?: string;
}

export interface ModuleRouteDefinition {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
  requiredPermission?: string;
}

export interface ModuleConfigurationSchema {
  settingsKey: string;
  defaultValues: Record<string, unknown>;
  fields?: Array<{
    key: string;
    label: string;
    type: "text" | "boolean" | "number" | "select";
    description?: string;
    options?: Array<{ label: string; value: string }>;
  }>;
}

export interface ModuleContract {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  category: ModuleCategory;
  industry: ModuleIndustry;
  icon: string;
  status: ModuleLifecycleStatus;
  enabled: boolean;
  routes: ModuleRouteDefinition[];
  navigation: ModuleNavigationItem[];
  permissions: ModulePermission[];
  configuration?: ModuleConfigurationSchema;
  metadata: {
    author?: string;
    documentationUrl?: string;
    tags?: string[];
    releasedAt?: string;
    minCoreVersion?: string;
  };
}

export interface OrganizationModuleState {
  organizationId: string;
  moduleId: string;
  status: "activated" | "deactivated";
  enabled: boolean;
  activatedAt?: string;
  activatedBy?: string;
  settings?: Record<string, unknown>;
}
