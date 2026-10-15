import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AuthContext } from "@/auth/AuthProvider";
import { OrgContext } from "@/org/OrgContext";
import { AttendanceHistoryPage } from "../AttendanceHistoryPage";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { AttendanceService } from "@/modules/education/sis/attendance.service";

vi.mock("@/modules/education/sis/academic.service");
vi.mock("@/modules/education/sis/attendance.service");

const mockUser = {
  id: "user-1",
  firstName: "Teacher",
  lastName: "One",
  displayName: "Teacher One",
  email: "teacher@test.com",
  emailVerified: true,
  status: "active" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAuthContextValue = {
  status: "authenticated" as const,
  user: mockUser,
  session: null,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  forgotPassword: async () => {},
  resetPassword: async () => {},
  verifyEmail: async () => {},
  clearError: () => {},
};

const mockOrg = {
  id: "org-1",
  name: "Test Academy",
  legalName: "Test Academy Inc.",
  slug: "test-academy",
  industry: "Education",
  organizationType: "School",
  email: "contact@test.edu",
  country: "United States",
  timezone: "America/New_York",
  currency: "USD",
  status: "active" as const,
  ownerId: "user-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMembership = {
  id: "membership-1",
  organizationId: "org-1",
  userId: "user-1",
  role: "Admin" as const,
  status: "active" as const,
  joinedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderPage() {
  const orgContextValue = {
    currentOrganization: mockOrg,
    currentMembership: mockMembership,
    organizations: [mockOrg],
    isLoading: false,
    error: null,
    createOrg: async () => ({ organization: {} as never, membership: {} as never }),
    switchOrg: async () => {},
    refresh: async () => {},
  };

  return render(
    React.createElement(
      AuthContext.Provider,
      { value: mockAuthContextValue },
      React.createElement(OrgContext.Provider, { value: orgContextValue }, React.createElement(AttendanceHistoryPage))
    )
  );
}

describe("AttendanceHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(AcademicService.getAcademicYears).mockResolvedValue([
      { id: "year-1", organizationId: "org-1", name: "2026-2027", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getGrades).mockResolvedValue([
      { id: "grade-1", organizationId: "org-1", name: "Grade 5", level: 5, order: 5, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getSections).mockResolvedValue([
      { id: "section-1", organizationId: "org-1", gradeId: "grade-1", name: "Section A", capacity: 30, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AttendanceService.getSessions).mockResolvedValue([
      {
        id: "sess-1",
        organizationId: "org-1",
        academicYearId: "year-1",
        date: "2026-03-10",
        gradeId: "grade-1",
        sectionId: "section-1",
        sessionType: "daily",
        status: "completed",
        createdAt: "now",
        updatedAt: "now",
      },
      {
        id: "sess-2",
        organizationId: "org-1",
        academicYearId: "year-1",
        date: "2026-03-11",
        gradeId: "grade-1",
        sectionId: "section-1",
        sessionType: "daily",
        status: "draft",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);
  });

  it("renders history metrics and sessions list", async () => {
    renderPage();
    expect(await screen.findByText("Attendance History")).toBeDefined();
    expect(await screen.findByText("Total Sessions")).toBeDefined();
    expect(await screen.findByText("Completed Sessions")).toBeDefined();
    expect(await screen.findByText("Draft Sessions")).toBeDefined();

    // Table rows
    expect((await screen.findAllByText("Grade 5")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("— Section Section A")).length).toBe(2);
    expect(screen.getAllByText("View / Edit")).toHaveLength(2);
  });

  it("filters sessions by status", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("Filter by status")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Filter by status"), { target: { value: "draft" } });
    expect(screen.getAllByText("View / Edit")).toHaveLength(1);
  });
});
