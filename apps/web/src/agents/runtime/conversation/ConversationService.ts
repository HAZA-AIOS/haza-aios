import type { Conversation, ConversationMessage, MessageRole } from "../../agent.types";

const CONVERSATIONS_KEY = "haza-aios.agents.conversations";
const MESSAGES_KEY = "haza-aios.agents.messages";

export class ConversationServiceClass {
  // --- Conversations ---
  private getConversationsDb(): Conversation[] {
    const data = localStorage.getItem(CONVERSATIONS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveConversationsDb(conversations: Conversation[]): void {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  }

  async getConversation(id: string, organizationId: string): Promise<Conversation | undefined> {
    return this.getConversationsDb().find(c => c.id === id && c.organizationId === organizationId);
  }

  async getConversations(organizationId: string, userId: string, agentInstanceId?: string): Promise<Conversation[]> {
    let convos = this.getConversationsDb().filter(c => c.organizationId === organizationId && c.userId === userId);
    if (agentInstanceId) {
      convos = convos.filter(c => c.agentInstanceId === agentInstanceId);
    }
    return convos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createConversation(data: Omit<Conversation, "id" | "status" | "createdAt" | "updatedAt">): Promise<Conversation> {
    const convos = this.getConversationsDb();
    const newConvo: Conversation = {
      ...data,
      id: `conv_${Math.random().toString(36).substr(2, 9)}`,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    convos.push(newConvo);
    this.saveConversationsDb(convos);
    return newConvo;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const convos = this.getConversationsDb();
    const index = convos.findIndex(c => c.id === id);
    if (index === -1) throw new Error("Conversation not found");
    
    convos[index] = { ...convos[index], ...updates, updatedAt: new Date().toISOString() };
    this.saveConversationsDb(convos);
    return convos[index];
  }

  // --- Messages ---
  private getMessagesDb(): ConversationMessage[] {
    const data = localStorage.getItem(MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveMessagesDb(messages: ConversationMessage[]): void {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  }

  async getMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]> {
    let messages = this.getMessagesDb().filter(m => m.conversationId === conversationId);
    messages = messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    if (limit && limit > 0) {
      return messages.slice(-limit);
    }
    return messages;
  }

  async addMessage(
    conversationId: string, 
    role: MessageRole, 
    content: string, 
    metadata?: Record<string, any>
  ): Promise<ConversationMessage> {
    const messages = this.getMessagesDb();
    const newMsg: ConversationMessage = {
      id: `msg_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      role,
      content,
      metadata,
      createdAt: new Date().toISOString()
    };
    
    messages.push(newMsg);
    this.saveMessagesDb(messages);
    
    // Update the conversation's updatedAt timestamp
    const convos = this.getConversationsDb();
    const cIndex = convos.findIndex(c => c.id === conversationId);
    if (cIndex !== -1) {
      convos[cIndex].updatedAt = new Date().toISOString();
      this.saveConversationsDb(convos);
    }
    
    return newMsg;
  }
}

export const ConversationService = new ConversationServiceClass();
