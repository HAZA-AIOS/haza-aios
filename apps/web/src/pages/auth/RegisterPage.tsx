import { useState } from "react";
import type { FormEvent } from "react";

import {
  AuthAlert,
  AuthCard,
  Button,
  FormField,
  Input,
  PasswordField,
  PasswordStrength,
} from "@haza-aios/ui";

import { useAuth } from "@/auth/use-auth";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";

import { AuthShell } from "./AuthShell";

function RegisterPage() {
  const auth = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordMismatch) {
      return;
    }

    await auth.register({ firstName, lastName, email, password });
    navigate("/organization/create");
  }

  return (
    <AuthShell>
      <AuthCard
        eyebrow="Create identity"
        title="Register your user account"
        description="Organization registration comes later; Epic 3 creates the independent user identity layer."
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {auth.error ? <AuthAlert variant="error">{auth.error.message}</AuthAlert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="register-first-name" label="First name">
              <Input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </FormField>
            <FormField id="register-last-name" label="Last name">
              <Input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </FormField>
          </div>

          <FormField id="register-email" label="Email">
            <Input
              autoComplete="email"
              inputMode="email"
              placeholder="you@organization.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FormField>

          <FormField id="register-password" label="Password">
            <PasswordField
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FormField>

          <PasswordStrength value={password} />

          <FormField
            id="register-confirm-password"
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
            {auth.status === "loading" ? "Creating account..." : "Create account"}
          </Button>

          <p className="text-center text-sm text-slate-400">
            Already registered?{" "}
            <Link to="/login" className="font-semibold text-red-200 hover:text-red-100">
              Sign in
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

export { RegisterPage };
