import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  AuthAlert,
  AuthCard,
  Button,
  FormField,
  Input,
  Textarea,
  OrganizationTypeSelect,
  IndustrySelect,
} from "@haza-aios/ui";

import { ApiError } from "@/api/api-client";
import { useAuth } from "@/auth/use-auth";
import { useOrganization } from "@/org/use-organization";
import { generateSlug, validateOrganization } from "@/org/org-validation";
import type { OrganizationType } from "@/org/org.types";
import { navigate } from "@/routes/navigation";
import { AuthShell } from "../auth/AuthShell";

function CreateOrganizationPage() {
  const auth = useAuth();
  const { createOrg, isLoading } = useOrganization();
  const [form, setForm] = useState({
    name: "",
    legalName: "",
    organizationType: "School" as OrganizationType | "",
    industry: "Education",
    website: "",
    email: "",
    phone: "",
    country: "United States",
    description: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredSlug, setRegisteredSlug] = useState("");

  useEffect(() => {
    if (!auth.user?.email) return;
    Promise.resolve().then(() => {
      setForm((current) =>
        current.email ? current : { ...current, email: auth.user?.email ?? "" },
      );
    });
  }, [auth.user?.email]);
  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setApiError(null);

    // Validate
    const validationErrors = validateOrganization({
      name: form.name,
      legalName: form.legalName,
      organizationType: form.organizationType,
      industry: form.industry,
      website: form.website,
      email: form.email,
      phone: form.phone,
      country: form.country,
      description: form.description,
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors as Record<string, string>);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      const result = await createOrg({
        name: form.name,
        legalName: form.legalName || form.name,
        organizationType: form.organizationType as OrganizationType,
        industry: form.industry,
        website: form.website,
        email: form.email,
        phone: form.phone,
        country: form.country,
        description: form.description,
      });

      setRegisteredSlug(result.organization.slug);
      setIsSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const fieldErrors = readApiFieldErrors(err.details);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
        }
        setApiError(readApiErrorMessage(err.details) ?? err.message);
      } else {
        setApiError(err instanceof Error ? err.message : "Failed to create organization. Please try again.");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (isSuccess) {
    return (
      <AuthShell>
        <AuthCard
          eyebrow="Registration Successful"
          title="Organization Registered!"
          description="Your multi-tenant workspace foundation has been established successfully."
        >
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">{form.name}</h3>
              <p className="text-sm text-slate-400">
                Workspace URL identifier:{" "}
                <span className="font-mono text-emerald-300">@{registeredSlug}</span>
              </p>
              <p className="text-sm text-slate-400">
                You have been registered as the{" "}
                <strong className="text-white">Workspace Owner</strong>.
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-white/5 bg-slate-900/50 p-4 text-left text-xs text-slate-400">
              <span className="block font-semibold tracking-wider text-slate-300 uppercase">
                Security Notice:
              </span>
              Tenant isolation rules are active. Only members of this workspace will have access to
              database tables matching this tenant container ID.
            </div>

            <Button className="w-full" onClick={() => navigate("/app")}>
              Enter Workspace Dashboard
            </Button>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        eyebrow="Step 2 of 2"
        title="Register your Organization"
        description="Establish your organization tenant. You will automatically become the owner of this workspace."
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {apiError && <AuthAlert variant="error">{apiError}</AuthAlert>}

          <FormField id="org-name" label="Organization Name" error={errors.name}>
            <Input
              placeholder="e.g. The Mentor School"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </FormField>

          {form.name.trim().length > 0 && (
            <div className="text-xs text-slate-400">
              Generated identifier:{" "}
              <span className="font-mono text-emerald-400">{generateSlug(form.name)}</span>
            </div>
          )}

          <FormField id="org-legal" label="Legal Entity Name (Optional)">
            <Input
              placeholder="e.g. The Mentor School Inc."
              value={form.legalName}
              onChange={(e) => handleChange("legalName", e.target.value)}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="org-type" label="Organization Type" error={errors.organizationType}>
              <OrganizationTypeSelect
                value={form.organizationType}
                onChange={(e) => handleChange("organizationType", e.target.value)}
                required
              />
            </FormField>

            <FormField id="org-industry" label="Industry" error={errors.industry}>
              <IndustrySelect
                value={form.industry}
                onChange={(e) => handleChange("industry", e.target.value)}
                required
              />
            </FormField>
          </div>

          <FormField id="org-email" label="Contact Email Address" error={errors.email}>
            <Input
              type="email"
              placeholder="contact@organization.com"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
            />
          </FormField>

          <FormField id="org-website" label="Website URL (Optional)" error={errors.website}>
            <Input
              placeholder="https://organization.com"
              value={form.website}
              onChange={(e) => handleChange("website", e.target.value)}
            />
          </FormField>

          <FormField id="org-country" label="Country" error={errors.country}>
            <Input
              placeholder="e.g. United States"
              value={form.country}
              onChange={(e) => handleChange("country", e.target.value)}
              required
            />
          </FormField>

          <FormField id="org-desc" label="Description (Optional)">
            <Textarea
              placeholder="Tell us about your organization's mission..."
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={3}
            />
          </FormField>

          {Object.keys(errors).length > 0 && (
            <AuthAlert variant="error">
              Please resolve the validation errors above before submitting.
            </AuthAlert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating workspace..." : "Register Organization"}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

export { CreateOrganizationPage };

type ApiErrorDetails = {
  error?: {
    message?: unknown;
    details?: unknown;
  };
};

function readApiErrorMessage(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const error = (details as ApiErrorDetails).error;
  if (!error || typeof error !== "object") return null;
  const detailText = readDetailText(error.details);
  const message = typeof error.message === "string" ? error.message : null;
  return detailText ? `${message ?? "Request validation failed"}: ${detailText}` : message;
}

function readApiFieldErrors(details: unknown): Record<string, string> {
  if (!details || typeof details !== "object") return {};
  const error = (details as ApiErrorDetails).error;
  const detailList = Array.isArray(error?.details) ? error.details : [];
  const fieldErrors: Record<string, string> = {};

  for (const issue of detailList) {
    if (!issue || typeof issue !== "object") continue;
    const field = (issue as { field?: unknown }).field;
    const message = (issue as { message?: unknown }).message;
    if (typeof field === "string" && typeof message === "string") {
      fieldErrors[field] = message;
    }
  }

  return fieldErrors;
}

function readDetailText(details: unknown): string | null {
  if (!Array.isArray(details)) return null;
  const messages = details
    .map((issue) => {
      if (!issue || typeof issue !== "object") return null;
      const field = (issue as { field?: unknown }).field;
      const message = (issue as { message?: unknown }).message;
      if (typeof field === "string" && typeof message === "string") return `${field}: ${message}`;
      return typeof message === "string" ? message : null;
    })
    .filter((message): message is string => Boolean(message));

  return messages.length > 0 ? messages.join("; ") : null;
}

