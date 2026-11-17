import type { MySql2Database } from "drizzle-orm/mysql2";
import { AgentGovernanceConsoleRepository } from "../repositories/agent-governance-console.repository.js";
import { AgentComplianceService } from "./agent-compliance.service.js";
import { redactObject } from "../utils/secret-redactor.js";
import type {
  AgentDirectoryDetailDTO,
  AgentDirectoryFilter,
  AgentDirectoryItemDTO,
  GovernanceActionItemDTO,
  GovernanceReportDTO,
  GovernanceReportQuery,
  UnifiedActivityFilter,
  UnifiedActivityItemDTO,
  UnifiedGovernanceOverviewDTO,
} from "../governance-console.types.js";

export class AgentGovernanceConsoleService {
  private readonly repo: AgentGovernanceConsoleRepository;
  private readonly complianceService?: AgentComplianceService;

  constructor(
    _db: MySql2Database<any>,
    complianceService?: AgentComplianceService
  ) {
    this.repo = new AgentGovernanceConsoleRepository(_db);
    this.complianceService = complianceService ?? new AgentComplianceService(_db);
  }

  // ---------------------------------------------------------------------------
  // 1. UNIFIED CONSOLE OVERVIEW
  // ---------------------------------------------------------------------------

  async getConsoleOverview(organizationId: string): Promise<UnifiedGovernanceOverviewDTO> {
    return this.repo.getUnifiedOverview(organizationId);
  }

  // ---------------------------------------------------------------------------
  // 2. AGENT GOVERNANCE DIRECTORY
  // ---------------------------------------------------------------------------

  async listAgentDirectory(
    organizationId: string,
    filter: AgentDirectoryFilter = {}
  ): Promise<{ items: AgentDirectoryItemDTO[]; total: number; page: number; pageSize: number }> {
    return this.repo.listAgentDirectory(organizationId, filter);
  }

  async getAgentDirectoryDetail(
    organizationId: string,
    agentId: string
  ): Promise<AgentDirectoryDetailDTO | null> {
    return this.repo.getAgentDirectoryDetail(organizationId, agentId);
  }

  // ---------------------------------------------------------------------------
  // 3. UNIFIED ACTIVITY TIMELINE
  // ---------------------------------------------------------------------------

  async getUnifiedActivity(
    organizationId: string,
    filter: UnifiedActivityFilter = {}
  ): Promise<{ items: UnifiedActivityItemDTO[]; total: number; page: number; pageSize: number }> {
    const res = await this.repo.getUnifiedActivityTimeline(organizationId, filter);
    // Deeply redact any potential secrets or sensitive values in metadata
    res.items = res.items.map((item) => ({
      ...item,
      redactedMetadata: redactObject(item.redactedMetadata),
    }));
    return res;
  }

  // ---------------------------------------------------------------------------
  // 4. GOVERNANCE ACTION CENTER
  // ---------------------------------------------------------------------------

  async getActionCenter(organizationId: string): Promise<GovernanceActionItemDTO[]> {
    return this.repo.getActionCenterItems(organizationId);
  }

  // ---------------------------------------------------------------------------
  // 5. GOVERNANCE REPORTING & AUDITED EXPORTS
  // ---------------------------------------------------------------------------

  async generateReport(
    organizationId: string,
    query: GovernanceReportQuery = {},
    actorId?: string
  ): Promise<GovernanceReportDTO> {
    const report = await this.repo.generateReport(organizationId, query);

    // Audit report generation in compliance ledger
    if (this.complianceService) {
      try {
        await this.complianceService.recordComplianceEvent({
          organizationId,
          eventCategory: "EVIDENCE_EXPORT",
          eventType: "agent.governance.report.generated",
          actorType: "user",
          actorId,
          eventOutcome: "SUCCESS" as any,
          riskSeverity: "LOW",
          dataClassification: "INTERNAL",
          redactedMetadata: {
            reportType: report.reportType,
            period: report.period,
          },
        });
      } catch {
        // Non-blocking for report display
      }
    }

    return report;
  }

  async exportReport(
    organizationId: string,
    format: "JSON" | "CSV",
    query: GovernanceReportQuery = {},
    actorId?: string
  ): Promise<{ format: "JSON" | "CSV"; content: string; filename: string }> {
    const report = await this.generateReport(organizationId, query, actorId);
    const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "CSV") {
      const csvLines = [
        "Metric Category,Metric Name,Value",
        `Executive,Governed Agents,${report.executiveSummary.governedAgentsCount}`,
        `Executive,Audit Integrity,${report.executiveSummary.auditIntegrityStatus}`,
        `Executive,Average Trust Score,${report.executiveSummary.averageTrustScore}`,
        `Executive,Open Incidents,${report.executiveSummary.openIncidentsCount}`,
        `Executive,Compliance Coverage,${report.executiveSummary.complianceCoveragePercent}%`,
        `Security,Suspended Agents,${report.securityMetrics.suspendedAgents}`,
        `Security,Total Incidents,${report.securityMetrics.totalIncidents}`,
        `Compliance,Total Controls,${report.complianceMetrics.totalControls}`,
        `Compliance,Verified Controls,${report.complianceMetrics.verifiedControls}`,
        `Risk,Total Risks,${report.riskMetrics.totalRisks}`,
        `Risk,Critical Risks,${report.riskMetrics.risksByTier.critical}`,
        `Risk,High Risks,${report.riskMetrics.risksByTier.high}`,
        `Risk,Open Mitigations,${report.riskMetrics.openMitigations}`,
        `Approvals,Pending Approvals,${report.approvalMetrics.pendingApprovals}`,
        `Approvals,Approval Rate,${report.approvalMetrics.approvalRatePercent}%`,
      ];

      return {
        format: "CSV",
        content: csvLines.join("\n"),
        filename: `governance-report-${organizationId}-${timestampStr}.csv`,
      };
    }

    return {
      format: "JSON",
      content: JSON.stringify(report, null, 2),
      filename: `governance-report-${organizationId}-${timestampStr}.json`,
    };
  }
}
