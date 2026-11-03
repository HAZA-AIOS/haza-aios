import React, { useEffect, useState } from "react";
import { AppShell } from "../../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import { Card } from "@haza-aios/ui/components/card";
import {
  agentProviderService,
  type AiBudget,
  type AiUsageRecord,
  type ModelMetadata,
  type TenantProviderConfig,
} from "../../../../agents/agent-provider-service";
import { useOrganization } from "../../../../org/use-organization";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Cpu,
  CreditCard,
  DollarSign,
  Key,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from "lucide-react";

export const AiProvidersPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id || "org-mentor-school";

  const [activeTab, setActiveTab] = useState<"overview" | "models" | "budgets" | "usage">("overview");
  const [configs, setConfigs] = useState<TenantProviderConfig[]>([]);
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [budget, setBudget] = useState<AiBudget | null>(null);
  const [usage, setUsage] = useState<AiUsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit config modal state
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [targetProviderId, setTargetProviderId] = useState("openai");
  const [newApiKey, setNewApiKey] = useState("");
  const [newLiveMode, setNewLiveMode] = useState(false);
  const [newEnvMode, setNewEnvMode] = useState<"mock" | "staging" | "production">("mock");
  const [isValidating, setIsValidating] = useState(false);

  // Budget edit state
  const [monthlyLimit, setMonthlyLimit] = useState(50);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [hardLimit, setHardLimit] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const [fetchedConfigs, fetchedModels, fetchedBudget, fetchedUsage] = await Promise.all([
        agentProviderService.listConfigs(organizationId).catch(() => []),
        agentProviderService.listModels(organizationId).catch(() => []),
        agentProviderService.getBudget(organizationId).catch(() => null),
        agentProviderService.getUsage(organizationId, 30).catch(() => []),
      ]);
      setConfigs(fetchedConfigs);
      setModels(fetchedModels);
      setBudget(fetchedBudget);
      setUsage(fetchedUsage);
      if (fetchedBudget) {
        setMonthlyLimit(Number(fetchedBudget.monthlyBudgetUsd));
        setDailyLimit(Number(fetchedBudget.dailyBudgetUsd));
        setHardLimit(fetchedBudget.enforceHardLimit);
      }
    } catch {
      setActionMessage({ type: "error", text: "Failed to load provider configurations." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const handleValidate = async (providerId: string) => {
    setIsValidating(true);
    setActionMessage(null);
    try {
      const res = await agentProviderService.validateProvider(organizationId, providerId);
      if (res.status === "healthy" || res.status === "active") {
        setActionMessage({
          type: "success",
          text: `Validation successful: ${res.message ?? "Provider reachable"} (${res.latencyMs}ms, 0 tokens charged).`,
        });
      } else {
        setActionMessage({
          type: "error",
          text: `Validation alert: ${res.message ?? "Provider reported degraded/error status"}.`,
        });
      }
      loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Validation failed." });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveConfig = async () => {
    setActionMessage(null);
    try {
      await agentProviderService.updateConfig(organizationId, {
        providerId: targetProviderId,
        apiKey: newApiKey.trim() || undefined,
        liveModeEnabled: newLiveMode,
        environmentMode: newEnvMode,
      });
      setIsEditingKey(false);
      setNewApiKey("");
      setActionMessage({ type: "success", text: "Provider settings updated successfully." });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to update configuration." });
    }
  };

  const handleSaveBudget = async () => {
    setActionMessage(null);
    try {
      await agentProviderService.updateBudget(organizationId, {
        monthlyBudgetUsd: monthlyLimit,
        dailyBudgetUsd: dailyLimit,
        enforceHardLimit: hardLimit,
      });
      setActionMessage({ type: "success", text: "Spending limits updated successfully." });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to update budget." });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 text-slate-100">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="h-6 w-6 text-indigo-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">AI Provider Gateway</h1>
              <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
                Epic 18 Production Intelligence
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Manage multi-tenant AI inference providers, masked credentials, model allowlists, and strict budget boundaries.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Action Message Alert */}
        {actionMessage && (
          <div
            className={`flex items-center gap-2 rounded-lg p-4 text-sm ${
              actionMessage.type === "success"
                ? "border border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                : "border border-red-500/30 bg-red-950/40 text-red-300"
            }`}
          >
            {actionMessage.type === "success" ? (
              <CheckCircle className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "overview"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Server className="h-4 w-4" />
            Provider Gateway
          </button>
          <button
            onClick={() => setActiveTab("models")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "models"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-4 w-4" />
            Model Catalog & Allowlists
          </button>
          <button
            onClick={() => setActiveTab("budgets")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "budgets"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Spending Limits & Budgets
          </button>
          <button
            onClick={() => setActiveTab("usage")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "usage"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="h-4 w-4" />
            Usage Telemetry & Ledger
          </button>
        </div>

        {/* TAB 1: OVERVIEW & PROVIDER STATUS */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* OpenAI Provider Card */}
              {(() => {
                const openaiConfig = configs.find((c) => c.providerId === "openai");
                const isLive = openaiConfig?.liveModeEnabled ?? false;
                const status = openaiConfig?.status ?? "inactive";

                return (
                  <Card className="border-slate-800 bg-slate-900/80 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">OpenAI Production Provider</h3>
                          <p className="text-xs text-slate-400">GPT-4o, GPT-4o Mini, Text-Embedding-3</p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isLive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {isLive ? "LIVE ENABLED" : "MOCK MODE (DEFAULT)"}
                      </span>
                    </div>

                    <div className="mt-5 space-y-3 border-t border-slate-800/80 pt-4 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">API Key:</span>
                        <span className="font-mono text-slate-200">
                          {openaiConfig?.apiKeyMasked || "Not configured"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Environment Mode:</span>
                        <span className="capitalize text-slate-200">
                          {openaiConfig?.environmentMode || "mock"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Connection Health:</span>
                        <span
                          className={`font-medium ${
                            status === "active" || status === "configured"
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Status Message:</span>
                        <span className="text-slate-300 truncate max-w-[200px]">
                          {openaiConfig?.statusMessage || "Ready"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                      <Button
                        size="sm"
                        onClick={() => {
                          setTargetProviderId("openai");
                          setNewLiveMode(openaiConfig?.liveModeEnabled ?? false);
                          setNewEnvMode(openaiConfig?.environmentMode ?? "mock");
                          setIsEditingKey(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                      >
                        <Key className="mr-1.5 h-3.5 w-3.5" />
                        Configure Credentials
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isValidating || !openaiConfig?.apiKeyMasked}
                        onClick={() => handleValidate("openai")}
                        className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
                      >
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        Zero-Cost Probe
                      </Button>
                    </div>
                  </Card>
                );
              })()}

              {/* HAZA Mock Provider Card */}
              <Card className="border-slate-800 bg-slate-900/80 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Cpu className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">HAZA Deterministic Mock Provider</h3>
                      <p className="text-xs text-slate-400">Zero-cost offline CI and staging simulation</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                    ALWAYS ACTIVE
                  </span>
                </div>

                <div className="mt-5 space-y-3 border-t border-slate-800/80 pt-4 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cost:</span>
                    <span className="font-semibold text-emerald-400">$0.00 USD (Deterministic)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inference Latency:</span>
                    <span className="text-slate-200">Simulated 1ms - 50ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capabilities:</span>
                    <span className="text-slate-200">Tools, Lesson Plans, RAG, JSON Mode</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fail-Safe Role:</span>
                    <span className="text-slate-300">Default fallback when live mode disabled</span>
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleValidate("mock")}
                    className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs"
                  >
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                    Verify Mock Readiness
                  </Button>
                </div>
              </Card>
            </div>

            {/* Security Notice */}
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-950/20 p-4 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-indigo-400 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Zero Raw Credential Exposure Architecture
              </div>
              <p className="mt-1 text-slate-400">
                API credentials are encrypted in durable storage and never exposed to the frontend or audit logs.
                All client requests return masked representations (<code className="text-slate-200">sk-...ab12</code>).
                Live inference is disabled by default and requires explicit tenant policy activation.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: MODEL CATALOG & ALLOWLISTS */}
        {activeTab === "models" && (
          <div className="space-y-4">
            <Card className="border-slate-800 bg-slate-900/80 p-5">
              <h3 className="font-semibold text-white">Discovered Models & Pricing Catalog</h3>
              <p className="text-xs text-slate-400 mt-1">
                Configurable pricing, context windows, and capability profiles enforced across all model calls.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2.5 font-medium">Model ID</th>
                      <th className="py-2.5 font-medium">Provider</th>
                      <th className="py-2.5 font-medium">Context Window</th>
                      <th className="py-2.5 font-medium">Prompt Price (1K)</th>
                      <th className="py-2.5 font-medium">Output Price (1K)</th>
                      <th className="py-2.5 font-medium">Capabilities</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {models.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/30">
                        <td className="py-3 font-mono font-medium text-white">{m.id}</td>
                        <td className="py-3 capitalize text-slate-400">{m.provider}</td>
                        <td className="py-3">{m.contextWindow.toLocaleString()} tokens</td>
                        <td className="py-3">
                          ${m.pricing?.promptPerThousandTokensUsd?.toFixed(5) ?? "0.00000"}
                        </td>
                        <td className="py-3">
                          ${m.pricing?.completionPerThousandTokensUsd?.toFixed(5) ?? "0.00000"}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {m.capabilities.map((c) => (
                              <span
                                key={c}
                                className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: SPENDING LIMITS & BUDGETS */}
        {activeTab === "budgets" && (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Current Spend Card */}
              <Card className="border-slate-800 bg-slate-900/80 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">Current Period Spend</h3>
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Monthly Spend</span>
                      <span className="font-medium text-slate-200">
                        ${Number(budget?.currentMonthSpendUsd ?? 0).toFixed(4)} / ${Number(budget?.monthlyBudgetUsd ?? 50).toFixed(2)} USD
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-indigo-500"
                        style={{
                          width: `${Math.min(
                            100,
                            (Number(budget?.currentMonthSpendUsd ?? 0) /
                              Math.max(1, Number(budget?.monthlyBudgetUsd ?? 50))) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Daily Spend</span>
                      <span className="font-medium text-slate-200">
                        ${Number(budget?.currentDaySpendUsd ?? 0).toFixed(4)} / ${Number(budget?.dailyBudgetUsd ?? 10).toFixed(2)} USD
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(
                            100,
                            (Number(budget?.currentDaySpendUsd ?? 0) /
                              Math.max(1, Number(budget?.dailyBudgetUsd ?? 10))) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="rounded border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                    <span className="font-medium text-slate-200">Fail-Closed Boundary: </span>
                    {budget?.enforceHardLimit
                      ? "Enforced. Any request exceeding budget limits halts immediately."
                      : "Advisory mode (alerts only)."}
                  </div>
                </div>
              </Card>

              {/* Budget Settings Card */}
              <Card className="border-slate-800 bg-slate-900/80 p-6">
                <h3 className="font-semibold text-white">Configure Spending Limits</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust hard limits to prevent runaway inference or unexpected upstream charges.
                </p>

                <div className="mt-5 space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Monthly Budget Limit ($ USD)</label>
                    <input
                      type="number"
                      value={monthlyLimit}
                      onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Daily Budget Limit ($ USD)</label>
                    <input
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Number(e.target.value))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="hardLimitToggle"
                      checked={hardLimit}
                      onChange={(e) => setHardLimit(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                    />
                    <label htmlFor="hardLimitToggle" className="text-slate-300">
                      Enforce strict hard budget cutoff (fail closed)
                    </label>
                  </div>

                  <div className="pt-2">
                    <Button size="sm" onClick={handleSaveBudget} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                      Save Spending Limits
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 4: USAGE TELEMETRY & LEDGER */}
        {activeTab === "usage" && (
          <div className="space-y-4">
            <Card className="border-slate-800 bg-slate-900/80 p-5">
              <h3 className="font-semibold text-white">AI Invocation Usage Ledger</h3>
              <p className="text-xs text-slate-400 mt-1">
                Granular token consumption, latency, and estimated cost tracking for every inference request.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2.5 font-medium">Timestamp</th>
                      <th className="py-2.5 font-medium">Operation</th>
                      <th className="py-2.5 font-medium">Model</th>
                      <th className="py-2.5 font-medium">Mode</th>
                      <th className="py-2.5 font-medium">Prompt Tokens</th>
                      <th className="py-2.5 font-medium">Completion Tokens</th>
                      <th className="py-2.5 font-medium">Latency</th>
                      <th className="py-2.5 font-medium">Estimated Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {usage.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-slate-500">
                          No recent AI model invocations recorded.
                        </td>
                      </tr>
                    ) : (
                      usage.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 text-slate-400">
                            {new Date(u.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 font-medium text-white">{u.operationType}</td>
                          <td className="py-2.5 font-mono text-slate-300">{u.modelId}</td>
                          <td className="py-2.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] ${
                                u.isLiveMode
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {u.isLiveMode ? "LIVE" : "MOCK"}
                            </span>
                          </td>
                          <td className="py-2.5">{u.promptTokens}</td>
                          <td className="py-2.5">{u.completionTokens}</td>
                          <td className="py-2.5">{u.latencyMs}ms</td>
                          <td className="py-2.5 font-mono text-emerald-400">
                            ${Number(u.estimatedCostUsd).toFixed(5)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* MODAL: EDIT CREDENTIALS & MODE */}
        {isEditingKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-xl">
              <h3 className="font-semibold text-white">Configure AI Provider Credentials</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter an API key to enable live provider capabilities. Keys are securely stored and never exposed.
              </p>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">OpenAI API Key (sk-...)</label>
                  <input
                    type="password"
                    placeholder="Enter sk-... (leave blank to keep existing key)"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Environment Mode</label>
                  <select
                    value={newEnvMode}
                    onChange={(e) => setNewEnvMode(e.target.value as any)}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="mock">Mock Mode (Default, Zero-cost)</option>
                    <option value="staging">Staging Mode</option>
                    <option value="production">Production Mode</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="liveModeToggle"
                    checked={newLiveMode}
                    onChange={(e) => setNewLiveMode(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <label htmlFor="liveModeToggle" className="text-slate-300 font-medium">
                    Enable Live AI Provider Invocations
                  </label>
                </div>

                {newLiveMode && (
                  <div className="rounded border border-amber-500/30 bg-amber-950/30 p-2.5 text-[11px] text-amber-300">
                    <AlertTriangle className="inline mr-1 h-3.5 w-3.5" />
                    Enabling live mode allows agents to dispatch genuine API calls to OpenAI. Spending is governed by tenant budget limits.
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingKey(false);
                      setNewApiKey("");
                    }}
                    className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveConfig} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                    Save Provider Settings
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
};
