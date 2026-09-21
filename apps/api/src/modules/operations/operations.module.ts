import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import { OperationalService } from "./services/operational.service.js";
import {
  readAuditQuery,
  readEventQuery,
  readNotificationQuery,
  readPreferenceInput,
} from "./operational-validation.js";

const base = "/api/v1/organizations/:organizationId";

export const operationsModule: BackendModule = {
  name: "operations",
  register(router) {
    router.register({
      method: "GET",
      path: `${base}/audit-logs`,
      async handler(request, response, { database, routeParams, url }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "audit.read",
        );
        sendJson(
          response,
          200,
          await new OperationalService(database).listAudits(
            organizationId,
            readAuditQuery(url.searchParams),
          ),
        );
      },
    });

    router.register({
      method: "GET",
      path: `${base}/domain-events`,
      async handler(request, response, { database, routeParams, url }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "event.read",
        );
        sendJson(
          response,
          200,
          await new OperationalService(database).listDomainEvents(
            organizationId,
            readEventQuery(url.searchParams),
          ),
        );
      },
    });

    router.register({
      method: "GET",
      path: `${base}/operational-events`,
      async handler(request, response, { database, routeParams, url }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "event.read",
        );
        sendJson(
          response,
          200,
          await new OperationalService(database).listOperationalEvents(
            organizationId,
            readEventQuery(url.searchParams),
          ),
        );
      },
    });

    router.register({
      method: "GET",
      path: `${base}/notifications`,
      async handler(request, response, { database, routeParams, url }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "notification.read",
        );
        const notifications = await new OperationalService(database).listUserNotifications(
          organizationId,
          auth.user.id,
          readNotificationQuery(url.searchParams),
        );
        sendJson(response, 200, {
          notifications: notifications.map(toNotificationDto),
          unreadCount: notifications.filter((notification) => !notification.isRead).length,
        });
      },
    });

    router.register({
      method: "PATCH",
      path: `${base}/notifications/:notificationId/read`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.notificationId, "notificationId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "notification.read",
        );
        const notification = await new OperationalService(database).markNotificationRead(
          organizationId,
          auth.user.id,
          routeParams.notificationId,
        );
        sendJson(response, 200, { notification: toNotificationDto(notification) });
      },
    });

    router.register({
      method: "PATCH",
      path: `${base}/notifications/:notificationId/acknowledge`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.notificationId, "notificationId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "notification.read",
        );
        const notification = await new OperationalService(database).acknowledgeNotification(
          organizationId,
          auth.user.id,
          routeParams.notificationId,
        );
        sendJson(response, 200, { notification: toNotificationDto(notification) });
      },
    });

    router.register({
      method: "POST",
      path: `${base}/notifications/mark-all-read`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "notification.read",
        );
        sendJson(response, 200, {
          updated: await new OperationalService(database).markAllNotificationsRead(
            organizationId,
            auth.user.id,
          ),
        });
      },
    });

    router.register({
      method: "GET",
      path: `${base}/notification-preferences`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "notification.read",
        );
        sendJson(response, 200, {
          preferences: await new OperationalService(database).getUserPreference(
            organizationId,
            auth.user.id,
          ),
        });
      },
    });

    router.register({
      method: "PUT",
      path: `${base}/notification-preferences`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "notification.read",
        );
        const input = readPreferenceInput(request.body);
        sendJson(response, 200, {
          preference: await new OperationalService(database).saveUserPreference(
            organizationId,
            input.workspaceId,
            auth.user.id,
            input.preferences,
          ),
        });
      },
    });
  },
};

function toNotificationDto(notification: Record<string, unknown> | null) {
  if (!notification) return null;
  const payload =
    notification.payload && typeof notification.payload === "object"
      ? (notification.payload as Record<string, unknown>)
      : {};
  return {
    ...payload,
    id: notification.id,
    workspaceId: notification.workspaceId,
    type: notification.notificationType,
    isRead: notification.isRead,
    readAt: notification.readAt,
    acknowledgedAt: notification.acknowledgedAt,
    dismissedAt: notification.dismissedAt,
    expiresAt: notification.expiresAt,
    createdAt: notification.createdAt,
  };
}
