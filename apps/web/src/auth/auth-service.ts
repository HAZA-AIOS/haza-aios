import { clearStoredAuth, readStoredAuth, writeStoredAuth } from "./auth-storage";
import type {
  AuthResult,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.types";
import type { User } from "./identity.types";

const delayMs = 350;

type AuthService = {
  getCurrentUser: () => Promise<AuthResult | null>;
  login: (input: LoginInput) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => Promise<void>;
  forgotPassword: (input: ForgotPasswordInput) => Promise<void>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  verifyEmail: (token: string) => Promise<AuthResult | null>;
};

const mockAuthService: AuthService = {
  async getCurrentUser() {
    await wait();
    return readStoredAuth();
  },

  async login(input) {
    await wait();

    if (!isValidEmail(input.email)) {
      throw new Error("Enter a valid work email address.");
    }

    if (input.password.length < 8) {
      throw new Error("Password must contain at least 8 characters.");
    }

    const auth = createAuthResult({
      firstName: "HAZA",
      lastName: "Operator",
      email: input.email,
      emailVerified: true,
      rememberMe: input.rememberMe,
    });

    writeStoredAuth(auth);
    return auth;
  },

  async register(input) {
    await wait();

    if (!input.firstName.trim() || !input.lastName.trim()) {
      throw new Error("Enter your first and last name.");
    }

    if (!isValidEmail(input.email)) {
      throw new Error("Enter a valid work email address.");
    }

    if (input.password.length < 8) {
      throw new Error("Password must contain at least 8 characters.");
    }

    const auth = createAuthResult({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      emailVerified: false,
      rememberMe: false,
    });

    writeStoredAuth(auth);
    return auth;
  },

  async logout() {
    await wait();
    clearStoredAuth();
  },

  async forgotPassword(input) {
    await wait();

    if (!isValidEmail(input.email)) {
      throw new Error("Enter a valid work email address.");
    }
  },

  async resetPassword(input) {
    await wait();

    if (!input.token.trim()) {
      throw new Error("Reset token is missing or expired.");
    }

    if (input.password.length < 8) {
      throw new Error("Password must contain at least 8 characters.");
    }
  },

  async verifyEmail(token) {
    await wait();

    if (!token.trim()) {
      return readStoredAuth();
    }

    const currentAuth = readStoredAuth();

    if (!currentAuth) {
      return null;
    }

    const verifiedAuth = {
      ...currentAuth,
      user: {
        ...currentAuth.user,
        emailVerified: true,
        updatedAt: new Date().toISOString(),
      },
    };

    writeStoredAuth(verifiedAuth);
    return verifiedAuth;
  },
};

function createAuthResult({
  firstName,
  lastName,
  email,
  emailVerified,
  rememberMe,
}: {
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  rememberMe: boolean;
}): AuthResult {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const user: User = {
    id,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    displayName,
    email: email.trim().toLowerCase(),
    emailVerified,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  return {
    user,
    session: {
      id: crypto.randomUUID(),
      userId: id,
      accessToken: `mock-session-${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
      rememberMe,
    },
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function wait() {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

export { mockAuthService };
export type { AuthService };
