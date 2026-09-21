import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import { WorkflowService } from "./services/workflow.service.js";
import {
  validateCreateRun,
  validateCreateTask,
  validateCreateWorkflow,
  readExpectedRevision,
  validateSteps,
  validateUpdateRun,
  validateUpdateTask,
  validateUpdateWorkflow,
} from "./workflow-validation.js";

const base = "/api/v1/organizations/:organizationId";

export const workflowsModule: BackendModule = {
  name: "workflows",
  register(router) {
    router.register({
      method: "GET",
      path: `${base}/workflows`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.read",
        );
        sendJson(response, 200, {
          workflows: await new WorkflowService(database).listWorkflows(organizationId),
        });
      },
    });
    router.register({
      method: "POST",
      path: `${base}/workflows`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.manage",
        );
        sendJson(response, 201, {
          workflow: await new WorkflowService(database).createWorkflow(
            validateCreateWorkflow(organizationId, auth.user.id, request.body),
          ),
        });
      },
    });
    router.register({
      method: "GET",
      path: `${base}/workflows/:workflowId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workflowId, "workflowId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.read",
        );
        sendJson(response, 200, {
          workflow: await new WorkflowService(database).getWorkflow(
            organizationId,
            routeParams.workflowId,
          ),
        });
      },
    });
    router.register({
      method: "PATCH",
      path: `${base}/workflows/:workflowId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workflowId, "workflowId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.manage",
        );
        sendJson(response, 200, {
          workflow: await new WorkflowService(database).updateWorkflow(
            organizationId,
            routeParams.workflowId,
            validateUpdateWorkflow(request.body),
          ),
        });
      },
    });
    router.register({
      method: "GET",
      path: `${base}/workflows/:workflowId/steps`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workflowId, "workflowId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.read",
        );
        sendJson(response, 200, {
          steps: await new WorkflowService(database).listSteps(
            organizationId,
            routeParams.workflowId,
          ),
        });
      },
    });
    router.register({
      method: "PUT",
      path: `${base}/workflows/:workflowId/steps`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workflowId, "workflowId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.manage",
        );
        sendJson(response, 200, {
          steps: await new WorkflowService(database).replaceSteps(
            organizationId,
            routeParams.workflowId,
            readExpectedRevision(request.body),
            validateSteps(request.body),
          ),
        });
      },
    });
    router.register({
      method: "GET",
      path: `${base}/workflow-runs`,
      async handler(request, response, { database, routeParams, url }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.read",
        );
        const workflowId = url.searchParams.get("workflowId") ?? undefined;
        if (workflowId) assertUuid(workflowId, "workflowId");
        sendJson(response, 200, {
          runs: await new WorkflowService(database).listRuns(organizationId, workflowId),
        });
      },
    });
    router.register({
      method: "POST",
      path: `${base}/workflow-runs`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.run",
        );
        sendJson(response, 201, {
          run: await new WorkflowService(database).createRun(
            validateCreateRun(organizationId, auth.user.id, request.body),
          ),
        });
      },
    });
    router.register({
      method: "GET",
      path: `${base}/workflow-runs/:runId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.read",
        );
        sendJson(response, 200, {
          ...(await new WorkflowService(database).getRunState(organizationId, routeParams.runId)),
        });
      },
    });
    router.register({
      method: "PATCH",
      path: `${base}/workflow-runs/:runId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.run",
        );
        sendJson(
          response,
          200,
          await new WorkflowService(database).updateRun(
            organizationId,
            routeParams.runId,
            validateUpdateRun(request.body, auth.user.id),
          ),
        );
      },
    });
    router.register({
      method: "GET",
      path: `${base}/workflow-tasks`,
      async handler(request, response, { database, routeParams, url }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.read",
        );
        const runId = url.searchParams.get("workflowRunId") ?? undefined;
        if (runId) assertUuid(runId, "workflowRunId");
        sendJson(response, 200, {
          tasks: await new WorkflowService(database).listTasks(organizationId, runId),
        });
      },
    });
    router.register({
      method: "POST",
      path: `${base}/workflow-tasks`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.manage",
        );
        sendJson(response, 201, {
          task: await new WorkflowService(database).createTask(
            validateCreateTask(organizationId, auth.user.id, request.body),
          ),
        });
      },
    });
    router.register({
      method: "PATCH",
      path: `${base}/workflow-tasks/:taskId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.taskId, "taskId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "workflow.manage",
        );
        sendJson(response, 200, {
          task: await new WorkflowService(database).updateTask(
            organizationId,
            routeParams.taskId,
            validateUpdateTask(request.body),
          ),
        });
      },
    });
  },
};
