import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../auth/use-auth";
import { useOrganization } from "../org/use-organization";
import { navigate } from "../routes/navigation";
import { AuthLoading } from "@haza-aios/ui";

interface WorkspaceGuardProps {
  children: ReactNode;
}

export function WorkspaceGuard({ children }: WorkspaceGuardProps) {
  const auth = useAuth();
  const { currentOrganization, isLoading: isOrgLoading, organizations } = useOrganization();

  useEffect(() => {
    // Redirect if unauthenticated
    if (auth.status === "unauthenticated") {
      navigate("/login");
      return;
    }

    // Redirect to organization registration if user is authenticated but has no organizations
    if (auth.status === "authenticated" && !isOrgLoading && organizations.length === 0) {
      navigate("/organization/create");
    }
  }, [auth.status, isOrgLoading, organizations.length]);

  // Show premium loading state during authentication check or organization fetch
  if (auth.status === "loading" || isOrgLoading) {
    return <AuthLoading className="min-h-screen bg-slate-950" />;
  }

  // Redirecting state fallbacks
  if (auth.status !== "authenticated") {
    return null;
  }

  if (organizations.length === 0) {
    return null;
  }

  // Wait until OrgProvider resolves the active currentOrganization selection
  if (!currentOrganization) {
    return <AuthLoading className="min-h-screen bg-slate-950" />;
  }

  return <>{children}</>;
}
