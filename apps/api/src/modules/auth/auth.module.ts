import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService, readBearerToken, readCookie } from "./services/auth.service.js";
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  sessionCookieName,
} from "./services/token.service.js";
import { assertRegistrationAllowed } from "./registration-policy.js";
import {
  validateCreateUser,
  validateForgotPassword,
  validateLogin,
  validateRegister,
  validateResetPassword,
} from "./validation/auth-validation.js";

export const authModule: BackendModule = {
  name: "auth",
  register(router) {
    router.register({
      method: "POST",
      path: "/api/v1/auth/register-identity",
      async handler(request, response, { config, database }) {
        const input = validateCreateUser(request.body);
        assertRegistrationAllowed(input.email, config.registrationAllowedEmails);
        const result = await new AuthService(
          database,
          config.email,
          config.sessionCookieName,
        ).registerIdentity(input);
        response.setHeader(
          "set-cookie",
          buildSessionCookie(
            result.session.accessToken,
            new Date(result.session.expiresAt),
            config.nodeEnv === "production" || config.appEnv === "staging",
            config.sessionCookieName,
          ),
        );
        sendJson(response, 201, result);
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/auth/register",
      async handler(request, response, { config, database }) {
        const input = validateRegister(request.body);
        assertRegistrationAllowed(input.email, config.registrationAllowedEmails);
        const result = await new AuthService(
          database,
          config.email,
          config.sessionCookieName,
        ).register(input);
        response.setHeader(
          "set-cookie",
          buildSessionCookie(
            result.session.accessToken,
            new Date(result.session.expiresAt),
            config.nodeEnv === "production" || config.appEnv === "staging",
            config.sessionCookieName,
          ),
        );
        sendJson(response, 201, result);
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/auth/login",
      async handler(request, response, { config, database }) {
        const input = validateLogin(request.body);
        const result = await new AuthService(
          database,
          config.email,
          config.sessionCookieName,
        ).login(input, request);
        response.setHeader(
          "set-cookie",
          buildSessionCookie(
            result.session.accessToken,
            new Date(result.session.expiresAt),
            config.nodeEnv === "production" || config.appEnv === "staging",
            config.sessionCookieName,
          ),
        );
        sendJson(response, 200, result);
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/auth/logout",
      async handler(request, response, { config, database }) {
        const cookieName = config.sessionCookieName ?? sessionCookieName;
        const token =
          readBearerToken(request) ??
          readCookie(request, cookieName) ??
          readCookie(request, sessionCookieName);
        await new AuthService(database, config.email, cookieName).logout(token);
        response.setHeader("set-cookie", buildExpiredSessionCookie(cookieName));
        sendJson(response, 204, {});
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/auth/me",
      async handler(request, response, { config, database }) {
        const auth = await new AuthService(
          database,
          config.email,
          config.sessionCookieName,
        ).authenticateRequest(request);
        sendJson(response, 200, {
          user: auth.user,
          session: {
            id: auth.session.id,
            userId: auth.session.userId,
            accessToken: "",
            expiresAt: auth.session.expiresAt.toISOString(),
            rememberMe: auth.session.rememberMe,
          },
          memberships: auth.memberships,
          platformPermissions: auth.platformPermissions,
        });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/auth/forgot-password",
      async handler(request, response, { config, database }) {
        const input = validateForgotPassword(request.body);
        // Always returns 200 — prevents email enumeration.
        await new AuthService(
          database,
          config.email,
          config.sessionCookieName,
        ).forgotPassword(input, request);
        sendJson(response, 200, {
          message: "If that email is registered, a reset link has been sent.",
        });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/auth/reset-password",
      async handler(request, response, { config, database }) {
        const input = validateResetPassword(request.body);
        await new AuthService(
          database,
          config.email,
          config.sessionCookieName,
        ).resetPassword(input, request);
        sendJson(response, 200, {
          message: "Password updated. Please sign in with your new password.",
        });
      },
    });
  },
};
