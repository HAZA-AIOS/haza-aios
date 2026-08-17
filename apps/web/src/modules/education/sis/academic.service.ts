import type { AcademicYear, Term, Grade, Section, Subject, ClassSubject } from "./sis.types";

const SIS_ACADEMIC_YEARS_KEY = "haza-aios.sis.academic-years";
const SIS_TERMS_KEY = "haza-aios.sis.terms";
const SIS_GRADES_KEY = "haza-aios.sis.grades";
const SIS_SECTIONS_KEY = "haza-aios.sis.sections";
const SIS_SUBJECTS_KEY = "haza-aios.sis.subjects";
const SIS_CLASS_SUBJECTS_KEY = "haza-aios.sis.class-subjects";

export class AcademicServiceClass {
  // --- Academic Years ---
  private getAcademicYearsDb(): AcademicYear[] {
    const data = localStorage.getItem(SIS_ACADEMIC_YEARS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveAcademicYearsDb(years: AcademicYear[]): void {
    localStorage.setItem(SIS_ACADEMIC_YEARS_KEY, JSON.stringify(years));
  }

  async getAcademicYears(organizationId: string): Promise<AcademicYear[]> {
    return this.getAcademicYearsDb().filter(y => y.organizationId === organizationId).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }

  async getActiveAcademicYear(organizationId: string): Promise<AcademicYear | null> {
    const years = await this.getAcademicYears(organizationId);
    return years.find(y => y.status === "active") || null;
  }

  async createAcademicYear(organizationId: string, data: Omit<AcademicYear, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<AcademicYear> {
    const years = this.getAcademicYearsDb();
    
    // Validate dates
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new Error("Start date must be before end date.");
    }
    
    // Prevent duplicate active years
    if (data.status === "active") {
      const existingActive = years.find(y => y.organizationId === organizationId && y.status === "active");
      if (existingActive) throw new Error("An active academic year already exists. Please deactivate it first.");
    }

    const newYear: AcademicYear = {
      ...data,
      id: `ay-${Date.now()}`,
      organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    years.push(newYear);
    this.saveAcademicYearsDb(years);
    return newYear;
  }

  async updateAcademicYear(id: string, organizationId: string, data: Partial<AcademicYear>): Promise<AcademicYear> {
    const years = this.getAcademicYearsDb();
    const index = years.findIndex(y => y.id === id && y.organizationId === organizationId);
    if (index === -1) throw new Error("Academic Year not found");

    const current = years[index];
    
    if (data.startDate && data.endDate && new Date(data.startDate) >= new Date(data.endDate)) {
      throw new Error("Start date must be before end date.");
    }
    
    if (data.status === "active" && current.status !== "active") {
       const existingActive = years.find(y => y.organizationId === organizationId && y.status === "active" && y.id !== id);
       if (existingActive) throw new Error("An active academic year already exists. Please deactivate it first.");
    }

    years[index] = { ...current, ...data, updatedAt: new Date().toISOString() };
    this.saveAcademicYearsDb(years);
    return years[index];
  }

  // --- Terms ---
  private getTermsDb(): Term[] {
    const data = localStorage.getItem(SIS_TERMS_KEY);
    return data ? JSON.parse(data) : [];
  }
  
  private saveTermsDb(terms: Term[]): void {
    localStorage.setItem(SIS_TERMS_KEY, JSON.stringify(terms));
  }

  async getTerms(organizationId: string, academicYearId?: string): Promise<Term[]> {
    let terms = this.getTermsDb().filter(t => t.organizationId === organizationId);
    if (academicYearId) {
      terms = terms.filter(t => t.academicYearId === academicYearId);
    }
    return terms.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  async createTerm(organizationId: string, data: Omit<Term, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<Term> {
    const terms = this.getTermsDb();
    
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new Error("Start date must be before end date.");
    }
    
    // Overlap validation
    const yearTerms = terms.filter(t => t.academicYearId === data.academicYearId);
    for (const t of yearTerms) {
      if ((new Date(data.startDate) <= new Date(t.endDate)) && (new Date(data.endDate) >= new Date(t.startDate))) {
        throw new Error("Term dates overlap with existing term: " + t.name);
      }
    }

    const newTerm: Term = {
      ...data,
      id: `term-${Date.now()}`,
      organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    terms.push(newTerm);
    this.saveTermsDb(terms);
    return newTerm;
  }
  
  async updateTerm(id: string, organizationId: string, data: Partial<Term>): Promise<Term> {
    const terms = this.getTermsDb();
    const index = terms.findIndex(t => t.id === id && t.organizationId === organizationId);
    if (index === -1) throw new Error("Term not found");

    terms[index] = { ...terms[index], ...data, updatedAt: new Date().toISOString() };
    this.saveTermsDb(terms);
    return terms[index];
  }

  // --- Grades / Classes ---
  private getGradesDb(): Grade[] {
    const data = localStorage.getItem(SIS_GRADES_KEY);
    return data ? JSON.parse(data) : [];
  }
  
  private saveGradesDb(grades: Grade[]): void {
    localStorage.setItem(SIS_GRADES_KEY, JSON.stringify(grades));
  }

  async getGrades(organizationId: string): Promise<Grade[]> {
    return this.getGradesDb().filter(g => g.organizationId === organizationId).sort((a, b) => a.order - b.order);
  }

  async getGrade(id: string, organizationId: string): Promise<Grade | null> {
    return this.getGradesDb().find(g => g.id === id && g.organizationId === organizationId) || null;
  }

  async createGrade(organizationId: string, data: Omit<Grade, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<Grade> {
    const grades = this.getGradesDb();
    const newGrade: Grade = {
      ...data,
      id: `grade-${Date.now()}`,
      organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    grades.push(newGrade);
    this.saveGradesDb(grades);
    return newGrade;
  }
  
  async updateGrade(id: string, organizationId: string, data: Partial<Grade>): Promise<Grade> {
    const grades = this.getGradesDb();
    const index = grades.findIndex(g => g.id === id && g.organizationId === organizationId);
    if (index === -1) throw new Error("Grade not found");

    grades[index] = { ...grades[index], ...data, updatedAt: new Date().toISOString() };
    this.saveGradesDb(grades);
    return grades[index];
  }

  // --- Sections ---
  private getSectionsDb(): Section[] {
    const data = localStorage.getItem(SIS_SECTIONS_KEY);
    return data ? JSON.parse(data) : [];
  }
  
  private saveSectionsDb(sections: Section[]): void {
    localStorage.setItem(SIS_SECTIONS_KEY, JSON.stringify(sections));
  }

  async getSections(organizationId: string, gradeId?: string): Promise<Section[]> {
    let sections = this.getSectionsDb().filter(s => s.organizationId === organizationId);
    if (gradeId) sections = sections.filter(s => s.gradeId === gradeId);
    return sections.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSection(id: string, organizationId: string): Promise<Section | null> {
    return this.getSectionsDb().find(s => s.id === id && s.organizationId === organizationId) || null;
  }

  async createSection(organizationId: string, data: Omit<Section, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<Section> {
    const sections = this.getSectionsDb();
    
    const existing = sections.find(s => s.gradeId === data.gradeId && s.name === data.name);
    if (existing) throw new Error("Section name already exists in this grade");
    
    const newSection: Section = {
      ...data,
      id: `sec-${Date.now()}`,
      organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sections.push(newSection);
    this.saveSectionsDb(sections);
    return newSection;
  }

  async updateSection(id: string, organizationId: string, data: Partial<Section>): Promise<Section> {
    const sections = this.getSectionsDb();
    const index = sections.findIndex(s => s.id === id && s.organizationId === organizationId);
    if (index === -1) throw new Error("Section not found");

    sections[index] = { ...sections[index], ...data, updatedAt: new Date().toISOString() };
    this.saveSectionsDb(sections);
    return sections[index];
  }

  // --- Subjects ---
  private getSubjectsDb(): Subject[] {
    const data = localStorage.getItem(SIS_SUBJECTS_KEY);
    return data ? JSON.parse(data) : [];
  }
  
  private saveSubjectsDb(subjects: Subject[]): void {
    localStorage.setItem(SIS_SUBJECTS_KEY, JSON.stringify(subjects));
  }

  async getSubjects(organizationId: string): Promise<Subject[]> {
    return this.getSubjectsDb().filter(s => s.organizationId === organizationId).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async createSubject(organizationId: string, data: Omit<Subject, "id" | "organizationId" | "createdAt" | "updatedAt">): Promise<Subject> {
    const subjects = this.getSubjectsDb();
    
    if (data.code && subjects.some(s => s.organizationId === organizationId && s.code === data.code)) {
       throw new Error("Subject code must be unique within organization.");
    }
    
    const newSubject: Subject = {
      ...data,
      id: `sub-${Date.now()}`,
      organizationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    subjects.push(newSubject);
    this.saveSubjectsDb(subjects);
    return newSubject;
  }

  async updateSubject(id: string, organizationId: string, data: Partial<Subject>): Promise<Subject> {
    const subjects = this.getSubjectsDb();
    const index = subjects.findIndex(s => s.id === id && s.organizationId === organizationId);
    if (index === -1) throw new Error("Subject not found");

    if (data.code && data.code !== subjects[index].code && subjects.some(s => s.organizationId === organizationId && s.code === data.code)) {
      throw new Error("Subject code must be unique within organization.");
    }

    subjects[index] = { ...subjects[index], ...data, updatedAt: new Date().toISOString() };
    this.saveSubjectsDb(subjects);
    return subjects[index];
  }

  // --- Class-Subject Assignments ---
  private getClassSubjectsDb(): ClassSubject[] {
    const data = localStorage.getItem(SIS_CLASS_SUBJECTS_KEY);
    return data ? JSON.parse(data) : [];
  }
  
  private saveClassSubjectsDb(assignments: ClassSubject[]): void {
    localStorage.setItem(SIS_CLASS_SUBJECTS_KEY, JSON.stringify(assignments));
  }

  async getClassSubjects(gradeId: string): Promise<string[]> {
    return this.getClassSubjectsDb().filter(a => a.gradeId === gradeId).map(a => a.subjectId);
  }

  async assignSubjectToClass(gradeId: string, subjectId: string): Promise<void> {
    const assignments = this.getClassSubjectsDb();
    if (!assignments.some(a => a.gradeId === gradeId && a.subjectId === subjectId)) {
      assignments.push({ gradeId, subjectId });
      this.saveClassSubjectsDb(assignments);
    }
  }

  async removeSubjectFromClass(gradeId: string, subjectId: string): Promise<void> {
    let assignments = this.getClassSubjectsDb();
    assignments = assignments.filter(a => !(a.gradeId === gradeId && a.subjectId === subjectId));
    this.saveClassSubjectsDb(assignments);
  }
}

export const AcademicService = new AcademicServiceClass();
