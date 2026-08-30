import { useState } from "react";
import type { FormEvent } from "react";

import {
  AuthAlert,
  AuthCard,
  Button,
  Checkbox,
  FormField,
  Input,
  PasswordField,
} from "@haza-aios/ui";

import { useAuth } from "@/auth/use-auth";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";

import { AuthShell } from "./AuthShell";

function LoginPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await auth.login({ email, password, rememberMe });
    navigate("/app");
  }

  return (
    <AuthShell>
      <AuthCard
        eyebrow="Welcome back"
        title="Sign in to HAZA AIOS"
        description="Use your workspace identity to continue into protected application routes."
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {auth.error ? <AuthAlert variant="error">{auth.error.message}</AuthAlert> : null}

          <FormField id="login-email" label="Email">
            <Input
              autoComplete="email"
              inputMode="email"
              placeholder="you@organization.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FormField>

          <FormField id="login-password" label="Password">
            <PasswordField
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FormField>

          <div className="flex items-center justify-between gap-4 text-sm">
            <label className="flex items-center gap-2 text-slate-300">
              <Checkbox
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="font-semibold text-red-200 hover:text-red-100">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={auth.status === "loading"}>
            {auth.status === "loading" ? "Signing in..." : "Sign in"}
          </Button>

          <p className="text-center text-sm text-slate-400">
            New to HAZA AIOS?{" "}
            <Link to="/register" className="font-semibold text-red-200 hover:text-red-100">
              Create an account
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

export { LoginPage };
