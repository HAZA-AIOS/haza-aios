import { Button, LogoMark } from "@haza-aios/ui";

import { useAuth } from "@/auth/use-auth";
import { navigate } from "@/routes/navigation";

function ProtectedAppPage() {
  const auth = useAuth();

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
          <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </header>

        <section className="grid flex-1 content-center gap-6 py-12">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold tracking-[0.32em] text-red-300 uppercase">
              Protected route
            </p>
            <h1 className="text-4xl font-bold md:text-6xl">Authentication foundation is active.</h1>
            <p className="text-lg leading-8 text-slate-300">
              This is intentionally not a dashboard. It verifies protected routing, current-user
              retrieval, logout, and session cleanup for future epics.
            </p>
          </div>

          <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300 md:grid-cols-2">
            <div>
              <p className="font-semibold text-white">Current user</p>
              <p>{auth.user?.displayName}</p>
              <p>{auth.user?.email}</p>
            </div>
            <div>
              <p className="font-semibold text-white">Identity status</p>
              <p>{auth.user?.emailVerified ? "Email verified" : "Email verification pending"}</p>
              <p>
                Session expires:{" "}
                {auth.session ? new Date(auth.session.expiresAt).toLocaleString() : "None"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export { ProtectedAppPage };
