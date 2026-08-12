import type { AuthResult } from "./auth.types";

const sessionKey = "haza-aios.auth.session";

function readStoredAuth(): AuthResult | null {
  const rawValue =
    window.localStorage.getItem(sessionKey) ?? window.sessionStorage.getItem(sessionKey);

  if (!rawValue) {
    return null;
  }

  const parsed = JSON.parse(rawValue) as AuthResult;

  if (new Date(parsed.session.expiresAt).getTime() <= Date.now()) {
    clearStoredAuth();
    return null;
  }

  return parsed;
}

function writeStoredAuth(auth: AuthResult) {
  clearStoredAuth();
  const targetStorage = auth.session.rememberMe ? window.localStorage : window.sessionStorage;
  targetStorage.setItem(sessionKey, JSON.stringify(auth));
}

function clearStoredAuth() {
  window.localStorage.removeItem(sessionKey);
  window.sessionStorage.removeItem(sessionKey);
}

export { clearStoredAuth, readStoredAuth, writeStoredAuth };
