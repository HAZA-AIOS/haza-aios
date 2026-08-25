import type { AcademicYear, Term, Grade, Section, Subject } from "./sis.types";
import { jsonBody, sisRequest } from "./sis-api";

export class AcademicServiceClass {
  async getAcademicYears(organizationId: string): Promise<AcademicYear[]> {
    const body = await sisRequest<{ academicYears: AcademicYear[] }>(organizationId, "/academic-years");
    return body.academicYears;
  }

  async getActiveAcademicYear(organizationId: string): Promise<AcademicYear | null> {
    const years = await this.getAcademicYears(organizationId);
    return years.find((year) => year.status === "active") || null;
  }

  async createAcademicYear(organizationId: string, data: Omit<AcademicYear, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<AcademicYear> {
    const body = await sisRequest<{ academicYear: AcademicYear }>(organizationId, "/academic-years", { method: "POST", ...jsonBody(data) });
    return body.academicYear;
  }

  async updateAcademicYear(id: string, organizationId: string, data: Partial<AcademicYear>): Promise<AcademicYear> {
    const body = await sisRequest<{ academicYear: AcademicYear }>(organizationId, `/academic-years/${id}`, { method: "PATCH", ...jsonBody(data) });
    return body.academicYear;
  }

  async getTerms(organizationId: string, academicYearId?: string): Promise<Term[]> {
    const query = academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : "";
    const body = await sisRequest<{ terms: Term[] }>(organizationId, `/terms${query}`);
    return body.terms;
  }

  async createTerm(organizationId: string, data: Omit<Term, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<Term> {
    const body = await sisRequest<{ term: Term }>(organizationId, "/terms", { method: "POST", ...jsonBody(data) });
    return body.term;
  }

  async updateTerm(id: string, organizationId: string, data: Partial<Term>): Promise<Term> {
    const body = await sisRequest<{ term: Term }>(organizationId, `/terms/${id}`, { method: "PATCH", ...jsonBody(data) });
    return body.term;
  }

  async getGrades(organizationId: string): Promise<Grade[]> {
    const body = await sisRequest<{ grades: Grade[] }>(organizationId, "/grades");
    return body.grades;
  }

  async getGrade(id: string, organizationId: string): Promise<Grade | null> {
    const body = await sisRequest<{ grade: Grade | null }>(organizationId, `/grades/${id}`);
    return body.grade;
  }

  async createGrade(organizationId: string, data: Omit<Grade, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<Grade> {
    const body = await sisRequest<{ grade: Grade }>(organizationId, "/grades", { method: "POST", ...jsonBody(data) });
    return body.grade;
  }

  async updateGrade(id: string, organizationId: string, data: Partial<Grade>): Promise<Grade> {
    const body = await sisRequest<{ grade: Grade }>(organizationId, `/grades/${id}`, { method: "PATCH", ...jsonBody(data) });
    return body.grade;
  }

  async getSections(organizationId: string, gradeId?: string): Promise<Section[]> {
    const query = gradeId ? `?gradeId=${encodeURIComponent(gradeId)}` : "";
    const body = await sisRequest<{ sections: Section[] }>(organizationId, `/sections${query}`);
    return body.sections;
  }

  async getSection(id: string, organizationId: string): Promise<Section | null> {
    const body = await sisRequest<{ section: Section | null }>(organizationId, `/sections/${id}`);
    return body.section;
  }

  async createSection(organizationId: string, data: Omit<Section, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<Section> {
    const body = await sisRequest<{ section: Section }>(organizationId, "/sections", { method: "POST", ...jsonBody(data) });
    return body.section;
  }

  async updateSection(id: string, organizationId: string, data: Partial<Section>): Promise<Section> {
    const body = await sisRequest<{ section: Section }>(organizationId, `/sections/${id}`, { method: "PATCH", ...jsonBody(data) });
    return body.section;
  }

  async getSubjects(organizationId: string): Promise<Subject[]> {
    const body = await sisRequest<{ subjects: Subject[] }>(organizationId, "/subjects");
    return body.subjects;
  }

  async createSubject(organizationId: string, data: Omit<Subject, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<Subject> {
    const body = await sisRequest<{ subject: Subject }>(organizationId, "/subjects", { method: "POST", ...jsonBody(data) });
    return body.subject;
  }

  async updateSubject(id: string, organizationId: string, data: Partial<Subject>): Promise<Subject> {
    const body = await sisRequest<{ subject: Subject }>(organizationId, `/subjects/${id}`, { method: "PATCH", ...jsonBody(data) });
    return body.subject;
  }

  async getClassSubjects(organizationId: string, gradeId: string): Promise<string[]> {
    const body = await sisRequest<{ subjectIds: string[] }>(organizationId, `/grades/${gradeId}/subjects`);
    return body.subjectIds;
  }

  async assignSubjectToClass(organizationId: string, gradeId: string, subjectId: string): Promise<void> {
    await sisRequest<{ ok: boolean }>(organizationId, `/grades/${gradeId}/subjects/${subjectId}`, { method: "POST" });
  }

  async removeSubjectFromClass(organizationId: string, gradeId: string, subjectId: string): Promise<void> {
    await sisRequest<{ ok: boolean }>(organizationId, `/grades/${gradeId}/subjects/${subjectId}`, { method: "DELETE" });
  }
}

export const AcademicService = new AcademicServiceClass();
