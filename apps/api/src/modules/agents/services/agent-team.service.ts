import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { AgentTeamRepository } from "../repositories/agent-team.repository.js";
import type {
  AgentTeamRecord,
  CreateAgentTeamInput,
  UpdateAgentTeamInput,
} from "../orchestration.types.js";

export class AgentTeamService {
  private readonly repo: AgentTeamRepository;

  constructor(
    private readonly database: DatabaseClient,
    repo?: AgentTeamRepository,
  ) {
    const repoCtx = this.database?.db ? createRepositoryContext(this.database.db) : ({} as any);
    this.repo = repo ?? new AgentTeamRepository(repoCtx);
  }

  async createTeam(input: CreateAgentTeamInput): Promise<AgentTeamRecord> {
    return this.repo.createTeam(input);
  }

  async getTeam(organizationId: string, teamId: string): Promise<AgentTeamRecord> {
    const team = await this.repo.getTeam(organizationId, teamId);
    if (!team) {
      throw new ApiError(404, "NOT_FOUND", `Agent team '${teamId}' not found.`);
    }
    return team;
  }

  async listTeams(organizationId: string, workspaceId?: string): Promise<AgentTeamRecord[]> {
    return this.repo.listTeams(organizationId, workspaceId);
  }

  async updateTeam(
    organizationId: string,
    teamId: string,
    input: UpdateAgentTeamInput,
  ): Promise<AgentTeamRecord> {
    const updated = await this.repo.updateTeam(organizationId, teamId, input);
    if (!updated) {
      throw new ApiError(404, "NOT_FOUND", `Agent team '${teamId}' not found.`);
    }
    return updated;
  }

  async deleteTeam(organizationId: string, teamId: string): Promise<void> {
    const success = await this.repo.deleteTeam(organizationId, teamId);
    if (!success) {
      throw new ApiError(404, "NOT_FOUND", `Agent team '${teamId}' not found.`);
    }
  }
}

