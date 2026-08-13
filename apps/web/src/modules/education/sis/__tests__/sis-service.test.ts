import { describe, it, expect, beforeEach } from "vitest";
import { SisService } from "../sis-service";

describe("SIS Service", () => {
  beforeEach(() => {
    SisService.resetToDefaults();
  });

  it("should retrieve default school for seed org", async () => {
    const school = await SisService.getSchoolByOrg("org-mentor-school");
    expect(school).toBeDefined();
    expect(school?.name).toBe("The Mentor School");
  });

  it("should strictly isolate students by organization", async () => {
    const org1 = "org-1";
    const org2 = "org-2";
    
    const school1 = await SisService.createSchool({
      organizationId: org1,
      name: "School 1",
      code: "S1",
      timezone: "UTC",
      status: "active"
    });

    const school2 = await SisService.createSchool({
      organizationId: org2,
      name: "School 2",
      code: "S2",
      timezone: "UTC",
      status: "active"
    });

    await SisService.createStudent({
      organizationId: org1,
      schoolId: school1.id,
      admissionNumber: "A1",
      firstName: "John",
      lastName: "Doe",
      displayName: "John Doe",
      admissionDate: "2026-09-01",
      status: "active"
    });

    await SisService.createStudent({
      organizationId: org2,
      schoolId: school2.id,
      admissionNumber: "A2",
      firstName: "Jane",
      lastName: "Smith",
      displayName: "Jane Smith",
      admissionDate: "2026-09-01",
      status: "active"
    });

    const org1Students = await SisService.getStudents(org1);
    const org2Students = await SisService.getStudents(org2);

    expect(org1Students.length).toBe(1);
    expect(org1Students[0].organizationId).toBe(org1);

    expect(org2Students.length).toBe(1);
    expect(org2Students[0].organizationId).toBe(org2);
  });

  it("should handle current academic year logic", async () => {
    const school = await SisService.createSchool({
      organizationId: "test-org",
      name: "Test School",
      code: "TS",
      timezone: "UTC",
      status: "active"
    });

    await SisService.createAcademicYear({
      organizationId: "test-org",
      schoolId: school.id,
      name: "2025-2026",
      startDate: "2025-09-01",
      endDate: "2026-06-30",
      status: "active",
      isCurrent: true
    });

    // Create a new current year, should demote the old one
    await SisService.createAcademicYear({
      organizationId: "test-org",
      schoolId: school.id,
      name: "2026-2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      status: "active",
      isCurrent: true
    });

    const years = await SisService.getAcademicYears(school.id);
    expect(years.length).toBe(2);
    
    const currentYear = years.find(y => y.isCurrent);
    expect(currentYear?.name).toBe("2026-2027");

    const previousYear = years.find(y => y.name === "2025-2026");
    expect(previousYear?.isCurrent).toBe(false);
  });
});
