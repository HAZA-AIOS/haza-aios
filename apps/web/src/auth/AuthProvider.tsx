import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { mockAuthService } from "./auth-service";
import type {
  AuthError,
  AuthState,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.types";

type AuthContextValue = AuthState & {
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (input: ForgotPasswordInput) => Promise<void>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const initialState: AuthState = {
  status: "loading",
  user: null,
  session: null,
  error: null,
};

function toAuthError(error: unknown): AuthError {
  if (error instanceof Error) {
    return {
      code: "auth_error",
      message: error.message,
    };
  }

  return {
    code: "auth_error",
    message: "Authentication request failed.",
  };
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let isMounted = true;

    mockAuthService
      .getCurrentUser()
      .then((auth) => {
        if (!isMounted) {
          return;
        }

        setState({
          status: auth ? "authenticated" : "unauthenticated",
          user: auth?.user ?? null,
          session: auth?.session ?? null,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setState({
          status: "error",
          user: null,
          session: null,
          error: toAuthError(error),
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const commitAuth = useCallback((auth: Awaited<ReturnType<typeof mockAuthService.login>>) => {
    setState({
      status: "authenticated",
      user: auth.user,
      session: auth.session,
      error: null,
    });
  }, []);

  const runAuthAction = useCallback(async <TResult,>(action: () => Promise<TResult>) => {
    setState((current) => ({ ...current, status: "loading", error: null }));

    try {
      return await action();
    } catch (error) {
      setState((current) => ({
        ...current,
        status: current.user ? "authenticated" : "unauthenticated",
        error: toAuthError(error),
      }));
      throw error;
    }
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const auth = await runAuthAction(() => mockAuthService.login(input));
      commitAuth(auth);
    },
    [commitAuth, runAuthAction],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const auth = await runAuthAction(() => mockAuthService.register(input));
      commitAuth(auth);
    },
    [commitAuth, runAuthAction],
  );

  const logout = useCallback(async () => {
    await runAuthAction(() => mockAuthService.logout());
    setState({
      status: "unauthenticated",
      user: null,
      session: null,
      error: null,
    });
  }, [runAuthAction]);

  const forgotPassword = useCallback(
    async (input: ForgotPasswordInput) => {
      await runAuthAction(() => mockAuthService.forgotPassword(input));
      setState((current) => ({
        ...current,
        status: current.user ? "authenticated" : "unauthenticated",
      }));
    },
    [runAuthAction],
  );

  const resetPassword = useCallback(
    async (input: ResetPasswordInput) => {
      await runAuthAction(() => mockAuthService.resetPassword(input));
      setState((current) => ({
        ...current,
        status: current.user ? "authenticated" : "unauthenticated",
      }));
    },
    [runAuthAction],
  );

  const verifyEmail = useCallback(
    async (token: string) => {
      const auth = await runAuthAction(() => mockAuthService.verifyEmail(token));

      if (auth) {
        commitAuth(auth);
        return;
      }

      setState({
        status: "unauthenticated",
        user: null,
        session: null,
        error: null,
      });
    },
    [commitAuth, runAuthAction],
  );

  const clearError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      verifyEmail,
      clearError,
    }),
    [clearError, forgotPassword, login, logout, register, resetPassword, state, verifyEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext, AuthProvider };
export type { AuthContextValue };
