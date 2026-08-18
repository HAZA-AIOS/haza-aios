import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService, readBearerToken, readCookie } from "./services/auth.service.js";
import { buildExpiredSessionCookie, buildSessionCookie, sessionCookieName } from "./services/token.service.js";
import { validateLogin, validateRegister } from "./validation/auth-validation.js";

export const authModule: BackendModule = {
  name: "auth",
  register(router) {
    router.register({
      method: "POST",
      path: "/api/v1/auth/register",
      async handler(request, response, { config, database }) {
        const input = validateRegister(request.body);
        const result = await new AuthService(database).register(input);
        response.setHeader("set-cookie", buildSessionCookie(result.session.accessToken, new Date(result.session.expiresAt), config.nodeEnv === "production"));
        sendJson(response, 201, result);
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/auth/login",
      async handler(request, response, { config, database }) {
        const input = validateLogin(request.body);
        const result = await new AuthService(database).login(input, request);
        response.setHeader("set-cookie", buildSessionCookie(result.session.accessToken, new Date(result.session.expiresAt), config.nodeEnv === "production"));
        sendJson(response, 200, result);
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/auth/logout",
      async handler(request, response, { database }) {
        const token = readBearerToken(request) ?? readCookie(request, sessionCookieName);
        await new AuthService(database).logout(token);
        response.setHeader("set-cookie", buildExpiredSessionCookie());
        sendJson(response, 204, {});
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/auth/me",
      async handler(request, response, { database }) {
        const auth = await new AuthService(database).authenticateRequest(request);
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
  },
};
