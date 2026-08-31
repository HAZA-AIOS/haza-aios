import { apiClient } from "@/api/api-client";
import { readStoredAuth } from "@/auth/auth-storage";
import type { Conversation, ConversationMessage, MessageRole } from "../../agent.types";

const CONVERSATIONS_KEY = "haza-aios.agents.conversations";
const MESSAGES_KEY = "haza-aios.agents.messages";

export class ConversationServiceClass {
  private getConversationsDb(): Conversation[] {
    const data = localStorage.getItem(CONVERSATIONS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveConversationsDb(conversations: Conversation[]): void {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }

  async getConversation(id: string, organizationId: string): Promise<Conversation | undefined> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      try {
        const response = await apiClient.request<{ conversation: Conversation }>(
          `/api/v1/organizations/${organizationId}/agent-conversations/${id}`,
          {
            authToken: auth?.session.accessToken,
          },
        );
        return response.conversation;
      } catch (error) {
        if ((error as { status?: number }).status === 404) return undefined;
        throw error;
      }
    }
    return this.getConversationsDb().find(
      (c) => c.id === id && c.organizationId === organizationId,
    );
  }

  async getConversations(
    organizationId: string,
    userId: string,
    agentInstanceId?: string,
  ): Promise<Conversation[]> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      const suffix = agentInstanceId ? `?agentId=${encodeURIComponent(agentInstanceId)}` : "";
      const response = await apiClient.request<{ conversations: Conversation[] }>(
        `/api/v1/organizations/${organizationId}/agent-conversations${suffix}`,
        {
          authToken: auth?.session.accessToken,
        },
      );
      return response.conversations;
    }
    let convos = this.getConversationsDb().filter(
      (c) => c.organizationId === organizationId && c.userId === userId,
    );
    if (agentInstanceId) {
      convos = convos.filter((c) => c.agentInstanceId === agentInstanceId);
    }
    return convos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createConversation(
    data: Omit<Conversation, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<Conversation> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      const response = await apiClient.request<{ conversation: Conversation }>(
        `/api/v1/organizations/${data.organizationId}/agent-conversations`,
        {
          method: "POST",
          authToken: auth?.session.accessToken,
          body: JSON.stringify({ agentId: data.agentInstanceId, title: data.title }),
        },
      );
      return response.conversation;
    }
    const convos = this.getConversationsDb();
    const newConvo: Conversation = {
      ...data,
      id: `conv_${Math.random().toString(36).substr(2, 9)}`,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    convos.push(newConvo);
    this.saveConversationsDb(convos);
    return newConvo;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    if (!isTestRuntime())
      throw new Error("Conversation updates are not available through the runtime API yet.");
    const convos = this.getConversationsDb();
    const index = convos.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Conversation not found");

    convos[index] = { ...convos[index], ...updates, updatedAt: new Date().toISOString() };
    this.saveConversationsDb(convos);
    return convos[index];
  }

  private getMessagesDb(): ConversationMessage[] {
    const data = localStorage.getItem(MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveMessagesDb(messages: ConversationMessage[]): void {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  }

  async getMessages(
    conversationId: string,
    limit?: number,
    organizationId?: string,
  ): Promise<ConversationMessage[]> {
    if (!isTestRuntime()) {
      const resolvedOrganizationId = organizationId;
      if (!resolvedOrganizationId)
        throw new Error("Organization is required to load conversation messages.");
      const suffix = limit ? `?limit=${encodeURIComponent(String(limit))}` : "";
      const response = await apiClient.request<{ messages: ConversationMessage[] }>(
        `/api/v1/organizations/${resolvedOrganizationId}/agent-conversations/${conversationId}/messages${suffix}`,
        {
          authToken: readStoredAuth()?.session.accessToken,
        },
      );
      return response.messages;
    }
    let messages = this.getMessagesDb().filter((m) => m.conversationId === conversationId);
    messages = messages.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    if (limit && limit > 0) {
      return messages.slice(-limit);
    }
    return messages;
  }

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    metadata?: Record<string, unknown>,
    organizationId?: string,
    agentRunId?: string,
  ): Promise<ConversationMessage> {
    if (!isTestRuntime()) {
      const resolvedOrganizationId = organizationId;
      if (!resolvedOrganizationId)
        throw new Error("Organization is required to persist a conversation message.");
      const auth = readStoredAuth();
      const response = await apiClient.request<{ message: ConversationMessage }>(
        `/api/v1/organizations/${resolvedOrganizationId}/agent-conversations/${conversationId}/messages`,
        {
          method: "POST",
          authToken: auth?.session.accessToken,
          body: JSON.stringify({ role, content, metadata, agentRunId }),
        },
      );
      return response.message;
    }
    const messages = this.getMessagesDb();
    const newMsg: ConversationMessage = {
      id: `msg_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      role,
      content,
      metadata,
      createdAt: new Date().toISOString(),
    };

    messages.push(newMsg);
    this.saveMessagesDb(messages);

    const convos = this.getConversationsDb();
    const cIndex = convos.findIndex((c) => c.id === conversationId);
    if (cIndex !== -1) {
      convos[cIndex].updatedAt = new Date().toISOString();
      this.saveConversationsDb(convos);
    }

    return newMsg;
  }
}

export const ConversationService = new ConversationServiceClass();

function isTestRuntime() {
  return import.meta.env.MODE === "test";
}
