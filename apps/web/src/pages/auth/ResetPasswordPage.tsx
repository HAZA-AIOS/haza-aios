import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  AuthAlert,
  AuthCard,
  Button,
  FormField,
  PasswordField,
  PasswordStrength,
} from "@haza-aios/ui";

import { useAuth } from "@/auth/use-auth";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";

import { AuthShell } from "./AuthShell";

function ResetPasswordPage() {
  const auth = useAuth();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordMismatch) {
      return;
    }

    await auth.resetPassword({ token, password });
    navigate("/login");
  }

  return (
    <AuthShell>
      <AuthCard
        eyebrow="New credential"
        title="Choose a new password"
        description="Password reset is routed through the auth service boundary and can be connected to the backend API later."
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {auth.error ? <AuthAlert variant="error">{auth.error.message}</AuthAlert> : null}
          {!token ? (
            <AuthAlert variant="info">
              No reset token is present in the URL. Use a backend-issued reset link.
            </AuthAlert>
          ) : null}

          <FormField id="reset-password" label="New password">
            <PasswordField
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FormField>

          <PasswordStrength value={password} />

          <FormField
            id="reset-confirm-password"
            label="Confirm password"
            error={passwordMismatch ? "Passwords do not match." : undefined}
          >
            <PasswordField
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </FormField>

          <Button
            type="submit"
            className="w-full"
            disabled={auth.status === "loading" || passwordMismatch}
          >
            {auth.status === "loading" ? "Saving..." : "Save new password"}
          </Button>

          <p className="text-center text-sm text-slate-400">
            Back to{" "}
            <Link to="/login" className="font-semibold text-red-200 hover:text-red-100">
              sign in
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

export { ResetPasswordPage };
