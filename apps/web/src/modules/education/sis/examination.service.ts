import { jsonBody, sisRequest } from './sis-api';
import type {
  Assessment,
  Examination,
  ExaminationResultRegister,
  ExaminationSubject,
  GradingRule,
  MarkRecord,
  MarkSourceType,
  MissingMarksReportItem,
  ResultCorrectionRequest,
  ResultPublication,
  StudentResult,
  StudentResultCard,
  SubjectPerformance,
} from './sis.types';

type ActorRole = 'Owner' | 'Admin' | 'Member' | 'Teacher';
interface ActorContext {
  userId: string;
  role: ActorRole;
}

export interface MarkInput {
  sourceType: MarkSourceType;
  sourceId: string;
  examinationSubjectId?: string;
  sectionId?: string;
  studentId: string;
  obtainedMarks?: number;
  remarks?: string;
  enteredBy: string;
  isAbsent?: boolean;
  isExempt?: boolean;
  status?: string;
}

type MarkFilters = Partial<Pick<MarkRecord, 'sourceType' | 'sourceId' | 'studentId' | 'gradeId' | 'sectionId' | 'subjectId'>>;

function query(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? '?' + text : '';
}

export class ExaminationServiceClass {
  async getExaminations(organizationId: string): Promise<Examination[]> {
    const response = await sisRequest<{ examinations: Examination[] }>(organizationId, '/examinations');
    return response.examinations;
  }

  async createExamination(
    organizationId: string,
    data: Omit<Examination, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
    _actor?: ActorContext,
  ): Promise<Examination> {
    void _actor;
    const response = await sisRequest<{ examination: Examination }>(organizationId, '/examinations', { method: 'POST', ...jsonBody(data) });
    return response.examination;
  }

  async updateExamination(
    organizationId: string,
    id: string,
    updates: Partial<Examination>,
    _actor?: ActorContext,
  ): Promise<Examination> {
    void _actor;
    const response = await sisRequest<{ examination: Examination }>(organizationId, '/examinations/' + id, { method: 'PATCH', ...jsonBody(updates) });
    return response.examination;
  }

  async archiveExamination(organizationId: string, id: string): Promise<Examination> {
    const response = await sisRequest<{ examination: Examination }>(organizationId, `/examinations/${id}/archive`, { method: 'POST' });
    return response.examination;
  }

  async deleteExamination(organizationId: string, id: string): Promise<{ success: boolean; id: string }> {
    const response = await sisRequest<{ success: boolean; id: string }>(organizationId, `/examinations/${id}`, { method: 'DELETE' });
    return response;
  }

  async getExaminationSubjects(organizationId: string, examinationId?: string): Promise<ExaminationSubject[]> {
    const response = await sisRequest<{ subjects: ExaminationSubject[] }>(organizationId, '/examination-subjects' + query({ examinationId }));
    return response.subjects;
  }

  async addExaminationSubject(
    organizationId: string,
    data: Omit<ExaminationSubject, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
    _actor?: ActorContext,
  ): Promise<ExaminationSubject> {
    void _actor;
    const response = await sisRequest<{ subject: ExaminationSubject }>(organizationId, '/examination-subjects', { method: 'POST', ...jsonBody(data) });
    return response.subject;
  }

  async updateExaminationSubject(
    organizationId: string,
    id: string,
    data: Partial<ExaminationSubject>,
  ): Promise<ExaminationSubject> {
    const response = await sisRequest<{ subject: ExaminationSubject }>(organizationId, `/examination-subjects/${id}`, { method: 'PATCH', ...jsonBody(data) });
    return response.subject;
  }

  async deleteExaminationSubject(organizationId: string, id: string): Promise<{ success: boolean; id: string }> {
    const response = await sisRequest<{ success: boolean; id: string }>(organizationId, `/examination-subjects/${id}`, { method: 'DELETE' });
    return response;
  }

  async getAssessments(organizationId: string): Promise<Assessment[]> {
    const response = await sisRequest<{ assessments: Assessment[] }>(organizationId, '/assessments');
    return response.assessments;
  }

  async createAssessment(
    organizationId: string,
    data: Omit<Assessment, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
    _actor?: ActorContext,
  ): Promise<Assessment> {
    void _actor;
    const response = await sisRequest<{ assessment: Assessment }>(organizationId, '/assessments', { method: 'POST', ...jsonBody(data) });
    return response.assessment;
  }

  async getGradingRules(organizationId: string): Promise<GradingRule[]> {
    const response = await sisRequest<{ rules: GradingRule[] }>(organizationId, '/grading-rules');
    return response.rules;
  }

  async saveGradingRule(
    organizationId: string,
    data: Omit<GradingRule, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> & Partial<Pick<GradingRule, 'id'>>,
    _actor?: ActorContext,
  ): Promise<GradingRule> {
    void _actor;
    const response = await sisRequest<{ rule: GradingRule }>(organizationId, '/grading-rules', { method: 'PUT', ...jsonBody(data) });
    return response.rule;
  }

  async calculateGrade(organizationId: string, value: number): Promise<Pick<GradingRule, 'grade' | 'gradePoint'> | null> {
    const rules = await this.getGradingRules(organizationId);
    return rules.find((rule) => value >= rule.minPercentage && value <= rule.maxPercentage) || null;
  }

  async enterMark(organizationId: string, input: MarkInput, _actor?: ActorContext): Promise<MarkRecord> {
    void _actor;
    const response = await sisRequest<{ mark: MarkRecord }>(organizationId, '/marks', { method: 'POST', ...jsonBody(input) });
    return response.mark;
  }

  async bulkEnterMarks(organizationId: string, inputs: MarkInput[], _actor?: ActorContext): Promise<MarkRecord[]> {
    void _actor;
    const response = await sisRequest<{ marks: MarkRecord[] }>(organizationId, '/marks/bulk', { method: 'POST', ...jsonBody({ marks: inputs }) });
    return response.marks;
  }

  async getMarks(organizationId: string, filters: MarkFilters = {}): Promise<MarkRecord[]> {
    const response = await sisRequest<{ marks: MarkRecord[] }>(organizationId, '/marks' + query(filters));
    return response.marks;
  }

  async calculateClassResults(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
  ): Promise<StudentResult[]> {
    const response = await sisRequest<{ results: StudentResult[] }>(organizationId, '/results/calculate' + query({ examinationId, gradeId, sectionId }));
    return response.results;
  }

  async submitForReview(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
    actor?: ActorContext,
  ): Promise<ResultPublication> {
    const response = await sisRequest<{ publication: ResultPublication }>(organizationId, '/results/submit-review', {
      method: 'POST',
      ...jsonBody({ examinationId, gradeId, sectionId, userId: actor?.userId, role: actor?.role }),
    });
    return response.publication;
  }

  async reviewResults(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
    actor?: ActorContext,
  ): Promise<ResultPublication> {
    const response = await sisRequest<{ publication: ResultPublication }>(organizationId, '/results/review', {
      method: 'POST',
      ...jsonBody({ examinationId, gradeId, sectionId, decision, comments, userId: actor?.userId, role: actor?.role }),
    });
    return response.publication;
  }

  async publishResults(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
    actor?: ActorContext,
  ): Promise<ResultPublication> {
    const response = await sisRequest<{ publication: ResultPublication }>(organizationId, '/results/publish', {
      method: 'POST',
      ...jsonBody({ examinationId, gradeId, sectionId, publishedBy: actor?.userId || 'system' }),
    });
    return response.publication;
  }

  async getResultPublications(organizationId: string, examinationId?: string): Promise<ResultPublication[]> {
    const response = await sisRequest<{ publications: ResultPublication[] }>(organizationId, '/results/publications' + query({ examinationId }));
    return response.publications;
  }

  async getStudentResult(organizationId: string, examinationId: string, studentId: string): Promise<StudentResult | null> {
    const response = await sisRequest<{ result: StudentResult | null }>(organizationId, '/results/students/' + studentId + query({ examinationId }));
    return response.result;
  }

  async getSubjectPerformance(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
    subjectId: string,
  ): Promise<SubjectPerformance | null> {
    const response = await sisRequest<{ performance: SubjectPerformance | null }>(organizationId, '/results/performance' + query({ examinationId, gradeId, sectionId, subjectId }));
    return response.performance;
  }

  async requestResultCorrection(
    organizationId: string,
    data: {
      examinationId: string;
      gradeId: string;
      sectionId: string;
      studentId: string;
      subjectId: string;
      newMarks: number;
      reason: string;
      requestedBy: string;
    },
  ): Promise<ResultCorrectionRequest> {
    const response = await sisRequest<{ correction: ResultCorrectionRequest }>(organizationId, '/results/corrections', {
      method: 'POST',
      ...jsonBody(data),
    });
    return response.correction;
  }

  async getResultCorrections(organizationId: string, examinationId?: string): Promise<ResultCorrectionRequest[]> {
    const response = await sisRequest<{ corrections: ResultCorrectionRequest[] }>(organizationId, '/results/corrections' + query({ examinationId }));
    return response.corrections;
  }

  async reviewResultCorrection(
    organizationId: string,
    correctionId: string,
    decision: 'approved' | 'rejected',
    comments?: string,
    actor?: ActorContext,
  ): Promise<ResultCorrectionRequest> {
    const response = await sisRequest<{ correction: ResultCorrectionRequest }>(organizationId, `/results/corrections/${correctionId}/review`, {
      method: 'POST',
      ...jsonBody({ decision, comments, userId: actor?.userId, role: actor?.role }),
    });
    return response.correction;
  }

  async getResultCard(organizationId: string, examinationId: string, studentId: string): Promise<StudentResultCard> {
    const response = await sisRequest<{ card: StudentResultCard }>(organizationId, `/results/cards/${studentId}` + query({ examinationId }));
    return response.card;
  }

  async getBatchResultCards(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
  ): Promise<StudentResultCard[]> {
    const response = await sisRequest<{ cards: StudentResultCard[] }>(organizationId, '/results/cards-batch' + query({ examinationId, gradeId, sectionId }));
    return response.cards;
  }

  async getExamResultRegister(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
  ): Promise<ExaminationResultRegister> {
    const response = await sisRequest<{ register: ExaminationResultRegister }>(organizationId, '/results/reports/register' + query({ examinationId, gradeId, sectionId }));
    return response.register;
  }

  async getMissingMarksReport(
    organizationId: string,
    examinationId: string,
    gradeId?: string,
    sectionId?: string,
  ): Promise<MissingMarksReportItem[]> {
    const response = await sisRequest<{ missingMarks: MissingMarksReportItem[] }>(organizationId, '/results/reports/missing-marks' + query({ examinationId, gradeId, sectionId }));
    return response.missingMarks;
  }
}

export const ExaminationService = new ExaminationServiceClass();
