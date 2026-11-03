import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  agentTeams,
  agentTeamMembers,
  aiAgentDefinitions,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AgentTeamRecord,
  AgentTeamMemberRecord,
  CreateAgentTeamInput,
  UpdateAgentTeamInput,
} from "../orchestration.types.js";

export class AgentTeamRepository {
  constructor(private readonly context: RepositoryContext) {}

  async createTeam(input: CreateAgentTeamInput): Promise<AgentTeamRecord> {
    const teamId = randomUUID();

    await this.context.db.insert(agentTeams).values({
      id: teamId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      status: "active",
      createdBy: input.createdBy,
    });

    if (input.members.length > 0) {
      await this.context.db.insert(agentTeamMembers).values(
        input.members.map((m) => ({
          id: randomUUID(),
          teamId,
          organizationId: input.organizationId,
          agentId: m.agentId,
          role: m.role,
          capabilities: m.capabilities || [],
          priority: m.priority || 0,
          status: "active",
        })),
      );
    }

    const created = await this.getTeam(input.organizationId, teamId);
    if (!created) {
      throw new Error(`Failed to load newly created agent team ${teamId}`);
    }
    return created;
  }

  async getTeam(organizationId: string, teamId: string): Promise<AgentTeamRecord | null> {
    const [teamRow] = await this.context.db
      .select()
      .from(agentTeams)
      .where(and(eq(agentTeams.organizationId, organizationId), eq(agentTeams.id, teamId)));

    if (!teamRow) return null;

    const memberRows = await this.context.db
      .select({
        member: agentTeamMembers,
        agentName: aiAgentDefinitions.name,
        agentKey: aiAgentDefinitions.agentKey,
      })
      .from(agentTeamMembers)
      .leftJoin(aiAgentDefinitions, eq(aiAgentDefinitions.id, agentTeamMembers.agentId))
      .where(
        and(
          eq(agentTeamMembers.organizationId, organizationId),
          eq(agentTeamMembers.teamId, teamId),
        ),
      );

    const members: AgentTeamMemberRecord[] = memberRows.map((r) => ({
      id: r.member.id,
      teamId: r.member.teamId,
      organizationId: r.member.organizationId,
      agentId: r.member.agentId,
      role: r.member.role as any,
      capabilities: r.member.capabilities || [],
      priority: r.member.priority,
      status: r.member.status as any,
      createdAt: r.member.createdAt.toISOString(),
      updatedAt: r.member.updatedAt.toISOString(),
      agentName: r.agentName || undefined,
      agentKey: r.agentKey || undefined,
    }));

    return {
      id: teamRow.id,
      organizationId: teamRow.organizationId,
      workspaceId: teamRow.workspaceId,
      name: teamRow.name,
      description: teamRow.description,
      status: teamRow.status as any,
      createdBy: teamRow.createdBy,
      createdAt: teamRow.createdAt.toISOString(),
      updatedAt: teamRow.updatedAt.toISOString(),
      members,
    };
  }

  async listTeams(organizationId: string, workspaceId?: string): Promise<AgentTeamRecord[]> {
    const conditions = [eq(agentTeams.organizationId, organizationId)];
    if (workspaceId) {
      conditions.push(eq(agentTeams.workspaceId, workspaceId));
    }

    const teamRows = await this.context.db
      .select()
      .from(agentTeams)
      .where(and(...conditions))
      .orderBy(desc(agentTeams.createdAt));

    const result: AgentTeamRecord[] = [];
    for (const teamRow of teamRows) {
      const memberRows = await this.context.db
        .select({
          member: agentTeamMembers,
          agentName: aiAgentDefinitions.name,
          agentKey: aiAgentDefinitions.agentKey,
        })
        .from(agentTeamMembers)
        .leftJoin(aiAgentDefinitions, eq(aiAgentDefinitions.id, agentTeamMembers.agentId))
        .where(
          and(
            eq(agentTeamMembers.organizationId, organizationId),
            eq(agentTeamMembers.teamId, teamRow.id),
          ),
        );

      result.push({
        id: teamRow.id,
        organizationId: teamRow.organizationId,
        workspaceId: teamRow.workspaceId,
        name: teamRow.name,
        description: teamRow.description,
        status: teamRow.status as any,
        createdBy: teamRow.createdBy,
        createdAt: teamRow.createdAt.toISOString(),
        updatedAt: teamRow.updatedAt.toISOString(),
        members: memberRows.map((r) => ({
          id: r.member.id,
          teamId: r.member.teamId,
          organizationId: r.member.organizationId,
          agentId: r.member.agentId,
          role: r.member.role as any,
          capabilities: r.member.capabilities || [],
          priority: r.member.priority,
          status: r.member.status as any,
          createdAt: r.member.createdAt.toISOString(),
          updatedAt: r.member.updatedAt.toISOString(),
          agentName: r.agentName || undefined,
          agentKey: r.agentKey || undefined,
        })),
      });
    }

    return result;
  }

  async updateTeam(
    organizationId: string,
    teamId: string,
    input: UpdateAgentTeamInput,
  ): Promise<AgentTeamRecord | null> {
    const existing = await this.getTeam(organizationId, teamId);
    if (!existing) return null;

    const updateValues: Record<string, unknown> = {};
    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.status !== undefined) updateValues.status = input.status;

    if (Object.keys(updateValues).length > 0) {
      await this.context.db
        .update(agentTeams)
        .set(updateValues)
        .where(and(eq(agentTeams.organizationId, organizationId), eq(agentTeams.id, teamId)));
    }

    if (input.members) {
      await this.context.db
        .delete(agentTeamMembers)
        .where(
          and(
            eq(agentTeamMembers.organizationId, organizationId),
            eq(agentTeamMembers.teamId, teamId),
          ),
        );

      if (input.members.length > 0) {
        await this.context.db.insert(agentTeamMembers).values(
          input.members.map((m) => ({
            id: randomUUID(),
            teamId,
            organizationId,
            agentId: m.agentId,
            role: m.role,
            capabilities: m.capabilities || [],
            priority: m.priority || 0,
            status: "active",
          })),
        );
      }
    }

    return this.getTeam(organizationId, teamId);
  }

  async deleteTeam(organizationId: string, teamId: string): Promise<boolean> {
    const res = await this.context.db
      .delete(agentTeams)
      .where(and(eq(agentTeams.organizationId, organizationId), eq(agentTeams.id, teamId)));
    return (res as any)[0]?.affectedRows > 0;
  }
}

