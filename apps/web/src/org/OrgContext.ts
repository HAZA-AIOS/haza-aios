import { createContext } from "react";
import type { Organization, OrganizationMembership, OrganizationType } from "./org.types";

export interface OrgContextType {
  currentOrganization: Organization | null;
  currentMembership: OrganizationMembership | null;
  organizations: Organization[];
  isLoading: boolean;
  error: string | null;
  createOrg: (input: {
    name: string;
    legalName?: string;
    organizationType: OrganizationType;
    industry: string;
    website?: string;
    email: string;
    phone?: string;
    country: string;
    description?: string;
  }) => Promise<{ organization: Organization; membership: OrganizationMembership }>;
  switchOrg: (organizationId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const OrgContext = createContext<OrgContextType | undefined>(undefined);
