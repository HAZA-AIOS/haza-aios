import { AcademicServiceClass } from '../academic.service';

describe('AcademicService', () => {
  let service: AcademicServiceClass;
  const mockOrgId = 'org-123';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    service = new AcademicServiceClass();
  });

  describe('Academic Years', () => {
    it('should create an academic year', async () => {
      const year = await service.createAcademicYear(mockOrgId, {
        name: '2026-2027',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        status: 'planned'
      });

      expect(year.id).toBeDefined();
      expect(year.name).toBe('2026-2027');
      expect(year.organizationId).toBe(mockOrgId);
      
      const years = await service.getAcademicYears(mockOrgId);
      expect(years).toHaveLength(1);
    });

    it('should prevent overlapping active years', async () => {
      await service.createAcademicYear(mockOrgId, {
        name: 'Year 1',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        status: 'active'
      });

      await expect(service.createAcademicYear(mockOrgId, {
        name: 'Year 2',
        startDate: '2027-09-01',
        endDate: '2028-06-30',
        status: 'active'
      })).rejects.toThrow(/An active academic year already exists/);
    });

    it('should validate dates', async () => {
      await expect(service.createAcademicYear(mockOrgId, {
        name: 'Invalid Year',
        startDate: '2027-09-01',
        endDate: '2026-06-30', // End before start
        status: 'planned'
      })).rejects.toThrow(/Start date must be before end date/);
    });
  });

  describe('Terms', () => {
    it('should create a term without overlap', async () => {
      const year = await service.createAcademicYear(mockOrgId, {
        name: '2026-2027',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        status: 'planned'
      });

      const term = await service.createTerm(mockOrgId, {
        academicYearId: year.id,
        name: 'Fall Term',
        startDate: '2026-09-01',
        endDate: '2026-12-15',
        status: 'planned'
      });

      expect(term.id).toBeDefined();
    });

    it('should prevent term date overlap in the same year', async () => {
      const year = await service.createAcademicYear(mockOrgId, {
        name: '2026-2027',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        status: 'planned'
      });

      await service.createTerm(mockOrgId, {
        academicYearId: year.id,
        name: 'Fall Term',
        startDate: '2026-09-01',
        endDate: '2026-12-15',
        status: 'planned'
      });

      await expect(service.createTerm(mockOrgId, {
        academicYearId: year.id,
        name: 'Winter Term',
        startDate: '2026-12-01', // Overlaps with Fall
        endDate: '2027-03-15',
        status: 'planned'
      })).rejects.toThrow(/Term dates overlap/);
    });
  });

  describe('Subjects', () => {
    it('should prevent duplicate subject codes', async () => {
      await service.createSubject(mockOrgId, {
        name: 'Mathematics',
        code: 'MATH101',
        status: 'active',
        displayOrder: 1
      });

      await expect(service.createSubject(mockOrgId, {
        name: 'Advanced Math',
        code: 'MATH101',
        status: 'active',
        displayOrder: 2
      })).rejects.toThrow(/Subject code must be unique/);
    });
  });
});
