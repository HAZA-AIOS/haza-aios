import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

/**
 * AuthLayout — router-agnostic auth page layout primitive.
 *
 * Renders the two-column auth shell (hero copy | form card) used by every
 * authentication page.  Navigation concerns (Link, logo click targets) are
 * delegated to the consumer via the `logoSlot` and `navSlot` render props so
 * that this component stays free of any app-level router dependency.
 */
type AuthLayoutProps = {
  /** Slot for the logo / wordmark element (rendered top-left). */
  logoSlot: React.ReactNode;
  /** Slot for the top-right navigation element (e.g. "Back to site" link). */
  navSlot?: React.ReactNode;
  /** The form card column content. */
  children: React.ReactNode;
  className?: string;
};

function AuthLayout({ logoSlot, navSlot, children, className }: AuthLayoutProps) {
  return (
    <main className={cn("min-h-screen bg-slate-950 text-white", className)}>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6">
        <header className="flex items-center justify-between">
          {logoSlot}
          {navSlot ?? null}
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_440px]">
          {/* Hero copy column */}
          <section className="max-w-2xl space-y-6">
            <p className="text-xs font-semibold tracking-[0.32em] text-red-300 uppercase">
              Identity foundation
            </p>
            <h1 className="text-4xl font-bold text-balance md:text-6xl">
              Secure access for intelligent organizations.
            </h1>
            <p className="max-w-xl text-base leading-8 text-slate-300">
              Authentication is isolated from organization logic so HAZA AIOS can later support
              multi-organization membership, roles, and permissions without rebuilding the identity
              layer.
            </p>
            <div className="grid max-w-xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <span className="rounded-xl border border-white/10 bg-white/5 p-3">
                Session ready
              </span>
              <span className="rounded-xl border border-white/10 bg-white/5 p-3">
                Role prepared
              </span>
              <span className="rounded-xl border border-white/10 bg-white/5 p-3">API isolated</span>
            </div>
          </section>

          {/* Form card column */}
          {children}
        </div>
      </div>
    </main>
  );
}

export { AuthLayout };
export type { AuthLayoutProps };
