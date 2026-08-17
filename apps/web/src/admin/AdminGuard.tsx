/**
 * AdminGuard — route protection for platform administration pages.
 *
 * Wraps admin pages and only renders children when the current user
 * has super_admin platform access. Redirects non-admins to /dashboard.
 */
import { useEffect } from "react";
import type { ReactNode } from "react";
import { navigate } from "@/routes/navigation";
import { useIsSuperAdmin } from "./use-platform-admin";
import { useAuth } from "@/auth/use-auth";
import { AuthLoading } from "@haza-aios/ui/components/auth-loading";

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { status } = useAuth();
  const isSuperAdmin = useIsSuperAdmin();

  useEffect(() => {
    if (status === "authenticated" && !isSuperAdmin) {
      navigate("/dashboard");
    }
  }, [status, isSuperAdmin]);

  if (status === "loading") {
    return <AuthLoading className="min-h-screen bg-[#080b11]" />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return <>{children}</>;
}
