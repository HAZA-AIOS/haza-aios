/**
 * Navigation utilities — non-component, non-hook exports.
 *
 * Kept in a separate file from router.tsx so that react-refresh can
 * distinguish these utilities from the route-guard components
 * (ProtectedRoute, PublicOnlyRoute, Link) in router.tsx.
 */
import { useEffect, useState } from "react";

/** The set of public routes that do not require authentication. */
const publicRoutes = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

/**
 * Imperatively navigates to a path using the History API.
 * Dispatches a popstate event so React components using usePathname re-render.
 */
function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Returns the current pathname, updating when the user navigates. */
function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);

    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  return pathname;
}

export { navigate, publicRoutes, usePathname };
