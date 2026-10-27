import { sendJson } from "../../common/http/json.js";
import { ApiError } from "../../common/errors/api-error.js";
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
import {
  AUTH_RATE_LIMITS,
  assertRateLimit,
  defaultRateLimiterStore,
  hashIdentifier,
  resolveClientIp,
} from "../../middleware/rate-limiter.js";

export const authModule: BackendModule = {
  name: "auth",
  register(router) {
    router.register({
      method: "POST",
      path: "/api/v1/auth/register-identity",
      async handler(request, response, { config, database }) {
        const clientIp = resolveClientIp(request, config.trustProxy);
        const ipLimiter = defaultRateLimiterStore.consume(
          `auth:register:ip:${clientIp}`,
          AUTH_RATE_LIMITS.registration.perIp.max,
          AUTH_RATE_LIMITS.registration.perIp.windowMs,
        );
        assertRateLimit(ipLimiter, "Too many registration attempts. Please try again later.");

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
        const clientIp = resolveClientIp(request, config.trustProxy);
        const ipLimiter = defaultRateLimiterStore.consume(
          `auth:register:ip:${clientIp}`,
          AUTH_RATE_LIMITS.registration.perIp.max,
          AUTH_RATE_LIMITS.registration.perIp.windowMs,
        );
        assertRateLimit(ipLimiter, "Too many registration attempts. Please try again later.");

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
        const clientIp = resolveClientIp(request, config.trustProxy);

        // 1. IP abuse limit check
        const ipCheck = defaultRateLimiterStore.check(
          `auth:login:ip:${clientIp}`,
          AUTH_RATE_LIMITS.login.perIpAbuse.max,
          AUTH_RATE_LIMITS.login.perIpAbuse.windowMs,
        );
        assertRateLimit(ipCheck, "Too many login attempts from this IP. Please try again later.");

        // 2. Account failure limit check (hashed email + IP)
        const accountHash = hashIdentifier(input.email);
        const accountCheck = defaultRateLimiterStore.check(
          `auth:login:failed:${accountHash}:${clientIp}`,
          AUTH_RATE_LIMITS.login.perAccountFailures.max,
          AUTH_RATE_LIMITS.login.perAccountFailures.windowMs,
        );
        assertRateLimit(accountCheck, "Too many failed login attempts for this account. Please try again later.");

        // Record the IP attempt
        defaultRateLimiterStore.consume(
          `auth:login:ip:${clientIp}`,
          AUTH_RATE_LIMITS.login.perIpAbuse.max,
          AUTH_RATE_LIMITS.login.perIpAbuse.windowMs,
        );

        try {
          const result = await new AuthService(
            database,
            config.email,
            config.sessionCookieName,
          ).login(input, request);

          // On successful login, clear the failed counter for this account/IP
          defaultRateLimiterStore.reset(`auth:login:failed:${accountHash}:${clientIp}`);

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
        } catch (error) {
          if (error instanceof ApiError && error.code === "INVALID_CREDENTIALS") {
            defaultRateLimiterStore.recordFailure(
              `auth:login:failed:${accountHash}:${clientIp}`,
              AUTH_RATE_LIMITS.login.perAccountFailures.windowMs,
            );
          }
          throw error;
        }
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
        const clientIp = resolveClientIp(request, config.trustProxy);

        // Check IP limit
        const ipLimiter = defaultRateLimiterStore.consume(
          `auth:forgot:ip:${clientIp}`,
          AUTH_RATE_LIMITS.forgotPassword.perIp.max,
          AUTH_RATE_LIMITS.forgotPassword.perIp.windowMs,
        );
        assertRateLimit(ipLimiter, "Too many password reset requests. Please try again later.");

        // Check account/IP limit
        const accountHash = hashIdentifier(input.email);
        const accountLimiter = defaultRateLimiterStore.consume(
          `auth:forgot:acc:${accountHash}:${clientIp}`,
          AUTH_RATE_LIMITS.forgotPassword.perAccount.max,
          AUTH_RATE_LIMITS.forgotPassword.perAccount.windowMs,
        );
        assertRateLimit(accountLimiter, "Too many password reset requests for this account. Please try again later.");

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
        const clientIp = resolveClientIp(request, config.trustProxy);

        // Check IP limit
        const ipLimiter = defaultRateLimiterStore.consume(
          `auth:reset:ip:${clientIp}`,
          AUTH_RATE_LIMITS.resetPassword.perIp.max,
          AUTH_RATE_LIMITS.resetPassword.perIp.windowMs,
        );
        assertRateLimit(ipLimiter, "Too many password reset attempts. Please try again later.");

        // Check token hash / IP limit
        const tokenHash = hashIdentifier(input.token);
        const tokenLimiter = defaultRateLimiterStore.consume(
          `auth:reset:tok:${tokenHash}:${clientIp}`,
          AUTH_RATE_LIMITS.resetPassword.perAccount.max,
          AUTH_RATE_LIMITS.resetPassword.perAccount.windowMs,
        );
        assertRateLimit(tokenLimiter, "Too many reset attempts for this token. Please try again later.");

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
