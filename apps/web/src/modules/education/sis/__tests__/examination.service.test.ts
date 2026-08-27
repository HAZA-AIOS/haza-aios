import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExaminationService } from '../examination.service';
import { sisRequest } from '../sis-api';

vi.mock('../sis-api', () => ({
  jsonBody: (value: unknown) => ({ body: JSON.stringify(value) }),
  sisRequest: vi.fn(),
}));

const mockedSisRequest = vi.mocked(sisRequest);

describe('DB-7 ExaminationService API adapter', () => {
  beforeEach(() => {
    mockedSisRequest.mockReset();
  });

  it('lists and creates examinations through SIS API routes', async () => {
    mockedSisRequest
      .mockResolvedValueOnce({ examinations: [{ id: 'exam-1', organizationId: 'org-1', name: 'Mid Term', academicYearId: 'year-1', type: 'mid_term', startDate: '2026-10-01', endDate: '2026-10-10', status: 'scheduled', createdAt: 'now', updatedAt: 'now' }] })
      .mockResolvedValueOnce({ examination: { id: 'exam-2', organizationId: 'org-1', name: 'Annual', academicYearId: 'year-1', type: 'annual', startDate: '2027-03-01', endDate: '2027-03-20', status: 'draft', createdAt: 'now', updatedAt: 'now' } });

    await expect(ExaminationService.getExaminations('org-1')).resolves.toHaveLength(1);
    await expect(ExaminationService.createExamination('org-1', { name: 'Annual', academicYearId: 'year-1', type: 'annual', startDate: '2027-03-01', endDate: '2027-03-20', status: 'draft' })).resolves.toMatchObject({ id: 'exam-2' });

    expect(mockedSisRequest).toHaveBeenNthCalledWith(1, 'org-1', '/examinations');
    expect(mockedSisRequest).toHaveBeenNthCalledWith(2, 'org-1', '/examinations', expect.objectContaining({ method: 'POST' }));
  });

  it('enters marks, calculates results, publishes, and reads student results through API routes', async () => {
    mockedSisRequest
      .mockResolvedValueOnce({ mark: { id: 'mark-1', organizationId: 'org-1', sourceType: 'examination', sourceId: 'exam-1', academicYearId: 'year-1', gradeId: 'grade-1', sectionId: 'section-1', subjectId: 'subject-1', studentId: 'student-1', maximumMarks: 100, obtainedMarks: 88, percentage: 88, grade: 'A', enteredBy: 'teacher-1', createdAt: 'now', updatedAt: 'now' } })
      .mockResolvedValueOnce({ results: [{ studentId: 'student-1', maximumMarks: 100, obtainedMarks: 88, percentage: 88, grade: 'A', passed: true, subjects: [] }] })
      .mockResolvedValueOnce({ publication: { id: 'result-1', organizationId: 'org-1', examinationId: 'exam-1', academicYearId: 'year-1', gradeId: 'grade-1', sectionId: 'section-1', status: 'published', results: [], createdAt: 'now', updatedAt: 'now' } })
      .mockResolvedValueOnce({ result: { studentId: 'student-1', maximumMarks: 100, obtainedMarks: 88, percentage: 88, grade: 'A', passed: true, subjects: [] } });

    await ExaminationService.enterMark('org-1', { sourceType: 'examination', sourceId: 'exam-1', examinationSubjectId: 'exam-subject-1', studentId: 'student-1', obtainedMarks: 88, enteredBy: 'teacher-1' });
    await ExaminationService.calculateClassResults('org-1', 'exam-1', 'grade-1', 'section-1');
    await ExaminationService.publishResults('org-1', 'exam-1', 'grade-1', 'section-1', { userId: 'owner-1', role: 'Owner' });
    await ExaminationService.getStudentResult('org-1', 'exam-1', 'student-1');

    expect(mockedSisRequest).toHaveBeenNthCalledWith(1, 'org-1', '/marks', expect.objectContaining({ method: 'POST' }));
    expect(mockedSisRequest).toHaveBeenNthCalledWith(2, 'org-1', '/results/calculate?examinationId=exam-1&gradeId=grade-1&sectionId=section-1');
    expect(mockedSisRequest).toHaveBeenNthCalledWith(3, 'org-1', '/results/publish', expect.objectContaining({ method: 'POST' }));
    expect(mockedSisRequest).toHaveBeenNthCalledWith(4, 'org-1', '/results/students/student-1?examinationId=exam-1');
  });
});
