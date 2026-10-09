import React, { useEffect, useState } from "react";
import { useOrganization } from "../../org/use-organization";
import { AppShell } from "../../components/AppShell";
import { AdminPageHeader, FormField, Input, Button } from "@haza-aios/ui";
import { domainService, type TenantDomain } from "../../org/domain-service";

export function WorkspaceDomainsPage() {
  const { currentOrganization, currentMembership } = useOrganization();
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasWriteAccess = currentMembership?.role === "Owner" || currentMembership?.role === "Admin";

  const fetchDomains = async () => {
    if (!currentOrganization) return;
    try {
      setIsLoading(true);
      const list = await domainService.listDomains(currentOrganization.id);
      setDomains(list);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load domains.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, [currentOrganization]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !hasWriteAccess) return;
    if (!newDomain.trim()) return;

    try {
      setIsLoading(true);
      setErrorMsg(null);
      await domainService.createDomain(currentOrganization.id, newDomain.trim());
      setNewDomain("");
      await fetchDomains();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add domain.");
      setIsLoading(false);
    }
  };

  const handleVerify = async (domainId: string) => {
    if (!currentOrganization || !hasWriteAccess) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      await domainService.verifyDomain(currentOrganization.id, domainId);
      await fetchDomains();
    } catch (err: any) {
      setErrorMsg(err.message || "Domain verification failed.");
      setIsLoading(false);
    }
  };

  const handleDelete = async (domainId: string) => {
    if (!currentOrganization || !hasWriteAccess) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      await domainService.deleteDomain(currentOrganization.id, domainId);
      await fetchDomains();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete domain.");
      setIsLoading(false);
    }
  };

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        <AdminPageHeader
          title="Custom Domains"
          description="Manage custom domains for your workspace."
        />

        {!hasWriteAccess && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-400">
            ⚠️ **Read-Only Mode:** You do not have administrator permissions.
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400 flex items-center justify-between">
            <span>{errorMsg}</span>
          </div>
        )}

        {hasWriteAccess && (
          <form onSubmit={handleAddDomain} className="rounded-2xl border border-white/5 bg-white/5 p-6 space-y-4">
            <h3 className="text-lg font-medium text-white">Add New Domain</h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <FormField id="domain-input" label="Domain Name">
                  <Input
                    type="text"
                    id="domain-input"
                    placeholder="e.g. portal.myschool.edu"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    disabled={isLoading}
                  />
                </FormField>
              </div>
              <Button type="submit" variant="primary" disabled={isLoading || !newDomain.trim()}>
                Add Domain
              </Button>
            </div>
          </form>
        )}

        <div className="rounded-2xl border border-white/5 bg-white/5 p-6">
          <h3 className="text-lg font-medium text-white mb-4">Your Domains</h3>
          
          {domains.length === 0 ? (
            <p className="text-slate-400 text-sm">No custom domains configured.</p>
          ) : (
            <div className="space-y-4">
              {domains.map((d) => (
                <div key={d.id} className="rounded-lg border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{d.domain}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Status: <span className={
                          d.status === "verified" || d.status === "active" ? "text-emerald-400" :
                          d.status === "failed" ? "text-red-400" : 
                          "text-amber-400"
                        }>
                          {d.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {hasWriteAccess && (
                      <div className="flex items-center gap-3">
                        {d.status === "pending_verification" || d.status === "failed" ? (
                          <Button size="sm" variant="secondary" onClick={() => handleVerify(d.id)} disabled={isLoading}>
                            Verify DNS
                          </Button>
                        ) : null}
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(d.id)} disabled={isLoading}>
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                  {(d.status === "pending_verification" || d.status === "failed") && d.verificationToken && (
                    <div className="bg-slate-900 rounded-md p-3 text-xs text-slate-300 font-mono">
                      <p className="mb-2 font-sans text-slate-400">To verify ownership, add the following TXT record to your domain's DNS configuration:</p>
                      <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                        <span className="text-slate-500">Type:</span>
                        <span>TXT</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2 mb-1">
                        <span className="text-slate-500">Name:</span>
                        <span className="select-all text-white bg-white/5 px-1 py-0.5 rounded">_haza-aios-verification.{d.domain}</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-500">Value:</span>
                        <span className="select-all text-white bg-white/5 px-1 py-0.5 rounded">{d.verificationToken}</span>
                      </div>
                      <p className="mt-2 font-sans text-[10px] text-slate-500">DNS propagation may take a few minutes or up to 24 hours.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
