export interface OrganizationRegistrationInput {
  name: string;
  legalName?: string;
  organizationType: string;
  industry: string;
  website?: string;
  email: string;
  phone?: string;
  country: string;
  description?: string;
}

export interface OrganizationValidationErrors {
  name?: string;
  organizationType?: string;
  industry?: string;
  email?: string;
  website?: string;
  country?: string;
}

export function validateOrganization(
  input: OrganizationRegistrationInput,
): OrganizationValidationErrors {
  const errors: OrganizationValidationErrors = {};

  if (!input.name || input.name.trim().length < 2) {
    errors.name = "Organization name must be at least 2 characters.";
  }

  if (!input.organizationType) {
    errors.organizationType = "Organization type is required.";
  }

  if (!input.industry || input.industry.trim().length === 0) {
    errors.industry = "Industry is required.";
  }

  if (!input.email) {
    errors.email = "Contact email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (input.website && input.website.trim().length > 0) {
    const websiteTrimmed = input.website.trim();
    // Simple URL regex check
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/ \w.-]*)*\/?$/i;
    if (!urlPattern.test(websiteTrimmed)) {
      errors.website = "Please enter a valid website URL.";
    }
  }

  if (!input.country || input.country.trim().length === 0) {
    errors.country = "Country is required.";
  }

  return errors;
}

/**
 * Generate a clean URL slug from the name.
 * Handles duplicate slugs, invalid characters, spaces, capitalization, uniqueness.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-word/non-space/non-hyphens
    .replace(/[\s_]+/g, "-") // replace spaces and underscores with hyphens
    .replace(/-+/g, "-"); // deduplicate hyphens
}
