import { ModuleRegistry } from "../module-registry";
import type { ModuleContract } from "../module.types";
import { DemoAnalyticsModulePage } from "./DemoAnalyticsModulePage";

export const DemoAnalyticsModule: ModuleContract = {
  id: "mod-demo-analytics",
  name: "Demo Workspace Analytics",
  slug: "demo-analytics",
  description:
    "Sample non-production module providing workspace telemetry and performance insights to demonstrate the Module Framework.",
  version: "1.0.0",
  category: "utility",
  industry: "Cross-Industry",
  icon: "📊",
  status: "activated",
  enabled: true,
  routes: [
    {
      path: "/workspace/modules/demo-analytics",
      component: DemoAnalyticsModulePage,
      exact: true,
      requiredPermission: "module.demo.view",
    },
  ],
  navigation: [
    {
      id: "nav-demo-analytics",
      label: "Demo Analytics",
      icon: "📊",
      route: "/workspace/modules/demo-analytics",
      order: 10,
      badge: "Demo",
    },
  ],
  permissions: [
    {
      key: "module.demo.view",
      name: "View Demo Analytics",
      description: "Allows viewing sample workspace analytics and performance signals.",
    },
    {
      key: "module.demo.configure",
      name: "Configure Demo Analytics",
      description: "Allows modifying sample telemetry thresholds.",
    },
  ],
  configuration: {
    settingsKey: "demo_analytics_config",
    defaultValues: {
      refreshRateSeconds: 30,
      enableLiveStream: true,
    },
    fields: [
      {
        key: "refreshRateSeconds",
        label: "Refresh Interval (Seconds)",
        type: "number",
        description: "Frequency of telemetry polling.",
      },
      {
        key: "enableLiveStream",
        label: "Enable Realtime Stream",
        type: "boolean",
        description: "Stream metrics via WebSocket connection.",
      },
    ],
  },
  metadata: {
    author: "HAZA AIOS Core Team",
    documentationUrl: "https://haza-aios.internal/docs/modules/demo-analytics",
    tags: ["demo", "telemetry", "analytics", "utility"],
    releasedAt: "2026-08-12",
    minCoreVersion: "0.8.0",
  },
};

/**
 * Register the Demo Analytics module automatically into the central registry.
 */
export function registerDemoModule(): void {
  if (!ModuleRegistry.get(DemoAnalyticsModule.id)) {
    ModuleRegistry.register(DemoAnalyticsModule);
  }
}
