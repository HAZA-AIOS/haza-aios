import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock attendance page components
vi.mock("@/pages/workspace/education/attendance/AttendanceOverviewPage", () => ({
  AttendanceOverviewPage: () => <div data-testid="attendance-overview-page">Attendance Overview Content</div>,
}));
vi.mock("@/pages/workspace/education/attendance/MarkAttendancePage", () => ({
  MarkAttendancePage: () => <div data-testid="mark-attendance-page">Mark Attendance Content</div>,
}));
vi.mock("@/pages/workspace/education/attendance/AttendanceHistoryPage", () => ({
  AttendanceHistoryPage: () => <div data-testid="attendance-history-page">Attendance History Content</div>,
}));

// Mock guards
vi.mock("@/workspace/WorkspaceGuard", () => ({
  WorkspaceGuard: ({ children }: { children: React.ReactNode }) => <div data-testid="workspace-guard">{children}</div>,
}));

let mockAuthStatus: "authenticated" | "unauthenticated" | "loading" = "authenticated";
vi.mock("@/auth/use-auth", () => ({
  useAuth: () => ({
    status: mockAuthStatus,
    user: mockAuthStatus === "authenticated" ? { id: "u-1", email: "test@alhaza.edu" } : null,
  }),
}));

import App from "@/App";
import { navigate } from "../navigation";

describe("UX-001: Attendance Route Consolidation & Backward Compatibility", () => {
  beforeEach(() => {
    mockAuthStatus = "authenticated";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves canonical /workspace/education/attendance correctly", async () => {
    window.history.pushState({}, "", "/workspace/education/attendance");
    render(<App />);

    expect(screen.getByTestId("workspace-guard")).toBeDefined();
    expect(screen.getByTestId("attendance-overview-page")).toBeDefined();
    expect(screen.getByText("Attendance Overview Content")).toBeDefined();
  });

  it("resolves canonical /workspace/education/attendance/mark correctly", async () => {
    window.history.pushState({}, "", "/workspace/education/attendance/mark");
    render(<App />);

    expect(screen.getByTestId("workspace-guard")).toBeDefined();
    expect(screen.getByTestId("mark-attendance-page")).toBeDefined();
    expect(screen.getByText("Mark Attendance Content")).toBeDefined();
  });

  it("resolves canonical /workspace/education/attendance/history correctly", async () => {
    window.history.pushState({}, "", "/workspace/education/attendance/history");
    render(<App />);

    expect(screen.getByTestId("workspace-guard")).toBeDefined();
    expect(screen.getByTestId("attendance-history-page")).toBeDefined();
    expect(screen.getByText("Attendance History Content")).toBeDefined();
  });

  it("redirects legacy shortcut /attendance to canonical /workspace/education/attendance", async () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    window.history.pushState({}, "", "/attendance");
    render(<App />);

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith({}, "", "/workspace/education/attendance");
    });
  });

  it("redirects legacy /attendance/mark with query parameters preserved (e.g. ?sessionId=sess-123)", async () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    window.history.pushState({}, "", "/attendance/mark?sessionId=sess-123");
    render(<App />);

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith({}, "", "/workspace/education/attendance/mark?sessionId=sess-123");
    });
  });

  it("redirects legacy /attendance/history to canonical destination", async () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    window.history.pushState({}, "", "/attendance/history");
    render(<App />);

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith({}, "", "/workspace/education/attendance/history");
    });
  });

  it("redirects /workspace/attendance alias to canonical /workspace/education/attendance", async () => {
    const pushSpy = vi.spyOn(window.history, "pushState");
    window.history.pushState({}, "", "/workspace/attendance");
    render(<App />);

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith({}, "", "/workspace/education/attendance");
    });
  });

  it("enforces authentication on attendance routes (redirecting unauthenticated users)", async () => {
    mockAuthStatus = "unauthenticated";
    const pushSpy = vi.spyOn(window.history, "pushState");
    window.history.pushState({}, "", "/workspace/education/attendance");
    render(<App />);

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith(expect.anything(), "", "/login");
    });
  });
});
