import React, { useEffect, useState } from "react";
import { useOrganization } from "../../org/use-organization";
import { workspaceService } from "../../workspace/workspace-service";
import { AppShell } from "../../components/AppShell";
import { AdminPageHeader, FormField, Input, Textarea, Button } from "@haza-aios/ui";

export function WorkspaceSettingsPage() {
  const { currentOrganization, currentMembership, refresh } = useOrganization();
  const [formData, setFormData] = useState({
    name: "",
    legalName: "",
    description: "",
    website: "",
    email: "",
    phone: "",
    country: "",
    timezone: "",
    currency: "USD",
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check role-based write access
  const hasWriteAccess = currentMembership?.role === "Owner" || currentMembership?.role === "Admin";

  useEffect(() => {
    if (currentOrganization) {
      Promise.resolve().then(() => {
        setFormData({
          name: currentOrganization.name || "",
          legalName: currentOrganization.legalName || "",
          description: currentOrganization.description || "",
          website: currentOrganization.website || "",
          email: currentOrganization.email || "",
          phone: currentOrganization.phone || "",
          country: currentOrganization.country || "",
          timezone: currentOrganization.timezone || "UTC",
          currency: currentOrganization.currency || "USD",
        });
      });
    }
  }, [currentOrganization]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !hasWriteAccess) return;

    if (!formData.name.trim() || !formData.email.trim()) {
      setErrorMsg("Organization name and email are required fields.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      
      // Update in stored DB
      await workspaceService.updateOrganizationSettings(currentOrganization.id, formData);
      
      // Trigger context refresh so header reloads updated names
      await refresh();
      
      setSuccessMsg("Organization settings successfully saved and synced.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save organization settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        {/* Page Header */}
        <AdminPageHeader
          title="Organization Settings"
          description="View and update profile, localization, currency, and identity preferences for this workspace."
        />

        {/* Access Restriction Notification Banner */}
        {!hasWriteAccess && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-400">
            ⚠️ **Read-Only Mode:** You do not have administrator permissions. Only workspace Owners and Admins can modify organization settings.
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-400 flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-white font-bold">×</button>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-white font-bold">×</button>
          </div>
        )}

        {/* Form Body Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-sm font-semibold text-slate-300 border-b border-white/5 pb-3">Organization Profile</h3>
            
            <div className="grid gap-6 md:grid-cols-2">
              <FormField id="name" label="Organization Name">
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  disabled={!hasWriteAccess}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Acme Academy"
                />
              </FormField>

              <FormField id="legalName" label="Legal Entity Name">
                <Input
                  id="legalName"
                  name="legalName"
                  type="text"
                  disabled={!hasWriteAccess}
                  value={formData.legalName}
                  onChange={handleChange}
                  placeholder="e.g. Acme Corporation Inc."
                />
              </FormField>

              <FormField id="email" label="Contact Email Address">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  disabled={!hasWriteAccess}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. contact@acme.com"
                />
              </FormField>

              <FormField id="phone" label="Contact Phone Number">
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  disabled={!hasWriteAccess}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. +1 555-0199"
                />
              </FormField>

              <div className="md:col-span-2">
                <FormField id="description" label="Organization Description">
                  <Textarea
                    id="description"
                    name="description"
                    disabled={!hasWriteAccess}
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Provide a brief description of the organization's scope and mission."
                    rows={3}
                  />
                </FormField>
              </div>

              <FormField id="website" label="Official Website">
                <Input
                  id="website"
                  name="website"
                  type="url"
                  disabled={!hasWriteAccess}
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="e.g. https://www.acme.edu"
                />
              </FormField>
            </div>

            <h3 className="text-sm font-semibold text-slate-300 border-b border-white/5 pb-3 pt-4">Localization & Financials</h3>

            <div className="grid gap-6 md:grid-cols-3">
              <FormField id="country" label="Country">
                <Input
                  id="country"
                  name="country"
                  type="text"
                  required
                  disabled={!hasWriteAccess}
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="e.g. United States"
                />
              </FormField>

              <FormField id="timezone" label="Timezone">
                <select
                  id="timezone"
                  name="timezone"
                  disabled={!hasWriteAccess}
                  value={formData.timezone}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs text-white focus:outline-none focus:border-red-500/30"
                >
                  <option value="UTC">UTC (GMT+00:00)</option>
                  <option value="America/New_York">Eastern Time (EST, GMT-05:00)</option>
                  <option value="America/Chicago">Central Time (CST, GMT-06:00)</option>
                  <option value="America/Denver">Mountain Time (MST, GMT-07:00)</option>
                  <option value="America/Los_Angeles">Pacific Time (PST, GMT-08:00)</option>
                  <option value="Europe/London">London (GMT+00:00)</option>
                  <option value="Asia/Karachi">Karachi (PKT, GMT+05:00)</option>
                  <option value="Asia/Kolkata">Kolkata (IST, GMT+05:30)</option>
                  <option value="Asia/Tokyo">Tokyo (JST, GMT+09:00)</option>
                </select>
              </FormField>

              <FormField id="currency" label="Default Currency">
                <select
                  id="currency"
                  name="currency"
                  disabled={!hasWriteAccess}
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs text-white focus:outline-none focus:border-red-500/30"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="PKR">PKR (Rs)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </FormField>
            </div>

            {hasWriteAccess && (
              <div className="flex justify-end pt-6 border-t border-white/5">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-red-500 px-6 py-2.5 text-xs font-semibold text-white hover:bg-red-400 transition-all shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                >
                  {isSaving ? "Saving Settings..." : "Save Workspace Settings"}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>
    </AppShell>
  );
}
