export interface WorksheetQuestion {
  id: string;
  number: number;
  type: "multiple-choice" | "open-ended" | "true-false" | "fill-in-the-blank";
  question: string;
  options?: string[]; // for multiple choice
  answer: string;
}

export interface WorksheetGenerationParams {
  grade: string;
  subject: string;
  topic: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  questionCount: number;
  questionTypes: string[];
  learningObjective: string;
  instructions: string;
}

export interface Worksheet {
  id: string;
  organizationId: string;
  createdBy: string;
  agentInstanceId: string;
  runId: string;
  
  title: string;
  params: WorksheetGenerationParams;
  
  questions: WorksheetQuestion[];
  answerKey: Record<string, string>; // Maps question id/number to answer

  createdAt: string;
  updatedAt: string;
}

const WORKSHEETS_KEY = "haza-aios.education.worksheets";

export class WorksheetServiceClass {
  private getWorksheetsDb(): Worksheet[] {
    const data = localStorage.getItem(WORKSHEETS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveWorksheetsDb(worksheets: Worksheet[]): void {
    localStorage.setItem(WORKSHEETS_KEY, JSON.stringify(worksheets));
  }

  async getWorksheets(organizationId: string): Promise<Worksheet[]> {
    return this.getWorksheetsDb().filter((w) => w.organizationId === organizationId);
  }

  async getWorksheet(id: string, organizationId: string): Promise<Worksheet | undefined> {
    return this.getWorksheetsDb().find((w) => w.id === id && w.organizationId === organizationId);
  }

  async saveWorksheet(worksheet: Worksheet): Promise<Worksheet> {
    const worksheets = this.getWorksheetsDb();
    
    // Check if updating
    const index = worksheets.findIndex(w => w.id === worksheet.id);
    if (index !== -1) {
      worksheets[index] = { ...worksheets[index], ...worksheet, updatedAt: new Date().toISOString() };
    } else {
      worksheets.push(worksheet);
    }

    this.saveWorksheetsDb(worksheets);
    return worksheet;
  }
}

export const WorksheetService = new WorksheetServiceClass();
