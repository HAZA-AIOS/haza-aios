/**
 * Platform admin hooks.
 *
 * Provides role-checking hooks for the platform admin module.
 * In the mock implementation, the first registered user is treated
 * as a super_admin for development/demo purposes.
 */
import { useAuth } from "@/auth/use-auth";
import type { PlatformRole } from "./platform-admin.types";

/**
 * Returns the current user's platform role.
 *
 * Mock implementation: any authenticated user is treated as
 * super_admin for development. Replace with a real role lookup
 * when connecting to a backend.
 */
export function usePlatformRole(): PlatformRole | null {
  const { user, status } = useAuth();

  if (status !== "authenticated" || !user) {
    return null;
  }

  // Mock: all authenticated users are super_admin for dev/demo
  return "super_admin";
}

/**
 * Boolean shortcut for checking super admin access.
 */
export function useIsSuperAdmin(): boolean {
  return usePlatformRole() === "super_admin";
}
