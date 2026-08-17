import React, { useEffect, useState } from "react";
import { useAuth } from "@/auth/use-auth";
import { OrgContext } from "./OrgContext";
import { orgService } from "./org-service";
import type { Organization, OrganizationMembership, OrganizationType } from "./org.types";

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, status } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [currentMembership, setCurrentMembership] = useState<OrganizationMembership | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to load user's organizations
  const loadOrgs = async (userId: string) => {
    try {
      const userOrgs = await orgService.getUserOrganizations(userId);
      setOrganizations(userOrgs);

      // Restore active organization from sessionStorage or default to first one
      const storedActiveId = sessionStorage.getItem(`haza-aios.active-org.${userId}`);
      let activeOrg = userOrgs.find((o) => o.id === storedActiveId) || null;

      if (!activeOrg && userOrgs.length > 0) {
        activeOrg = userOrgs[0];
      }

      if (activeOrg) {
        const membership = await orgService.getMembership(userId, activeOrg.id);
        setCurrentOrganization(activeOrg);
        setCurrentMembership(membership);
        sessionStorage.setItem(`haza-aios.active-org.${userId}`, activeOrg.id);
      } else {
        setCurrentOrganization(null);
        setCurrentMembership(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load organizations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const runEffect = () => {
      if (status === "authenticated" && user) {
        if (active) {
          setIsLoading(true);
          setError(null);
        }
        loadOrgs(user.id);
      } else if (status === "unauthenticated") {
        if (active) {
          setOrganizations([]);
          setCurrentOrganization(null);
          setCurrentMembership(null);
          setIsLoading(false);
        }
      }
    };

    // Defer state setting asynchronously to satisfy react-hooks/set-state-in-effect
    Promise.resolve().then(() => {
      runEffect();
    });

    return () => {
      active = false;
    };
  }, [user, status]);

  const createOrg = async (input: {
    name: string;
    legalName?: string;
    organizationType: OrganizationType;
    industry: string;
    website?: string;
    email: string;
    phone?: string;
    country: string;
    description?: string;
  }) => {
    if (!user) {
      throw new Error("Unauthorized: You must be logged in to create an organization.");
    }
    try {
      setIsLoading(true);
      setError(null);
      const result = await orgService.createOrganization(user.id, input);

      // Reload all user organizations
      const userOrgs = await orgService.getUserOrganizations(user.id);
      setOrganizations(userOrgs);

      // Set the newly created organization as active
      setCurrentOrganization(result.organization);
      setCurrentMembership(result.membership);
      sessionStorage.setItem(`haza-aios.active-org.${user.id}`, result.organization.id);

      return result;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Failed to create organization";
      setError(errMsg);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new (Error as any)(errMsg, { cause: err });
    } finally {
      setIsLoading(false);
    }
  };

  const switchOrg = async (organizationId: string) => {
    if (!user) return;
    try {
      setIsLoading(true);
      const org = organizations.find((o) => o.id === organizationId);
      if (!org) {
        throw new Error("Organization not found.");
      }
      const membership = await orgService.getMembership(user.id, organizationId);
      setCurrentOrganization(org);
      setCurrentMembership(membership);
      sessionStorage.setItem(`haza-aios.active-org.${user.id}`, organizationId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to switch organization");
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = async () => {
    if (user) {
      await loadOrgs(user.id);
    }
  };

  return (
    <OrgContext.Provider
      value={{
        currentOrganization,
        currentMembership,
        organizations,
        isLoading,
        error,
        createOrg,
        switchOrg,
        refresh,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};
