import type { AuthSession, User } from "./identity.types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type AuthError = {
  code: string;
  message: string;
};

type LoginInput = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type ForgotPasswordInput = {
  email: string;
};

type ResetPasswordInput = {
  token: string;
  password: string;
};

type AuthResult = {
  user: User;
  session: AuthSession;
};

type AuthState = {
  status: AuthStatus;
  user: User | null;
  session: AuthSession | null;
  error: AuthError | null;
};

export type {
  AuthError,
  AuthResult,
  AuthState,
  AuthStatus,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
};
