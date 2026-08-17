import { useEffect } from "react";
import type { ReactNode } from "react";

import { AuthLoading } from "@haza-aios/ui/components/auth-loading";

import { useAuth } from "@/auth/use-auth";

import { navigate } from "./navigation";

/**
 * Link — SPA anchor that uses the History API instead of triggering a
 * full page navigation, keeping the app within the React rendering tree.
 */
function Link({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

/**
 * ProtectedRoute — renders children only when the user is authenticated.
 * Shows a loading state during the session check and redirects to /login
 * when the session check resolves to unauthenticated.
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      navigate("/login");
    }
  }, [auth.status]);

  if (auth.status === "loading") {
    return <AuthLoading className="min-h-screen bg-slate-950" />;
  }

  if (auth.status !== "authenticated") {
    return null;
  }

  return children;
}

/**
 * PublicOnlyRoute — renders children only when the user is NOT authenticated.
 * Redirects authenticated users to /app (prevents logged-in users from seeing
 * the login page).
 */
function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === "authenticated") {
      navigate("/app");
    }
  }, [auth.status]);

  if (auth.status === "loading") {
    return <AuthLoading className="min-h-screen bg-slate-950" />;
  }

  if (auth.status === "authenticated") {
    return null;
  }

  return children;
}

export { Link, ProtectedRoute, PublicOnlyRoute };
