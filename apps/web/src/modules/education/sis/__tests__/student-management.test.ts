import { describe, it, expect, beforeEach } from 'vitest';
import { StudentService } from '../student.service';
import { EnrollmentService } from '../enrollment.service';
import type { Student, StudentGuardian } from '../sis.types';

describe('Epic 10A: Student Management', () => {
  const TEST_ORG = 'org_test_123';
  const OTHER_ORG = 'org_other_456';

  beforeEach(() => {
    localStorage.clear();
  });

  const getMockGuardian = (): StudentGuardian => ({
    id: 'g1',
    firstName: 'John',
    lastName: 'Doe',
    relationship: 'father',
    email: 'john@example.com',
    phone: '555-0100',
    isEmergencyContact: true,
    isPrimaryContact: true
  });

  describe('StudentService', () => {
    it('creates a student and auto-generates admission number', async () => {
      const student = await StudentService.createStudent({
        organizationId: TEST_ORG,
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '2010-01-01',
        gender: 'female',
        admissionDate: '2026-08-01',
        status: 'active',
        guardians: [getMockGuardian()]
      });

      expect(student.id).toBeDefined();
      expect(student.admissionNumber).toMatch(/^TMS-\d{4}-\d{5}$/);
      expect(student.organizationId).toBe(TEST_ORG);
    });

    it('enforces organization isolation for retrieval', async () => {
      await StudentService.createStudent({
        organizationId: TEST_ORG,
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '2010-01-01',
        gender: 'female',
        admissionDate: '2026-08-01',
        status: 'active',
        guardians: [getMockGuardian()]
      });

      const testOrgStudents = await StudentService.getStudents(TEST_ORG);
      const otherOrgStudents = await StudentService.getStudents(OTHER_ORG);

      expect(testOrgStudents.length).toBe(1);
      expect(otherOrgStudents.length).toBe(0);
    });

    it('enforces unique admission number', async () => {
      await StudentService.createStudent({
        organizationId: TEST_ORG,
        firstName: 'Student 1',
        lastName: 'Test',
        dateOfBirth: '2010-01-01',
        gender: 'male',
        admissionDate: '2026-08-01',
        status: 'active',
        guardians: [],
        admissionNumber: 'TMS-TEST-1'
      });

      await expect(StudentService.createStudent({
        organizationId: TEST_ORG,
        firstName: 'Student 2',
        lastName: 'Test',
        dateOfBirth: '2010-01-01',
        gender: 'male',
        admissionDate: '2026-08-01',
        status: 'active',
        guardians: [],
        admissionNumber: 'TMS-TEST-1'
      })).rejects.toThrow();
    });
  });

  describe('EnrollmentService', () => {
    it('enrolls a student', async () => {
      const student = await StudentService.createStudent({
        organizationId: TEST_ORG,
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '2010-01-01',
        gender: 'female',
        admissionDate: '2026-08-01',
        status: 'active',
        guardians: [getMockGuardian()]
      });

      const enrollment = await EnrollmentService.enrollStudent({
        studentId: student.id,
        organizationId: TEST_ORG,
        academicYear: '2026-2027',
        gradeId: '10',
        sectionId: 'A',
        enrollmentDate: '2026-08-01',
        status: 'active'
      });

      expect(enrollment.id).toBeDefined();
      expect(enrollment.academicYear).toBe('2026-2027');
    });

    it('prevents duplicate active enrollment in same year', async () => {
      const student = await StudentService.createStudent({
        organizationId: TEST_ORG,
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '2010-01-01',
        gender: 'female',
        admissionDate: '2026-08-01',
        status: 'active',
        guardians: [getMockGuardian()]
      });

      await EnrollmentService.enrollStudent({
        studentId: student.id,
        organizationId: TEST_ORG,
        academicYear: '2026-2027',
        gradeId: '10',
        sectionId: 'A',
        enrollmentDate: '2026-08-01',
        status: 'active'
      });

      await expect(EnrollmentService.enrollStudent({
        studentId: student.id,
        organizationId: TEST_ORG,
        academicYear: '2026-2027',
        gradeId: '10',
        sectionId: 'B',
        enrollmentDate: '2026-08-02',
        status: 'active'
      })).rejects.toThrow();
    });

    it('transfers a student successfully', async () => {
       const student = await StudentService.createStudent({
        organizationId: TEST_ORG,
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '2010-01-01',
        gender: 'female',
        admissionDate: '2026-08-01',
        status: 'active',
        guardians: [getMockGuardian()]
      });

      const e1 = await EnrollmentService.enrollStudent({
        studentId: student.id,
        organizationId: TEST_ORG,
        academicYear: '2026-2027',
        gradeId: '10',
        sectionId: 'A',
        enrollmentDate: '2026-08-01',
        status: 'active'
      });

      const newEnrollment = await EnrollmentService.transferStudent(student.id, TEST_ORG, 'B');

      expect(newEnrollment.sectionId).toBe('B');
      
      const enrollments = await EnrollmentService.getEnrollmentsByStudent(student.id, TEST_ORG);
      expect(enrollments.length).toBe(2);
      expect(enrollments.find(e => e.id === e1.id)?.status).toBe('transferred');
      expect(enrollments.find(e => e.id === newEnrollment.id)?.status).toBe('active');
    });
  });
});
