import { useEffect, useMemo, useRef } from "react";

import { AuthAlert, AuthCard, AuthLoading, Button } from "@haza-aios/ui";

import { useAuth } from "@/auth/use-auth";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";

import { AuthShell } from "./AuthShell";

function VerifyEmailPage() {
  const auth = useAuth();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  // Use a ref instead of state to avoid setState-in-effect warnings.
  // We only need to fire verifyEmail once; the result surfaces through auth state.
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;
    void auth.verifyEmail(token);
  }, [auth, token]);

  return (
    <AuthShell>
      <AuthCard
        eyebrow="Email verification"
        title="Verify your email"
        description="The verification state is part of the identity model and stays separate from future organization membership."
      >
        <div className="space-y-5">
          {auth.status === "loading" ? <AuthLoading label="Checking verification status" /> : null}
          {auth.error ? <AuthAlert variant="error">{auth.error.message}</AuthAlert> : null}
          {auth.user?.emailVerified ? (
            <AuthAlert variant="success" title="Email verified">
              Your identity is active and ready for protected HAZA AIOS routes.
            </AuthAlert>
          ) : (
            <AuthAlert variant="info" title="Verification pending">
              Use a backend-issued verification link when the authentication API is connected.
            </AuthAlert>
          )}

          <Button
            type="button"
            className="w-full"
            onClick={() => navigate(auth.user ? "/app" : "/login")}
          >
            {auth.user ? "Continue to protected area" : "Go to sign in"}
          </Button>

          <p className="text-center text-sm text-slate-400">
            Need another account?{" "}
            <Link to="/register" className="font-semibold text-red-200 hover:text-red-100">
              Register
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

export { VerifyEmailPage };
