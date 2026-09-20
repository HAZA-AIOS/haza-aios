import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicLandingPage } from "./PublicLandingPage";

describe("public platform experience", () => {
  it("presents three distinct HAZA products and the live SMS destination", () => {
    render(<PublicLandingPage />);
    for (const product of ["HAZA-AIOS", "HAZA-ME", "HAZA-SMS"]) {
      expect(screen.getByRole("article", { name: product })).toBeVisible();
    }
    expect(
      screen.getByText("One vision. Three intelligent products.", { exact: false }),
    ).toBeVisible();
    expect(screen.getByText(/HAZA-SMS is a standalone live application/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Visit HAZA-SMS/ })).toHaveAttribute(
      "href",
      "https://www.thementorschools.com",
    );
    expect(screen.getByRole("link", { name: /Visit HAZA-SMS/ })).toHaveAttribute(
      "rel",
      "noreferrer noopener",
    );
  });

  it("shows all three pricing cards without claiming billing is enabled", () => {
    render(<PublicLandingPage />);
    for (const name of ["Starter", "Professional", "Enterprise"]) {
      expect(screen.getByRole("article", { name: `${name} plan` })).toBeVisible();
      expect(screen.getByRole("link", { name: `Evaluate ${name}` })).toHaveAttribute(
        "href",
        "/register",
      );
    }
    for (const price of ["$15", "$40", "$90"]) expect(screen.getByText(price)).toBeVisible();
    expect(screen.getByText(/Billing is not enabled/)).toBeVisible();
  });
  it("provides real destinations for every public section link", () => {
    const { container } = render(<PublicLandingPage />);
    for (const link of container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      const id = link.getAttribute("href")!.slice(1);
      expect(id).not.toBe("");
      expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
    }
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    for (const heading of screen.getAllByRole("heading", { level: 2 })) {
      expect(heading.querySelector("svg")).not.toBeNull();
    }
  });

  it("uses the original brand asset and preserves auth destinations", () => {
    render(<PublicLandingPage />);
    for (const logo of screen.getAllByAltText("HAZA")) {
      expect(logo).toHaveAttribute("src", "/branding/haza-logo.png");
    }
    expect(screen.getByRole("link", { name: /Create an evaluation account/ })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getAllByRole("link", { name: /Sign in/ })[0]).toHaveAttribute("href", "/login");
  });

  it("opens mobile navigation and closes it after a section selection", () => {
    render(<PublicLandingPage />);
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", { name: "Mobile navigation" });
    fireEvent.click(menu.querySelector('a[href="#education"]')!);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
  });

  it("distinguishes implemented persistence from deferred AI capabilities", () => {
    render(<PublicLandingPage />);
    expect(screen.getByText("Agent execution currently uses a mock provider")).toBeVisible();
    expect(screen.getByText("Embeddings and semantic vector search")).toBeVisible();
    expect(screen.getByText("Durable workflow persistence and orchestration")).toBeVisible();
    expect(screen.getByRole("list", { name: "Platform architecture layers" })).toBeVisible();
    expect(screen.getByRole("list", { name: "School operations lifecycle" })).toBeVisible();
    expect(screen.getByRole("list", { name: "Authorized application data flow" })).toBeVisible();
  });
});
