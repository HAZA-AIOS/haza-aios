import { useState } from "react";
import type { FormEvent } from "react";

import { AuthAlert, AuthCard, Button, FormField, Input } from "@haza-aios/ui";

import { useAuth } from "@/auth/use-auth";
import { Link } from "@/routes/router";

import { AuthShell } from "./AuthShell";

function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await auth.forgotPassword({ email });
    setIsSent(true);
  }

  return (
    <AuthShell>
      <AuthCard
        eyebrow="Account recovery"
        title="Reset your password"
        description="Enter your email and HAZA AIOS will prepare the password reset flow for the backend service."
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {auth.error ? <AuthAlert variant="error">{auth.error.message}</AuthAlert> : null}
          {isSent ? (
            <AuthAlert variant="success" title="Reset flow ready">
              If the account exists, a password reset message will be sent by the backend service.
            </AuthAlert>
          ) : null}

          <FormField id="forgot-email" label="Email">
            <Input
              autoComplete="email"
              inputMode="email"
              placeholder="you@organization.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FormField>

          <Button type="submit" className="w-full" disabled={auth.status === "loading"}>
            {auth.status === "loading" ? "Preparing..." : "Continue"}
          </Button>

          <p className="text-center text-sm text-slate-400">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-red-200 hover:text-red-100">
              Sign in
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

export { ForgotPasswordPage };
