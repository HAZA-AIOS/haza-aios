import { describe, expect, it } from "vitest";
import { generateSlug, validateOrganization } from "../org-validation";

describe("org-validation", () => {
  describe("validateOrganization", () => {
    it("returns no errors for a valid input", () => {
      const result = validateOrganization({
        name: "My Academy",
        organizationType: "School",
        industry: "Education",
        email: "contact@myacademy.edu",
        country: "United States",
      });
      expect(Object.keys(result)).toHaveLength(0);
    });

    it("errors on short or missing organization name", () => {
      const result = validateOrganization({
        name: "A",
        organizationType: "School",
        industry: "Education",
        email: "contact@myacademy.edu",
        country: "United States",
      });
      expect(result.name).toBeDefined();
    });

    it("errors on missing organization type", () => {
      const result = validateOrganization({
        name: "My Academy",
        organizationType: "",
        industry: "Education",
        email: "contact@myacademy.edu",
        country: "United States",
      });
      expect(result.organizationType).toBeDefined();
    });

    it("errors on invalid email format", () => {
      const result = validateOrganization({
        name: "My Academy",
        organizationType: "School",
        industry: "Education",
        email: "notanemail",
        country: "United States",
      });
      expect(result.email).toBeDefined();
    });

    it("errors on invalid website URL if supplied", () => {
      const result = validateOrganization({
        name: "My Academy",
        organizationType: "School",
        industry: "Education",
        email: "contact@myacademy.edu",
        country: "United States",
        website: "invalidurl",
      });
      expect(result.website).toBeDefined();
    });
  });

  describe("generateSlug", () => {
    it("generates correct lowercase hyphenated slug", () => {
      expect(generateSlug("The Mentor School")).toBe("the-mentor-school");
      expect(generateSlug("  Space Academy  ")).toBe("space-academy");
      expect(generateSlug("Special-Char@123")).toBe("special-char123");
    });
  });
});
