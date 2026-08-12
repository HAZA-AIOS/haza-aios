import { Button, LogoMark } from "@haza-aios/ui";

import { useAuth } from "@/auth/use-auth";
import { navigate } from "@/routes/navigation";

import type { Organization } from "@/org/org.types";
import { useOrganization } from "@/org/use-organization";

function ProtectedAppPage() {
  const auth = useAuth();
  const { currentOrganization, currentMembership, organizations, switchOrg } = useOrganization();

  async function handleLogout() {
    await auth.logout();
    navigate("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <button
            type="button"
            className="flex items-center gap-3 text-left text-sm font-semibold text-white"
            onClick={() => navigate("/")}
          >
            <LogoMark className="size-9" />
            <span>HAZA AIOS</span>
          </button>
          <div className="flex items-center gap-3">
            {organizations.length > 0 && currentOrganization && (
              <select
                value={currentOrganization.id}
                onChange={(e) => switchOrg(e.target.value)}
                className="rounded-xl border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                {organizations.map((o: Organization) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </header>

        <section className="grid flex-1 content-center gap-6 py-12">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold tracking-[0.32em] text-red-300 uppercase">
              Protected route
            </p>
            <h1 className="text-4xl font-bold md:text-6xl">Workspace & Identity active.</h1>
            <p className="text-lg leading-8 text-slate-300">
              Tenancy isolation and organization context are fully functional. Manage your
              multi-tenant workspaces below.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Identity Card */}
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <h2 className="text-lg font-semibold text-white">Identity Details</h2>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-slate-400">Current User</p>
                  <p className="font-medium text-white">{auth.user?.displayName}</p>
                  <p className="text-xs text-slate-400">{auth.user?.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Identity Status</p>
                  <p className="font-medium text-white">
                    {auth.user?.emailVerified ? "Email verified" : "Email verification pending"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Session Expires</p>
                  <p className="font-medium text-white">
                    {auth.session ? new Date(auth.session.expiresAt).toLocaleString() : "None"}
                  </p>
                </div>
              </div>
            </div>

            {/* Tenant/Org Card */}
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <h2 className="text-lg font-semibold text-white">Organization Workspace</h2>
              {currentOrganization ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-slate-400">Name</p>
                      <p className="font-medium text-white">{currentOrganization.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Slug ID</p>
                      <p className="font-mono text-emerald-400">@{currentOrganization.slug}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Type</p>
                      <p className="font-medium text-white">
                        {currentOrganization.organizationType}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Industry</p>
                      <p className="font-medium text-white">{currentOrganization.industry}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Country</p>
                      <p className="font-medium text-white">{currentOrganization.country}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Your Role</p>
                      <p className="font-bold text-red-300">{currentMembership?.role}</p>
                    </div>
                  </div>
                  {currentOrganization.website && (
                    <div>
                      <p className="text-xs text-slate-400">Website</p>
                      <a
                        href={currentOrganization.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-red-200 hover:underline"
                      >
                        {currentOrganization.website}
                      </a>
                    </div>
                  )}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => navigate("/organization/create")}
                    >
                      Create another Organization
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
                  <p className="text-slate-400">
                    You do not belong to any organizations yet. Create one to begin.
                  </p>
                  <Button onClick={() => navigate("/organization/create")} className="text-xs">
                    Register Organization
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export { ProtectedAppPage };
