import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  navigate: vi.fn(),
  status: "unauthenticated",
  error: null as null | { message: string },
}));
vi.mock("@/auth/use-auth", () => ({ useAuth: () => mocks }));
vi.mock("@/routes/navigation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  navigate: mocks.navigate,
}));

describe("branded login", () => {
  beforeEach(() => {
    mocks.login.mockReset().mockResolvedValue(undefined);
    mocks.navigate.mockReset();
    mocks.status = "unauthenticated";
    mocks.error = null;
  });

  it("passes the existing credentials and remember-me setting to the unchanged auth contract", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "owner@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "example-password" } });
    fireEvent.click(screen.getByLabelText("Remember me"));
    fireEvent.click(screen.getByRole("button", { name: "Sign in", exact: true }));
    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith({
        email: "owner@example.test",
        password: "example-password",
        rememberMe: false,
      }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/app");
  });

  it("preserves password visibility and recovery/account destinations", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("keeps the pending and error states visible", () => {
    mocks.status = "loading";
    mocks.error = { message: "Unable to sign in" };
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
    expect(screen.getByText("Unable to sign in")).toBeVisible();
  });
});
