import { useState } from "react";
import type { FormEvent } from "react";

import { AuthAlert, Button, Checkbox, FormField, Input, PasswordField } from "@haza-aios/ui";

import { useAuth } from "@/auth/use-auth";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";

import { LogoMark } from "@haza-aios/ui/components/logo-mark";
import "./login-page.css";

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
    <div className="haza-login">
      <img
        className="login-landscape"
        src="/branding/haza-login-landscape.jpg"
        alt=""
        fetchPriority="high"
      />
      <header className="login-topbar">
        <Link to="/" className="login-brand">
          <LogoMark />
          <span>HAZA AIOS</span>
        </Link>
        <Link to="/" className="login-back">
          Back to site
        </Link>
      </header>
      <main className="login-composition">
        <div className="login-welcome">
          <p className="login-eyebrow">Your organization. Connected.</p>
          <h1>
            Welcome
            <br />
            <span>back.</span>
          </h1>
          <p>Your people, your work, your next chapter.</p>
        </div>
        <section className="login-panel" aria-labelledby="login-title">
          <p className="login-eyebrow">HAZA AIOS</p>
          <h2 id="login-title">Sign in to your workspace</h2>
          <p className="login-intro">Continue with your existing account.</p>
          <form className="login-form" onSubmit={handleSubmit}>
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

            <div className="login-options">
              <label className="login-remember">
                <Checkbox
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="login-link">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="login-submit" disabled={auth.status === "loading"}>
              {auth.status === "loading" ? "Signing in..." : "Sign in"}
            </Button>

            <p className="login-signup">
              New to HAZA AIOS?{" "}
              <Link to="/register" className="login-link">
                Create an account
              </Link>
            </p>
          </form>
        </section>
      </main>
      <footer className="login-footer">HAZA AIOS. People, operations and intelligence.</footer>
    </div>
  );
}

export { LoginPage };
