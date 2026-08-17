import type { AgentTemplate } from "./agent.types";

export class AgentRegistry {
  private static templates: Map<string, AgentTemplate> = new Map();

  static register(template: AgentTemplate): void {
    if (this.templates.has(template.id)) {
      console.warn(`Agent template with ID ${template.id} is already registered. Overwriting.`);
    }
    this.templates.set(template.id, template);
  }

  static get(id: string): AgentTemplate | undefined {
    return this.templates.get(id);
  }

  static getAll(): AgentTemplate[] {
    return Array.from(this.templates.values());
  }

  static getByCategory(category: string): AgentTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  static getByIndustry(industry: string): AgentTemplate[] {
    return this.getAll().filter(t => t.industry === industry);
  }

  static getAvailable(): AgentTemplate[] {
    return this.getAll().filter(t => t.status === "available");
  }

  static isAvailable(id: string): boolean {
    const template = this.get(id);
    return template?.status === "available";
  }

  static unregister(id: string): void {
    this.templates.delete(id);
  }

  static clear(): void {
    this.templates.clear();
  }
}
