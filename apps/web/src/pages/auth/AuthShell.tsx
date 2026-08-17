import type { ReactNode } from "react";

import { AuthLayout } from "@haza-aios/ui/components/auth-layout";
import { LogoMark } from "@haza-aios/ui/components/logo-mark";

import { Link } from "@/routes/router";

/**
 * AuthShell — app-level wrapper that wires the router-agnostic AuthLayout
 * primitive (from packages/ui) with the app's Link component for navigation.
 */
function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      logoSlot={
        <Link to="/" className="flex items-center gap-3 text-sm font-semibold text-white">
          <LogoMark className="size-9" />
          <span>HAZA AIOS</span>
        </Link>
      }
      navSlot={
        <Link
          to="/"
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          Back to site
        </Link>
      }
    >
      {children}
    </AuthLayout>
  );
}

export { AuthShell };
