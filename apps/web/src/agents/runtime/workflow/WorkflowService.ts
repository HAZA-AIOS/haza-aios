import type { Workflow, WorkflowStep, Task } from "./workflow.types";

const WORKFLOWS_KEY = "haza-aios.workflows";
const WORKFLOW_STEPS_KEY = "haza-aios.workflow.steps";
const WORKFLOW_TASKS_KEY = "haza-aios.workflow.tasks";

export class WorkflowServiceClass {
  // --- WORKFLOWS ---
  private getWorkflowsDb(): Workflow[] {
    const data = localStorage.getItem(WORKFLOWS_KEY);
    return data ? JSON.parse(data) : [];
  }
  private saveWorkflowsDb(workflows: Workflow[]) {
    localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(workflows));
  }

  async getWorkflows(organizationId: string): Promise<Workflow[]> {
    return this.getWorkflowsDb().filter(w => w.organizationId === organizationId);
  }

  async getWorkflow(id: string, organizationId: string): Promise<Workflow | null> {
    return this.getWorkflowsDb().find(w => w.id === id && w.organizationId === organizationId) || null;
  }

  async saveWorkflow(workflow: Workflow): Promise<Workflow> {
    const workflows = this.getWorkflowsDb();
    const index = workflows.findIndex(w => w.id === workflow.id);
    if (index >= 0) workflows[index] = workflow;
    else workflows.push(workflow);
    this.saveWorkflowsDb(workflows);
    return workflow;
  }

  // --- STEPS ---
  private getStepsDb(): WorkflowStep[] {
    const data = localStorage.getItem(WORKFLOW_STEPS_KEY);
    return data ? JSON.parse(data) : [];
  }
  private saveStepsDb(steps: WorkflowStep[]) {
    localStorage.setItem(WORKFLOW_STEPS_KEY, JSON.stringify(steps));
  }

  async getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
    return this.getStepsDb().filter(s => s.workflowId === workflowId).sort((a, b) => a.order - b.order);
  }

  async saveWorkflowSteps(steps: WorkflowStep[]): Promise<void> {
    let db = this.getStepsDb();
    steps.forEach(step => {
      const index = db.findIndex(s => s.id === step.id);
      if (index >= 0) db[index] = step;
      else db.push(step);
    });
    this.saveStepsDb(db);
  }

  // --- TASKS ---
  private getTasksDb(): Task[] {
    const data = localStorage.getItem(WORKFLOW_TASKS_KEY);
    return data ? JSON.parse(data) : [];
  }
  private saveTasksDb(tasks: Task[]) {
    localStorage.setItem(WORKFLOW_TASKS_KEY, JSON.stringify(tasks));
  }

  async getTasks(organizationId: string, workflowId?: string): Promise<Task[]> {
    return this.getTasksDb().filter(t => 
      t.organizationId === organizationId && 
      (workflowId ? t.workflowId === workflowId : true)
    );
  }

  async getTask(id: string, organizationId: string): Promise<Task | null> {
    return this.getTasksDb().find(t => t.id === id && t.organizationId === organizationId) || null;
  }

  async saveTask(task: Task): Promise<Task> {
    const tasks = this.getTasksDb();
    const index = tasks.findIndex(t => t.id === task.id);
    if (index >= 0) tasks[index] = task;
    else tasks.push(task);
    this.saveTasksDb(tasks);
    return task;
  }
}

export const WorkflowService = new WorkflowServiceClass();
