/**
 * Authentication hooks.
 *
 * Kept in a separate file from AuthProvider.tsx so that react-refresh can
 * distinguish component exports (AuthProvider) from hook exports (useAuth,
 * useCurrentUser), satisfying the react-refresh/only-export-components rule.
 *
 * Import from this file anywhere you need auth state:
 *   import { useAuth, useCurrentUser } from "@/auth/use-auth";
 */
import { useContext } from "react";

import { AuthContext } from "./AuthProvider";

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}

function useCurrentUser() {
  return useAuth().user;
}

export { useAuth, useCurrentUser };
