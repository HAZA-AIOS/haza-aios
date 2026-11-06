import * as React from "react";
import { useOrganization } from "../../../../org/use-organization";
import {
  GovernanceOverviewMetricCard,
  GovernanceRiskBadge,
  SecurityClassificationBadge,
  PolicyLifecycleBadge,
  ComplianceStatusBadge,
  PolicyInventoryCard,
  AgentGovernanceProfileCard,
  GovernanceAuditLogTable,
  Button,
  Card,
  Input,
} from "@haza-aios/ui";
import {
  agentGovernanceService,
  type WebAgentGovernanceProfile,
  type WebAgentOwnershipAssignment,
  type WebAgentGovernancePolicy,
  type WebAgentGovernanceAuditLog,
  type WebGovernanceOverviewStats,
  type PolicyLifecycleState,
  type SecurityClassification,
  type RiskTier,
  type ComplianceStatus,
  type PolicyScopeType,
  type PolicySeverity,
  type PolicyEnforcementAction,
  type GovernanceEnforcementMode,
  type WebPolicySimulationResult,
  type WebPolicyVersionComparisonResult,
  type WebAgentApprovalRequest,
  type WebApprovalDetailsResult,
  type WebAgentSecurityProfile,
  type WebAgentSecretReference,
  type WebAgentSecurityEvent,
  type WebSecurityPostureSummary,
  type WebComplianceOverview,
  type WebComplianceFramework,
  type WebComplianceControl,
  type WebComplianceAuditEvent,
  type WebAuditChainVerification,
  type WebComplianceEvidence,
  type WebEvidencePackage,
  type WebRetentionPolicy,
  type WebLegalHold,
  type WebComplianceInvestigation,
  type WebInvestigationTimeline,
} from "../../../../agents/governance-service";

type ActiveTab =
  | "overview"
  | "policies"
  | "simulation"
  | "decisions"
  | "approvals"
  | "security"
  | "compliance"
  | "profiles"
  | "ownership"
  | "audit";

export function AgentGovernancePage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id || "org-default";

  const [activeTab, setActiveTab] = React.useState<ActiveTab>("overview");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Data state
  const [enforcementMode, setEnforcementMode] = React.useState<GovernanceEnforcementMode>("MONITOR");
  const [overview, setOverview] = React.useState<WebGovernanceOverviewStats | null>(null);
  const [policies, setPolicies] = React.useState<WebAgentGovernancePolicy[]>([]);
  const [profiles, setProfiles] = React.useState<WebAgentGovernanceProfile[]>([]);
  const [ownershipList, setOwnershipList] = React.useState<WebAgentOwnershipAssignment[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<WebAgentGovernanceAuditLog[]>([]);
  const [decisionHistory, setDecisionHistory] = React.useState<WebAgentGovernanceAuditLog[]>([]);

  // Approvals State (Phase 22C)
  const [approvals, setApprovals] = React.useState<WebAgentApprovalRequest[]>([]);
  const [approvalFilter, setApprovalFilter] = React.useState<string>("all");
  const [selectedApprovalDetails, setSelectedApprovalDetails] = React.useState<WebApprovalDetailsResult | null>(null);
  const [approvalModal, setApprovalModal] = React.useState<{ type: "approve" | "reject" | "escalate"; request: WebAgentApprovalRequest } | null>(null);
  const [modalJustification, setModalJustification] = React.useState("");
  const [modalReason, setModalReason] = React.useState("");
  const [modalEscalationContact, setModalEscalationContact] = React.useState("");
  const [continuationLoading, setContinuationLoading] = React.useState<Record<string, boolean>>({});
  const [continuationResult, setContinuationResult] = React.useState<Record<string, string>>({});

  // Security Controls State (Phase 22D)
  const [securityPosture, setSecurityPosture] = React.useState<WebSecurityPostureSummary | null>(null);
  const [securityProfiles, setSecurityProfiles] = React.useState<WebAgentSecurityProfile[]>([]);
  const [secretReferences, setSecretReferences] = React.useState<WebAgentSecretReference[]>([]);
  const [securityEvents, setSecurityEvents] = React.useState<WebAgentSecurityEvent[]>([]);
  const [selectedAgentForSecurity, setSelectedAgentForSecurity] = React.useState<WebAgentSecurityProfile | null>(null);
  const [suspendingAgentId, setSuspendingAgentId] = React.useState<string | null>(null);
  const [suspensionReasonInput, setSuspensionReasonInput] = React.useState("");
  const [showEmergencyStopModal, setShowEmergencyStopModal] = React.useState(false);
  const [emergencyStopReason, setEmergencyStopReason] = React.useState("");
  const [showCreateSecretModal, setShowCreateSecretModal] = React.useState(false);
  const [newSecretIdent, setNewSecretIdent] = React.useState("");
  const [newSecretName, setNewSecretName] = React.useState("");
  const [newSecretDesc, setNewSecretDesc] = React.useState("");
  const [newSecretAgents, setNewSecretAgents] = React.useState("");
  const [newSecretTools, setNewSecretTools] = React.useState("");
  const [newSecretVal, setNewSecretVal] = React.useState("");

  // Compliance & Evidence State (Phase 22E)
  const [complianceOverview, setComplianceOverview] = React.useState<WebComplianceOverview | null>(null);
  const [complianceFrameworks, setComplianceFrameworks] = React.useState<WebComplianceFramework[]>([]);
  const [complianceControls, setComplianceControls] = React.useState<WebComplianceControl[]>([]);
  const [complianceAuditEvents, setComplianceAuditEvents] = React.useState<WebComplianceAuditEvent[]>([]);
  const [auditChainVerification, setAuditChainVerification] = React.useState<WebAuditChainVerification | null>(null);
  const [verifyingChain, setVerifyingChain] = React.useState(false);
  const [complianceEvidenceList, setComplianceEvidenceList] = React.useState<WebComplianceEvidence[]>([]);
  const [evidencePackages, setEvidencePackages] = React.useState<WebEvidencePackage[]>([]);
  const [retentionPolicies, setRetentionPolicies] = React.useState<WebRetentionPolicy[]>([]);
  const [legalHolds, setLegalHolds] = React.useState<WebLegalHold[]>([]);
  const [investigations, setInvestigations] = React.useState<WebComplianceInvestigation[]>([]);
  const [complianceSubTab, setComplianceSubTab] = React.useState<"overview" | "controls" | "audit" | "evidence" | "holds" | "investigations">("overview");
  const [disposalPreviewData, setDisposalPreviewData] = React.useState<any | null>(null);
  const [investigationTimelineData, setInvestigationTimelineData] = React.useState<{ caseNumber: string; timeline: WebInvestigationTimeline[] } | null>(null);

  // Compliance Modals
  const [verifyControlModal, setVerifyControlModal] = React.useState<WebComplianceControl | null>(null);
  const [verifyControlStatus, setVerifyControlStatus] = React.useState("VERIFIED");
  const [verifyControlExceptions, setVerifyControlExceptions] = React.useState("");

  const [showCollectEvidenceModal, setShowCollectEvidenceModal] = React.useState(false);
  const [newEvidenceTitle, setNewEvidenceTitle] = React.useState("");
  const [newEvidenceType, setNewEvidenceType] = React.useState("test_report");
  const [newEvidenceSource, setNewEvidenceSource] = React.useState("automated_verifier");
  const [newEvidenceClass, setNewEvidenceClass] = React.useState("INTERNAL");
  const [newEvidencePayload, setNewEvidencePayload] = React.useState("{\n  \"status\": \"passed\"\n}");

  const [showCreateHoldModal, setShowCreateHoldModal] = React.useState(false);
  const [newHoldName, setNewHoldName] = React.useState("");
  const [newHoldReason, setNewHoldReason] = React.useState("");
  const [newHoldScope, setNewHoldScope] = React.useState("ALL");

  const [showCreateInvModal, setShowCreateInvModal] = React.useState(false);
  const [newInvTitle, setNewInvTitle] = React.useState("");
  const [newInvDesc, setNewInvDesc] = React.useState("");

  const [showExportPackageModal, setShowExportPackageModal] = React.useState(false);
  const [selectedEvidenceForExport, setSelectedEvidenceForExport] = React.useState<string[]>([]);

  // Dialog / Modal states
  const [showCreatePolicy, setShowCreatePolicy] = React.useState(false);
  const [selectedAgentForProfile, setSelectedAgentForProfile] = React.useState<string | null>(null);
  const [selectedAgentForReview, setSelectedAgentForReview] = React.useState<string | null>(null);
  const [selectedAgentForOwnership, setSelectedAgentForOwnership] = React.useState<string | null>(null);
  const [selectedPolicyForCompare, setSelectedPolicyForCompare] = React.useState<string | null>(null);
  const [versionComparison, setVersionComparison] = React.useState<WebPolicyVersionComparisonResult | null>(null);

  // Policy form state
  const [newPolicyName, setNewPolicyName] = React.useState("");
  const [newPolicyKey, setNewPolicyKey] = React.useState("");
  const [newPolicyDesc, setNewPolicyDesc] = React.useState("");
  const [newPolicyType, setNewPolicyType] = React.useState("security");
  const [newPolicySeverity, setNewPolicySeverity] = React.useState<PolicySeverity>("high");
  const [newPolicyScope, setNewPolicyScope] = React.useState<PolicyScopeType>("organization");
  const [newPolicyEnforcement, setNewPolicyEnforcement] = React.useState<PolicyEnforcementAction>("warn");

  // Simulation form state
  const [simAgentId, setSimAgentId] = React.useState("");
  const [simToolKey, setSimToolKey] = React.useState("");
  const [simAction, setSimAction] = React.useState("tool_invocation");
  const [simClassification, setSimClassification] = React.useState<string>("internal");
  const [simRiskTier, setSimRiskTier] = React.useState<string>("medium");
  const [simAutonomyLevel, setSimAutonomyLevel] = React.useState<number>(2);
  const [simulating, setSimulating] = React.useState(false);
  const [simulationResult, setSimulationResult] = React.useState<WebPolicySimulationResult | null>(null);

  // Profile form state
  const [profileClassification, setProfileClassification] = React.useState<SecurityClassification>("internal");
  const [profileRiskTier, setProfileRiskTier] = React.useState<RiskTier>("medium");
  const [profileFrameworks, setProfileFrameworks] = React.useState("SOC2, ISO27001");
  const [profileCadenceDays, setProfileCadenceDays] = React.useState(90);
  const [profileMaxAutonomy, setProfileMaxAutonomy] = React.useState(2);

  // Review form state
  const [reviewStatus, setReviewStatus] = React.useState<ComplianceStatus>("compliant");
  const [reviewNotes, setReviewNotes] = React.useState("");

  // Ownership form state
  const [ownerPrimary, setOwnerPrimary] = React.useState("");
  const [ownerTech, setOwnerTech] = React.useState("");
  const [ownerBiz, setOwnerBiz] = React.useState("");
  const [ownerEscalation, setOwnerEscalation] = React.useState("");

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewData,
        policiesData,
        profilesData,
        ownershipData,
        logsData,
        modeData,
        decisionsData,
        approvalsData,
        postureData,
        secProfilesData,
        secretsData,
        secEventsData,
        compOverviewData,
        compFrameworksData,
        compControlsData,
        compEvidenceData,
        compHoldsData,
        compPackagesData,
        compRetentionData,
        compInvestigationsData,
      ] = await Promise.allSettled([
        agentGovernanceService.getOverview(orgId),
        agentGovernanceService.listPolicies(orgId),
        agentGovernanceService.listProfiles(orgId),
        agentGovernanceService.listOwnership(orgId),
        agentGovernanceService.listAuditLogs(orgId, { limit: 50 }),
        agentGovernanceService.getEnforcementMode(orgId),
        agentGovernanceService.listDecisions(orgId, 50),
        agentGovernanceService.listApprovals(orgId),
        agentGovernanceService.getSecurityPosture(orgId),
        agentGovernanceService.listSecurityProfiles(orgId),
        agentGovernanceService.listSecretReferences(orgId),
        agentGovernanceService.listSecurityEvents(orgId, { limit: 50 }),
        agentGovernanceService.getComplianceOverview(orgId),
        agentGovernanceService.listComplianceFrameworks(orgId),
        agentGovernanceService.listComplianceControls(orgId),
        agentGovernanceService.listEvidence(orgId, { limit: 50 }),
        agentGovernanceService.listLegalHolds(orgId),
        agentGovernanceService.listEvidencePackages(orgId),
        agentGovernanceService.listRetentionPolicies(orgId),
        agentGovernanceService.listInvestigations(orgId),
      ]);

      if (overviewData.status === "fulfilled") setOverview(overviewData.value);
      if (policiesData.status === "fulfilled") setPolicies(policiesData.value);
      if (profilesData.status === "fulfilled") setProfiles(profilesData.value);
      if (ownershipData.status === "fulfilled") setOwnershipList(ownershipData.value);
      if (logsData.status === "fulfilled") setAuditLogs(logsData.value);
      if (modeData.status === "fulfilled") setEnforcementMode(modeData.value);
      if (decisionsData.status === "fulfilled") setDecisionHistory(decisionsData.value);
      if (approvalsData.status === "fulfilled") setApprovals(approvalsData.value || []);
      if (postureData.status === "fulfilled") setSecurityPosture(postureData.value);
      if (secProfilesData.status === "fulfilled") setSecurityProfiles(secProfilesData.value.items);
      if (secretsData.status === "fulfilled") setSecretReferences(secretsData.value.items);
      if (secEventsData.status === "fulfilled") setSecurityEvents(secEventsData.value.items);
      if (compOverviewData.status === "fulfilled") setComplianceOverview(compOverviewData.value);
      if (compFrameworksData.status === "fulfilled") setComplianceFrameworks(compFrameworksData.value.items);
      if (compControlsData.status === "fulfilled") setComplianceControls(compControlsData.value.items);
      if (compEvidenceData.status === "fulfilled") setComplianceEvidenceList(compEvidenceData.value.items);
      if (compHoldsData.status === "fulfilled") setLegalHolds(compHoldsData.value.items);
      if (compPackagesData.status === "fulfilled") setEvidencePackages(compPackagesData.value.items);
      if (compRetentionData.status === "fulfilled") setRetentionPolicies(compRetentionData.value.items);
      if (compInvestigationsData.status === "fulfilled") setInvestigations(compInvestigationsData.value.items);
    } catch (err: any) {
      setError(err?.message || "Failed to load governance telemetry");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Mode Change Handler
  const handleChangeEnforcementMode = async (newMode: GovernanceEnforcementMode) => {
    try {
      setError(null);
      await agentGovernanceService.setEnforcementMode(orgId, newMode);
      setEnforcementMode(newMode);
      setActionSuccess(`Enforcement mode switched to ${newMode}`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update enforcement mode");
    }
  };

  // Lifecycle Transition Handler
  const handleTransitionPolicy = async (policyId: string, targetState: string) => {
    try {
      setError(null);
      await agentGovernanceService.transitionPolicyLifecycle(
        orgId,
        policyId,
        targetState as PolicyLifecycleState,
      );
      setActionSuccess(`Policy transitioned to ${targetState}`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to transition policy lifecycle");
    }
  };

  // Create Policy Handler
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await agentGovernanceService.createPolicy(orgId, {
        name: newPolicyName,
        policyKey: newPolicyKey,
        description: newPolicyDesc,
        policyType: newPolicyType,
        severity: newPolicySeverity,
        scopeType: newPolicyScope,
        enforcementAction: newPolicyEnforcement,
        rules: { version: "1.0", createdVia: "Governance Center Console" },
      });
      setShowCreatePolicy(false);
      setNewPolicyName("");
      setNewPolicyKey("");
      setNewPolicyDesc("");
      setActionSuccess("Governance policy created successfully");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to create policy");
    }
  };

  // Policy Simulation Handler
  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSimulating(true);
      setError(null);
      const res = await agentGovernanceService.simulatePolicy(orgId, {
        agentId: simAgentId || null,
        toolKey: simToolKey || null,
        action: simAction,
        resourceClassification: simClassification,
        riskTier: simRiskTier,
        autonomyLevel: simAutonomyLevel,
      });
      setSimulationResult(res);
      setActionSuccess("Policy simulation executed in read-only sandbox");
    } catch (err: any) {
      setError(err?.message || "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  // Policy Comparison Handler
  const handleCompareVersions = async (policyId: string) => {
    try {
      setError(null);
      const res = await agentGovernanceService.comparePolicyVersions(orgId, policyId, 1, 2);
      setSelectedPolicyForCompare(policyId);
      setVersionComparison(res);
    } catch (err: any) {
      setError(err?.message || "Failed to compare versions");
    }
  };

  // Upsert Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForProfile) return;
    try {
      setError(null);
      await agentGovernanceService.upsertProfile(orgId, selectedAgentForProfile, {
        securityClassification: profileClassification,
        riskTier: profileRiskTier,
        complianceFrameworks: profileFrameworks.split(",").map((s) => s.trim()).filter(Boolean),
        reviewCadenceDays: profileCadenceDays,
        maxAutonomyLevel: profileMaxAutonomy,
      });
      setSelectedAgentForProfile(null);
      setActionSuccess("Agent governance profile saved");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to save governance profile");
    }
  };

  // Record Review Handler
  const handleRecordReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForReview) return;
    try {
      setError(null);
      await agentGovernanceService.recordReview(orgId, selectedAgentForReview, {
        complianceStatus: reviewStatus,
        notes: reviewNotes,
      });
      setSelectedAgentForReview(null);
      setReviewNotes("");
      setActionSuccess("Compliance review recorded");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to record compliance review");
    }
  };

  // Approval Handlers (Phase 22C)
  const handleOpenApprovalModal = (type: "approve" | "reject" | "escalate", request: WebAgentApprovalRequest) => {
    setApprovalModal({ type, request });
    setModalJustification("");
    setModalReason("");
    setModalEscalationContact("");
  };

  const handleSubmitApprovalDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvalModal) return;
    try {
      setError(null);
      const { type, request } = approvalModal;
      if (type === "approve") {
        await agentGovernanceService.approveRequest(orgId, request.id, modalJustification, modalReason);
        setActionSuccess(`Request '${request.id.slice(0, 8)}' approved successfully`);
      } else if (type === "reject") {
        await agentGovernanceService.rejectRequest(orgId, request.id, modalJustification, modalReason);
        setActionSuccess(`Request '${request.id.slice(0, 8)}' rejected`);
      } else if (type === "escalate") {
        await agentGovernanceService.escalateRequest(orgId, request.id, modalReason || "Escalated for senior review", modalEscalationContact || undefined);
        setActionSuccess(`Request '${request.id.slice(0, 8)}' escalated`);
      }
      setApprovalModal(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to submit approval decision");
    }
  };

  const handleContinueExecution = async (request: WebAgentApprovalRequest) => {
    try {
      setError(null);
      setContinuationLoading((prev) => ({ ...prev, [request.id]: true }));
      const res = await agentGovernanceService.continueApprovedExecution(orgId, request.id);
      setContinuationResult((prev) => ({ ...prev, [request.id]: JSON.stringify(res.continuation?.executionResult || res.continuation, null, 2) }));
      setActionSuccess(`Approved execution resumed successfully for '${request.actionTarget}'`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to continue approved execution");
    } finally {
      setContinuationLoading((prev) => ({ ...prev, [request.id]: false }));
    }
  };

  const handleSweepExpiredApprovals = async () => {
    try {
      setError(null);
      const res = await agentGovernanceService.sweepExpiredApprovals(orgId);
      setActionSuccess(`Expired ${res.expiredCount} pending approval request(s)`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to sweep expired requests");
    }
  };

  const handleViewApprovalDetails = async (approvalId: string) => {
    try {
      setError(null);
      const details = await agentGovernanceService.getApprovalDetails(orgId, approvalId);
      setSelectedApprovalDetails(details);
    } catch (err: any) {
      setError(err?.message || "Failed to load approval details");
    }
  };

  // Security Controls Handlers (Phase 22D)
  const handleTriggerEmergencyStop = async () => {
    try {
      setError(null);
      await agentGovernanceService.triggerEmergencyStop(orgId, undefined, emergencyStopReason || "Administrative Emergency Stop");
      setShowEmergencyStopModal(false);
      setEmergencyStopReason("");
      setActionSuccess("Emergency Stop activated across organization agents");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to trigger emergency stop");
    }
  };

  const handleResumeEmergencyStop = async () => {
    try {
      setError(null);
      await agentGovernanceService.resumeEmergencyStop(orgId);
      setActionSuccess("Emergency Stop lifted. Normal agent operations resumed");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to resume emergency stop");
    }
  };

  const handleSuspendAgent = async () => {
    if (!suspendingAgentId || !suspensionReasonInput) return;
    try {
      setError(null);
      await agentGovernanceService.suspendAgent(orgId, suspendingAgentId, suspensionReasonInput);
      setSuspendingAgentId(null);
      setSuspensionReasonInput("");
      setActionSuccess(`Agent '${suspendingAgentId}' suspended successfully`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to suspend agent");
    }
  };

  const handleReactivateAgent = async (agentId: string) => {
    try {
      setError(null);
      await agentGovernanceService.reactivateAgent(orgId, agentId);
      setActionSuccess(`Agent '${agentId}' reactivated successfully`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to reactivate agent");
    }
  };

  const handleCreateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretIdent || !newSecretName) return;
    try {
      setError(null);
      await agentGovernanceService.createSecretReference(orgId, {
        secretIdentifier: newSecretIdent,
        name: newSecretName,
        description: newSecretDesc || undefined,
        allowedAgentIds: newSecretAgents ? newSecretAgents.split(",").map((s) => s.trim()).filter(Boolean) : [],
        allowedToolKeys: newSecretTools ? newSecretTools.split(",").map((s) => s.trim()).filter(Boolean) : [],
        initialValue: newSecretVal || undefined,
      });
      setShowCreateSecretModal(false);
      setNewSecretIdent("");
      setNewSecretName("");
      setNewSecretDesc("");
      setNewSecretAgents("");
      setNewSecretTools("");
      setNewSecretVal("");
      setActionSuccess(`Secret reference '${newSecretIdent}' created`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to create secret reference");
    }
  };

  const handleRevokeSecret = async (secretId: string) => {
    try {
      setError(null);
      await agentGovernanceService.revokeSecretReference(orgId, secretId);
      setActionSuccess("Secret reference revoked");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to revoke secret reference");
    }
  };

  const handleRotateSecret = async (secretId: string) => {
    const newVal = prompt("Enter new synthetic credential value (optional, stored in secure backend vault):");
    try {
      setError(null);
      await agentGovernanceService.rotateSecretReference(orgId, secretId, newVal || undefined);
      setActionSuccess("Secret reference rotated to new version");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to rotate secret reference");
    }
  };

  // Save Ownership Handler
  const handleSaveOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForOwnership) return;
    try {
      setError(null);
      await agentGovernanceService.assignOwnership(orgId, selectedAgentForOwnership, {
        primaryOwnerId: ownerPrimary,
        technicalOwnerId: ownerTech || null,
        businessOwnerId: ownerBiz || null,
        escalationContact: ownerEscalation,
      });
      setSelectedAgentForOwnership(null);
      setOwnerPrimary("");
      setOwnerTech("");
      setOwnerBiz("");
      setOwnerEscalation("");
      setActionSuccess("Agent ownership updated");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to assign ownership");
    }
  };

  // Compliance Handlers (Phase 22E)
  const handleVerifyChain = async () => {
    try {
      setVerifyingChain(true);
      setError(null);
      const res = await agentGovernanceService.verifyAuditIntegrity(orgId);
      setAuditChainVerification(res);
      setActionSuccess("Cryptographic audit integrity verification completed");
    } catch (err: any) {
      setError(err?.message || "Audit verification failed");
    } finally {
      setVerifyingChain(false);
    }
  };

  const handleVerifyControlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyControlModal) return;
    try {
      setError(null);
      await agentGovernanceService.verifyComplianceControl(orgId, verifyControlModal.id, {
        status: verifyControlStatus,
        exceptions: verifyControlExceptions || undefined,
      });
      setVerifyControlModal(null);
      setActionSuccess(`Control '${verifyControlModal.controlKey}' updated to ${verifyControlStatus}`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to update control verification");
    }
  };

  const handleCollectEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvidenceTitle || !newEvidenceSource) return;
    try {
      setError(null);
      let payload = {};
      try {
        payload = JSON.parse(newEvidencePayload);
      } catch {
        payload = { text: newEvidencePayload };
      }
      await agentGovernanceService.collectEvidence(orgId, {
        title: newEvidenceTitle,
        evidenceType: newEvidenceType,
        source: newEvidenceSource,
        classification: newEvidenceClass,
        structuredPayload: payload,
      });
      setShowCollectEvidenceModal(false);
      setNewEvidenceTitle("");
      setActionSuccess("Compliance evidence collected and cryptographically hashed");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to collect evidence");
    }
  };

  const handleCreateHoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoldName || !newHoldReason) return;
    try {
      setError(null);
      await agentGovernanceService.createLegalHold(orgId, {
        name: newHoldName,
        reason: newHoldReason,
        scopeType: newHoldScope,
      });
      setShowCreateHoldModal(false);
      setNewHoldName("");
      setNewHoldReason("");
      setActionSuccess("Legal hold activated. Affected records are now protected from retention disposal.");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to create legal hold");
    }
  };

  const handleReleaseHold = async (holdIdentifier: string) => {
    const just = prompt("Enter mandatory justification for releasing this legal hold:");
    if (!just) return;
    try {
      setError(null);
      await agentGovernanceService.releaseLegalHold(orgId, holdIdentifier, just);
      setActionSuccess(`Legal hold '${holdIdentifier}' released`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to release legal hold");
    }
  };

  const handleCreateInvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvTitle) return;
    try {
      setError(null);
      await agentGovernanceService.createInvestigation(orgId, {
        title: newInvTitle,
        description: newInvDesc || undefined,
      });
      setShowCreateInvModal(false);
      setNewInvTitle("");
      setNewInvDesc("");
      setActionSuccess("Investigation case opened");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to create investigation case");
    }
  };

  const handlePreviewDisposal = async () => {
    try {
      setError(null);
      const res = await agentGovernanceService.previewDisposal(orgId);
      setDisposalPreviewData(res);
      setActionSuccess("Dry-run disposal preview generated");
    } catch (err: any) {
      setError(err?.message || "Failed to preview disposal");
    }
  };

  const handleViewTimeline = async (inv: WebComplianceInvestigation) => {
    try {
      setError(null);
      const res = await agentGovernanceService.getInvestigationTimeline(orgId, {});
      setInvestigationTimelineData({ caseNumber: inv.caseNumber, timeline: res.timeline });
    } catch (err: any) {
      setError(err?.message || "Failed to load timeline");
    }
  };

  const handleExportPackageSubmit = async () => {
    if (complianceEvidenceList.length === 0) {
      setError("No evidence items available to export");
      return;
    }
    try {
      setError(null);
      const evidenceIds = complianceEvidenceList.slice(0, 10).map((e) => e.id);
      await agentGovernanceService.generateEvidencePackage(orgId, {
        evidenceIds,
      });
      setShowExportPackageModal(false);
      setActionSuccess("Evidence package generated with SHA-256 manifest");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to export package");
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Enterprise Agent Governance & Security
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
              Phase 22B Policy Engine
            </span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Deterministic policy evaluation, runtime enforcement boundaries, simulation sandbox, and audit verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Enforcement Mode Selector */}
          <div className="flex items-center gap-2 bg-card/80 border border-border/70 rounded-lg p-1.5 px-3">
            <span className="text-[10px] font-mono uppercase text-muted-foreground mr-1">
              Mode:
            </span>
            <select
              value={enforcementMode}
              onChange={(e) => handleChangeEnforcementMode(e.target.value as GovernanceEnforcementMode)}
              className="text-xs bg-background border border-input rounded px-2 py-1 font-semibold text-foreground"
            >
              <option value="MONITOR">MONITOR (Telemetry & Audit)</option>
              <option value="ENFORCE">ENFORCE (Active Enforcement)</option>
              <option value="DISABLED">DISABLED (Legacy)</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreatePolicy(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            + New Policy
          </Button>
        </div>
      </div>

      {/* Mode Guidance Alert Banner */}
      <div
        className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
          enforcementMode === "ENFORCE"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            : enforcementMode === "MONITOR"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
            : "border-zinc-500/40 bg-zinc-500/10 text-zinc-400"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider font-mono">
            Mode: {enforcementMode}
          </span>
          <span>
            {enforcementMode === "ENFORCE"
              ? "— Authoritative runtime blocking and approval gates active."
              : enforcementMode === "MONITOR"
              ? "— Safe rollout: Policies are evaluated and audited passively without runtime blocking."
              : "— Governance policies bypassed; platform baseline security restrictions remain active."}
          </span>
        </div>
        <span className="font-mono text-[11px] opacity-80">Precedence: Mandatory &gt; Deny &gt; Approval &gt; Allow</span>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-semibold underline ml-2">
            Dismiss
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-sm flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-xs font-semibold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GovernanceOverviewMetricCard
          title="Governed Agents"
          value={overview?.totalProfiles ?? profiles.length}
          subtitle="Agents with assigned profiles"
          badge={<span className="text-[10px] font-mono text-muted-foreground">Active</span>}
        />
        <GovernanceOverviewMetricCard
          title="Active Policies"
          value={overview?.activePolicies ?? policies.filter((p) => p.lifecycleState === "active").length}
          subtitle={`Total: ${overview?.totalPolicies ?? policies.length} registered`}
          badge={<PolicyLifecycleBadge state="active" />}
        />
        <GovernanceOverviewMetricCard
          title="Accountability Coverage"
          value={
            overview
              ? `${Math.max(0, overview.totalProfiles - overview.orphanedAgents)}/${overview.totalProfiles || 1}`
              : `${ownershipList.length} Assigned`
          }
          subtitle={`${overview?.orphanedAgents ?? 0} orphaned agents`}
          badge={
            (overview?.orphanedAgents ?? 0) > 0 ? (
              <span className="text-[11px] font-semibold text-amber-400">Action Required</span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-400">100% Assigned</span>
            )
          }
        />
        <GovernanceOverviewMetricCard
          title="Policy Decisions"
          value={decisionHistory.length}
          subtitle="Recorded evaluation events"
          badge={<span className="text-[10px] font-mono text-muted-foreground">Audit Ledger</span>}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border/50 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview & Risk
        </button>
        <button
          onClick={() => setActiveTab("policies")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "policies"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Policy Registry ({policies.length})
        </button>
        <button
          onClick={() => setActiveTab("simulation")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "simulation"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Policy Simulation Sandbox
        </button>
        <button
          onClick={() => setActiveTab("decisions")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "decisions"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Decision Stream ({decisionHistory.length})
        </button>
        <button
          onClick={() => setActiveTab("approvals")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "approvals"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Human Approvals</span>
          {approvals.filter((a) => a.status === "pending").length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {approvals.filter((a) => a.status === "pending").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "security"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Security Controls</span>
          {securityPosture?.isEmergencyStopped ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              STOPPED
            </span>
          ) : (securityPosture?.suspendedAgentsCount ?? 0) > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {securityPosture?.suspendedAgentsCount} Suspended
            </span>
          ) : null}
        </button>
        <button
          onClick={() => setActiveTab("compliance")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === "compliance"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Compliance & Audit</span>
          {complianceOverview && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
              {complianceOverview.frameworkCoveragePercent}%
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("profiles")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "profiles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Agent Profiles ({profiles.length})
        </button>
        <button
          onClick={() => setActiveTab("ownership")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "ownership"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Ownership ({ownershipList.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`pb-3 px-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Audit Ledger ({auditLogs.length})
        </button>
      </div>

      {/* Tab 1: Overview & Risk Posture */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Risk Tier Posture */}
            <Card className="p-6 bg-card/60 border-border/80">
              <h3 className="text-base font-semibold text-foreground mb-1">
                Risk Tier Distribution
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Classification of autonomous agents by operational risk.
              </p>

              <div className="space-y-3">
                {[
                  { tier: "critical", label: "Critical Risk", color: "bg-rose-500", count: overview?.riskTierDistribution?.critical ?? 0 },
                  { tier: "high", label: "High Risk", color: "bg-amber-500", count: overview?.riskTierDistribution?.high ?? 0 },
                  { tier: "medium", label: "Medium Risk", color: "bg-blue-500", count: overview?.riskTierDistribution?.medium ?? 0 },
                  { tier: "low", label: "Low Risk", color: "bg-emerald-500", count: overview?.riskTierDistribution?.low ?? 0 },
                ].map((item) => (
                  <div key={item.tier} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${item.color}`} />
                      <span className="text-muted-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground">{item.count}</span>
                      <GovernanceRiskBadge riskTier={item.tier} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Compliance Distribution */}
            <Card className="p-6 bg-card/60 border-border/80">
              <h3 className="text-base font-semibold text-foreground mb-1">
                Compliance Status Breakdown
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Regulatory compliance adherence across frameworks (SOC2, HIPAA, GDPR).
              </p>

              <div className="space-y-3">
                {[
                  { status: "compliant", label: "Compliant", count: overview?.complianceDistribution?.compliant ?? 0 },
                  { status: "pending_review", label: "Pending Review", count: overview?.complianceDistribution?.pending_review ?? 0 },
                  { status: "non_compliant", label: "Non-Compliant", count: overview?.complianceDistribution?.non_compliant ?? 0 },
                  { status: "exempt", label: "Exempt", count: overview?.complianceDistribution?.exempt ?? 0 },
                ].map((item) => (
                  <div key={item.status} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-foreground">{item.count}</span>
                      <ComplianceStatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Policy Registry */}
      {activeTab === "policies" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {policies.length} governance policies defined across the organization.
            </span>
          </div>

          {policies.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No governance policies defined yet.</p>
              <Button size="sm" className="mt-3" onClick={() => setShowCreatePolicy(true)}>
                Create First Policy
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map((p) => (
                <div key={p.id} className="relative">
                  <PolicyInventoryCard
                    id={p.id}
                    name={p.name}
                    policyKey={p.policyKey}
                    policyType={p.policyType}
                    scopeType={p.scopeType}
                    severity={p.severity}
                    enforcementAction={p.enforcementAction}
                    lifecycleState={p.lifecycleState}
                    currentVersion={p.currentVersion}
                    description={p.description}
                    rulesCount={Object.keys(p.rules || {}).length}
                    onTransitionState={(newState) => handleTransitionPolicy(p.id, newState)}
                    onView={() => handleCompareVersions(p.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Policy Simulation Sandbox */}
      {activeTab === "simulation" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 bg-card/70 border-border/70 space-y-4">
            <div>
              <h3 className="font-semibold text-base text-foreground">Policy Decision Simulator</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simulate hypothetical execution requests in a read-only sandbox without executing any actions.
              </p>
            </div>

            <form onSubmit={handleRunSimulation} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Target Agent ID (Optional)</label>
                <Input
                  placeholder="e.g. agent-academic-advisor-001"
                  value={simAgentId}
                  onChange={(e) => setSimAgentId(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Tool Key (Optional)</label>
                <Input
                  placeholder="e.g. education.curriculum.generate"
                  value={simToolKey}
                  onChange={(e) => setSimToolKey(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Action Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={simAction}
                    onChange={(e) => setSimAction(e.target.value)}
                  >
                    <option value="tool_invocation">Tool Invocation</option>
                    <option value="agent_execution">Agent Execution</option>
                    <option value="multi_agent_delegation">Multi-Agent Delegation</option>
                    <option value="autonomous_task">Autonomous Continuous Task</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Autonomy Level</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={simAutonomyLevel}
                    onChange={(e) => setSimAutonomyLevel(Number(e.target.value))}
                  >
                    <option value={0}>L0 (Read Only)</option>
                    <option value={1}>L1 (Assisted)</option>
                    <option value={2}>L2 (Supervised)</option>
                    <option value={3}>L3 (Autonomous Continuous)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Data Classification</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={simClassification}
                    onChange={(e) => setSimClassification(e.target.value)}
                  >
                    <option value="public">Public</option>
                    <option value="internal">Internal</option>
                    <option value="confidential">Confidential</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Risk Tier</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={simRiskTier}
                    onChange={(e) => setSimRiskTier(e.target.value)}
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                    <option value="critical">Critical Risk</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={simulating} className="w-full">
                  {simulating ? "Evaluating..." : "Run Policy Simulation"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Simulation Output Panel */}
          <Card className="p-6 bg-card/70 border-border/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
                <h3 className="font-semibold text-base text-foreground">Simulation Outcome</h3>
                {simulationResult && (
                  <span
                    className={`font-bold font-mono px-2.5 py-1 rounded text-xs ${
                      simulationResult.decision === "ALLOW"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : simulationResult.decision === "REQUIRE_APPROVAL"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {simulationResult.decision}
                  </span>
                )}
              </div>

              {!simulationResult ? (
                <div className="text-center py-16 text-muted-foreground text-xs border border-dashed border-border/50 rounded-lg">
                  Submit simulation parameters to inspect policy decision path and precedence trace.
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/40 space-y-1.5">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                      Precedence Hierarchy
                    </span>
                    <span className="font-medium text-foreground block">
                      {simulationResult.precedenceDescription}
                    </span>
                    <span className="text-muted-foreground block">
                      Reason: <strong className="text-foreground">{simulationResult.reasonCode}</strong> — {simulationResult.reasonDetails}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-muted/20 rounded-lg border border-border/30">
                      <span className="text-[10px] uppercase text-muted-foreground block font-mono">
                        Active Mode Execution
                      </span>
                      <span className="font-semibold text-foreground capitalize mt-1 block">
                        Effective: {simulationResult.effectiveDecision}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Under mode: {simulationResult.enforcementMode}
                      </span>
                    </div>

                    <div className="p-3 bg-muted/20 rounded-lg border border-border/30">
                      <span className="text-[10px] uppercase text-muted-foreground block font-mono">
                        Approval Required
                      </span>
                      <span className="font-semibold text-foreground mt-1 block">
                        {simulationResult.wouldRequireHumanApproval ? "YES (Sign-off Needed)" : "NO"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
                      Matched Policies ({simulationResult.matchedPolicies.length})
                    </span>
                    {simulationResult.matchedPolicies.length === 0 ? (
                      <span className="text-muted-foreground italic">None (Default baseline applied)</span>
                    ) : (
                      <div className="space-y-1.5">
                        {simulationResult.matchedPolicies.map((m, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded bg-card/80 border border-border/60 flex items-center justify-between"
                          >
                            <span className="font-mono text-foreground">{m.policyKey}</span>
                            <span className="text-muted-foreground capitalize">{m.enforcementAction}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {simulationResult && (
              <div className="pt-4 border-t border-border/40 text-[10px] font-mono text-muted-foreground flex justify-between">
                <span>Correlation: {simulationResult.correlationId}</span>
                <span>Timestamp: {new Date(simulationResult.simulatedAt).toLocaleTimeString()}</span>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 4: Decision Stream */}
      {activeTab === "decisions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing runtime policy evaluation decisions and simulation queries.
            </span>
          </div>

          <GovernanceAuditLogTable
            logs={decisionHistory.map((l) => ({
              id: l.id,
              action: l.action,
              targetType: l.targetType,
              targetId: l.targetId,
              actorId: l.actorId,
              createdAt: l.createdAt,
              metadata: l.metadata,
            }))}
          />
        </div>
      )}

      {/* Tab: Human Approvals */}
      {activeTab === "approvals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filter status:</span>
              {["all", "pending", "approved", "rejected", "consumed", "expired"].map((f) => (
                <button
                  key={f}
                  onClick={() => setApprovalFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                    approvalFilter === f
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={handleSweepExpiredApprovals}>
              Sweep Expired
            </Button>
          </div>

          {approvals.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No approval requests generated yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvals
                .filter((a) => (approvalFilter === "all" ? true : a.status === approvalFilter))
                .map((req) => (
                  <Card key={req.id} className="p-4 bg-card border-border/80 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{req.actionTarget}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-muted/60 text-muted-foreground">
                          {req.actionType}
                        </span>
                        <GovernanceRiskBadge riskTier={(req.riskClassification || "medium") as any} />
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            req.status === "approved"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : req.status === "pending"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : req.status === "consumed"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{req.approvalReason}</p>
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground/80 font-mono">
                        <span>Agent: {req.agentId}</span>
                        <span>Requester: {req.requestingActorId}</span>
                        <span>Expires: {new Date(req.expiresAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleViewApprovalDetails(req.id)}>
                        Details
                      </Button>
                      {req.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => handleOpenApprovalModal("approve", req)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleOpenApprovalModal("reject", req)}>
                            Reject
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleOpenApprovalModal("escalate", req)}>
                            Escalate
                          </Button>
                        </>
                      )}
                      {req.status === "approved" && (
                        <Button
                          size="sm"
                          disabled={continuationLoading[req.id]}
                          onClick={() => handleContinueExecution(req)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          {continuationLoading[req.id] ? "Resuming..." : "Resume Execution"}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Security Controls (Phase 22D) */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* Emergency Stop Banner */}
          {securityPosture?.isEmergencyStopped ? (
            <div className="p-4 rounded-xl bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                  <h4 className="font-bold text-rose-300 text-sm tracking-wide uppercase">
                    Emergency Stop Active
                  </h4>
                </div>
                <p className="text-xs text-rose-200/90">
                  All autonomous tasks, agent runtimes, and tool execution gateways have been halted across the organization.
                </p>
                {securityPosture.emergencyStoppedBy && (
                  <span className="text-[10px] text-rose-300/70 font-mono">
                    Triggered by: {securityPosture.emergencyStoppedBy} at {new Date(securityPosture.emergencyStoppedAt || "").toLocaleString()}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/30"
                onClick={handleResumeEmergencyStop}
              >
                Resume Normal Operations
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-bold text-foreground text-sm">Security Controls & Kill Switch</h4>
                <p className="text-xs text-muted-foreground">
                  Enforces sandboxing, least-privilege capabilities, secret isolation, and real-time execution termination.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-rose-500/40 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 font-semibold"
                onClick={() => setShowEmergencyStopModal(true)}
              >
                Trigger Emergency Stop
              </Button>
            </div>
          )}

          {/* Posture Overview Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-card border-border/80">
              <span className="text-xs text-muted-foreground font-medium block mb-1">Posture Status</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold uppercase px-2 py-0.5 rounded ${
                    securityPosture?.overallStatus === "HEALTHY"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : securityPosture?.overallStatus === "EMERGENCY_STOPPED"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {securityPosture?.overallStatus || "HEALTHY"}
                </span>
              </div>
            </Card>
            <Card className="p-4 bg-card border-border/80">
              <span className="text-xs text-muted-foreground font-medium block mb-1">Active / Suspended Agents</span>
              <div className="text-xl font-bold text-foreground flex items-center gap-2">
                <span className="text-emerald-400">{securityPosture?.activeAgentsCount ?? securityProfiles.filter((p) => !p.isSuspended).length}</span>
                <span className="text-muted-foreground text-sm">/</span>
                <span className="text-rose-400">{securityPosture?.suspendedAgentsCount ?? securityProfiles.filter((p) => p.isSuspended).length}</span>
              </div>
            </Card>
            <Card className="p-4 bg-card border-border/80">
              <span className="text-xs text-muted-foreground font-medium block mb-1">Secret References</span>
              <div className="text-xl font-bold text-foreground flex items-center gap-2">
                <span className="text-emerald-400">{securityPosture?.activeSecretReferencesCount ?? secretReferences.filter((s) => s.status === "active").length}</span>
                <span className="text-muted-foreground text-xs font-normal">Active (Zero Raw Values)</span>
              </div>
            </Card>
            <Card className="p-4 bg-card border-border/80">
              <span className="text-xs text-muted-foreground font-medium block mb-1">Security Events (24h)</span>
              <div className="text-xl font-bold text-foreground flex items-center gap-2">
                <span>{securityPosture?.securityEventsCount24h ?? securityEvents.length}</span>
                {(securityPosture?.criticalEventsCount24h ?? 0) > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {securityPosture?.criticalEventsCount24h} Critical
                  </span>
                )}
              </div>
            </Card>
          </div>

          {/* Sub-Section 1: Agent Security Profiles & Sandboxing */}
          <Card className="p-5 bg-card border-border/80 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-base text-foreground">Agent Capabilities & Sandboxing Profiles</h3>
                <span className="text-xs text-muted-foreground">
                  Enforce network allowlists, filesystem boundaries, autonomy ceilings, and suspension controls per agent.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const agentId = prompt("Enter Agent ID to configure capability profile:");
                  if (agentId) {
                    const existing = securityProfiles.find((p) => p.agentId === agentId);
                    setSelectedAgentForSecurity(
                      existing || {
                        id: "",
                        organizationId: orgId,
                        workspaceId: null,
                        agentId,
                        resourceClassification: "INTERNAL",
                        networkAccessMode: "BLOCKED",
                        allowedNetworkDomains: [],
                        disallowedNetworkDomains: [],
                        storageAccessMode: "BLOCKED",
                        allowedStoragePaths: [],
                        disallowedStoragePaths: [],
                        databaseOperations: ["READ"],
                        maxExecutionDurationMs: 30000,
                        maxToolInvocations: 10,
                        maxMemoryBytes: 536870912,
                        maxAutonomyLevel: "L1",
                        allowAutonomousExecution: false,
                        delegationAttenuation: true,
                        allowedToolKeys: [],
                        disallowedToolKeys: [],
                        allowedSecretReferenceIds: [],
                        isSuspended: false,
                        suspendedAt: null,
                        suspendedBy: null,
                        suspensionReason: null,
                        metadata: {},
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      },
                    );
                  }
                }}
              >
                + Configure Capabilities
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Agent</th>
                    <th className="py-2 px-3">Network Mode</th>
                    <th className="py-2 px-3">Storage Mode</th>
                    <th className="py-2 px-3">Autonomy</th>
                    <th className="py-2 px-3">Max Budget</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {securityProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">
                        No security capability profiles configured. Agents use default restricted sandbox.
                      </td>
                    </tr>
                  ) : (
                    securityProfiles.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono font-medium text-foreground">
                          {p.agentId}
                          <span className="block text-[10px] text-muted-foreground uppercase font-sans">
                            {p.resourceClassification}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[11px] font-semibold">{p.networkAccessMode}</span>
                          {p.allowedNetworkDomains.length > 0 && (
                            <span className="block text-[10px] text-muted-foreground">
                              {p.allowedNetworkDomains.join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">{p.storageAccessMode}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-muted/60 text-foreground">
                            {p.maxAutonomyLevel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">
                          {p.maxExecutionDurationMs / 1000}s · {p.maxToolInvocations} tools
                        </td>
                        <td className="py-2.5 px-3">
                          {p.isSuspended ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Suspended
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setSelectedAgentForSecurity(p)}
                          >
                            Edit
                          </Button>
                          {p.isSuspended ? (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                              onClick={() => handleReactivateAgent(p.agentId)}
                            >
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-rose-400 border-rose-500/40 hover:bg-rose-500/20"
                              onClick={() => setSuspendingAgentId(p.agentId)}
                            >
                              Suspend
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Sub-Section 2: Secret References Inventory */}
          <Card className="p-5 bg-card border-border/80 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-base text-foreground">Secret Reference Inventory</h3>
                <span className="text-xs text-muted-foreground">
                  Opaque identifiers mapped to backend credentials. Raw secrets are NEVER stored in DB or exposed via UI.
                </span>
              </div>
              <Button size="sm" onClick={() => setShowCreateSecretModal(true)}>
                + Register Secret Reference
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Identifier</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Allowed Agents</th>
                    <th className="py-2 px-3">Version</th>
                    <th className="py-2 px-3">Last Rotated</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {secretReferences.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">
                        No secret references registered for this organization.
                      </td>
                    </tr>
                  ) : (
                    secretReferences.map((sec) => (
                      <tr key={sec.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                          {sec.secretIdentifier}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{sec.name}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {sec.allowedAgentIds.length === 0 ? "All" : sec.allowedAgentIds.join(", ")}
                        </td>
                        <td className="py-2.5 px-3 font-mono">v{sec.version}</td>
                        <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                          {sec.lastRotatedAt ? new Date(sec.lastRotatedAt).toLocaleDateString() : "Never"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              sec.status === "active"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {sec.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1.5">
                          {sec.status === "active" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => handleRotateSecret(sec.id)}
                              >
                                Rotate
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-rose-400 border-rose-500/40 hover:bg-rose-500/20"
                                onClick={() => handleRevokeSecret(sec.id)}
                              >
                                Revoke
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Sub-Section 3: Security Events Audit Stream */}
          <Card className="p-5 bg-card border-border/80 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-base text-foreground">Security Audit Events Stream</h3>
                <span className="text-xs text-muted-foreground">
                  Immutable event stream for suspensions, kill switches, capability denials, injection attempts, and continuation bypasses.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={loadData}>
                Refresh Events
              </Button>
            </div>

            <div className="space-y-2">
              {securityEvents.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  No security incidents or enforcement events recorded.
                </div>
              ) : (
                securityEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            evt.severity === "critical"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : evt.severity === "high"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-muted/60 text-muted-foreground"
                          }`}
                        >
                          {evt.severity}
                        </span>
                        <span className="font-bold text-foreground font-mono">{evt.eventType}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground font-mono">{evt.targetType}: {evt.targetId}</span>
                      </div>
                      <p className="text-muted-foreground text-[11px] font-mono">
                        {JSON.stringify(evt.details)}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Compliance & Audit (Phase 22E) */}
      {activeTab === "compliance" && (
        <div className="space-y-6">
          {/* Sub-Navigation Pills */}
          <div className="flex items-center gap-2 border-b border-border/40 pb-3 overflow-x-auto">
            {[
              { id: "overview", label: "Overview & Frameworks" },
              { id: "controls", label: `Controls & Mapping (${complianceControls.length})` },
              { id: "audit", label: "Audit Ledger & Integrity" },
              { id: "evidence", label: `Evidence & Packages (${complianceEvidenceList.length})` },
              { id: "holds", label: `Legal Holds & Retention (${legalHolds.length})` },
              { id: "investigations", label: `Investigations (${investigations.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setComplianceSubTab(tab.id as any)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  complianceSubTab === tab.id
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "bg-card/60 text-muted-foreground hover:text-foreground border border-border/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-Tab 1: Overview & Frameworks */}
          {complianceSubTab === "overview" && (
            <div className="space-y-6">
              {/* Compliance Posture Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <GovernanceOverviewMetricCard
                  title="Framework Coverage"
                  value={`${complianceOverview?.frameworkCoveragePercent ?? 0}%`}
                  subtitle="Implemented controls"
                  badge={<span className="text-[10px] font-mono text-emerald-400">Target: 100%</span>}
                />
                <GovernanceOverviewMetricCard
                  title="Total Controls"
                  value={complianceOverview?.totalControls ?? complianceControls.length}
                  subtitle={`${complianceOverview?.verifiedControls ?? 0} verified`}
                  badge={<span className="text-[10px] font-mono text-muted-foreground">Across Frameworks</span>}
                />
                <GovernanceOverviewMetricCard
                  title="Evidence Items"
                  value={complianceOverview?.totalEvidenceCount ?? complianceEvidenceList.length}
                  subtitle={`${complianceOverview?.totalPackagesCount ?? evidencePackages.length} packages`}
                  badge={<span className="text-[10px] font-mono text-blue-400">Hashed</span>}
                />
                <GovernanceOverviewMetricCard
                  title="Active Legal Holds"
                  value={complianceOverview?.activeHoldsCount ?? legalHolds.filter((h) => h.status === "ACTIVE").length}
                  subtitle="Retention override"
                  badge={
                    (complianceOverview?.activeHoldsCount ?? 0) > 0 ? (
                      <span className="text-[10px] font-mono text-amber-400">Protected</span>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground">Standard</span>
                    )
                  }
                />
                <GovernanceOverviewMetricCard
                  title="Audit Chain Status"
                  value={complianceOverview?.auditIntegrityStatus.isValid ? "VERIFIED" : "VERIFY NOW"}
                  subtitle={`${complianceOverview?.auditIntegrityStatus.totalEvents ?? 0} events`}
                  badge={
                    complianceOverview?.auditIntegrityStatus.isValid ? (
                      <span className="text-[10px] font-mono text-emerald-400">SHA-256 Valid</span>
                    ) : (
                      <span className="text-[10px] font-mono text-amber-400">Pending</span>
                    )
                  }
                />
              </div>

              {/* Disclaimer Banner */}
              <div className="p-4 rounded-xl border border-border/70 bg-card/60 text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <span className="text-primary font-bold">ℹ</span> Compliance & Governance Disclaimer
                </span>
                <p>
                  HAZA-AIOS compliance frameworks and control mappings provide continuous internal governance, tamper-evident audit trails, and evidence management. They do not constitute formal legal certification or external audit attestation. Verification requires explicit authorized human review.
                </p>
              </div>

              {/* Frameworks Grid */}
              <div className="space-y-3">
                <h3 className="font-semibold text-base text-foreground">Standard Compliance Frameworks</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {complianceFrameworks.map((fw) => {
                    const fwControls = complianceControls.filter((c) => c.frameworkId === fw.id);
                    const implementedCount = fwControls.filter(
                      (c) => c.implementationStatus === "IMPLEMENTED" || c.implementationStatus === "VERIFIED",
                    ).length;
                    const coverage = fwControls.length > 0 ? Math.round((implementedCount / fwControls.length) * 100) : 0;

                    return (
                      <Card key={fw.id} className="p-5 bg-card border-border/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                              {fw.frameworkKey.toUpperCase()}
                            </span>
                            <h4 className="font-semibold text-sm text-foreground">{fw.name}</h4>
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground">v{fw.version}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{fw.description}</p>
                        <div className="space-y-1.5 pt-2 border-t border-border/40">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Control Implementation</span>
                            <span className="font-mono font-bold text-foreground">
                              {implementedCount}/{fwControls.length} ({coverage}%)
                            </span>
                          </div>
                          <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-300"
                              style={{ width: `${coverage}%` }}
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Controls & Mapping */}
          {complianceSubTab === "controls" && (
            <Card className="p-5 bg-card border-border/80 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div>
                  <h3 className="font-semibold text-base text-foreground">Compliance Control Registry</h3>
                  <span className="text-xs text-muted-foreground">
                    Mapped platform controls with review cadence, verification records, and exceptions.
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={loadData}>
                  Refresh Controls
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider font-mono">
                    <tr>
                      <th className="py-2.5 px-3">Control Key</th>
                      <th className="py-2.5 px-3">Title & Category</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Review Frequency</th>
                      <th className="py-2.5 px-3">Verification</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {complianceControls.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-muted-foreground">
                          No controls mapped yet.
                        </td>
                      </tr>
                    ) : (
                      complianceControls.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-3 font-bold text-foreground">{c.controlKey}</td>
                          <td className="py-3 px-3 font-sans">
                            <div className="font-semibold text-foreground">{c.title}</div>
                            <span className="text-[11px] text-muted-foreground">{c.category}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                c.implementationStatus === "VERIFIED"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : c.implementationStatus === "IMPLEMENTED"
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : c.implementationStatus === "EVIDENCE_PENDING"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-zinc-500/20 text-zinc-300 border border-zinc-500/30"
                              }`}
                            >
                              {c.implementationStatus}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">Every {c.reviewFrequencyDays}d</td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {c.verifiedAt ? (
                              <span>{new Date(c.verifiedAt).toLocaleDateString()}</span>
                            ) : (
                              <span className="italic">Unverified</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setVerifyControlModal(c);
                                setVerifyControlStatus(c.implementationStatus);
                                setVerifyControlExceptions(c.exceptions || "");
                              }}
                            >
                              Verify / Review
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Sub-Tab 3: Unified Audit Ledger & Verification */}
          {complianceSubTab === "audit" && (
            <div className="space-y-6">
              {/* Audit Integrity Engine Verification Card */}
              <Card className="p-5 bg-card border-border/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Tamper-Evident Audit Ledger</h3>
                    <span className="text-xs text-muted-foreground">
                      Cryptographically linked SHA-256 hash chain verifying event continuity, payload authenticity, and sequence monotonically.
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleVerifyChain}
                    disabled={verifyingChain}
                    className="bg-primary text-primary-foreground font-semibold"
                  >
                    {verifyingChain ? "Verifying Hash Chain..." : "Run Cryptographic Verification"}
                  </Button>
                </div>

                {auditChainVerification && (
                  <div
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      auditChainVerification.isValid
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="font-mono uppercase text-sm">
                        {auditChainVerification.isValid ? "✓ INTEGRITY VERIFIED (PASS)" : "✗ INTEGRITY VIOLATION DETECTED"}
                      </span>
                      <span className="font-mono text-[11px] opacity-80">
                        {auditChainVerification.verifiedAt}
                      </span>
                    </div>
                    <p className="font-mono">{auditChainVerification.details}</p>
                    <div className="flex items-center gap-4 text-[11px] font-mono pt-1">
                      <span>Total Events: {auditChainVerification.totalEventsVerified}</span>
                      {auditChainVerification.sequenceRange && (
                        <span>
                          Range: Seq {auditChainVerification.sequenceRange.from} → {auditChainVerification.sequenceRange.to}
                        </span>
                      )}
                      <span>Algorithm: SHA-256</span>
                    </div>
                  </div>
                )}
              </Card>

              {/* Audit Events Stream */}
              <Card className="p-5 bg-card border-border/80 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Audit Ledger Stream</h3>
                    <span className="text-xs text-muted-foreground">
                      Normalized compliance events from runtime execution, policy decisions, approvals, and security controls.
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadData}>
                    Refresh Stream
                  </Button>
                </div>

                <div className="space-y-2">
                  {complianceAuditEvents.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      No audit events loaded. Events are recorded continuously upon agent and policy actions.
                    </div>
                  ) : (
                    complianceAuditEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-3 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-primary/20 text-primary border border-primary/30">
                              {evt.eventCategory}
                            </span>
                            <span className="font-bold text-foreground font-mono">{evt.eventType}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground font-mono">Actor: {evt.actorId || "system"}</span>
                          </div>
                          <p className="text-muted-foreground text-[11px] font-mono">
                            {JSON.stringify(evt.redactedMetadata)}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              evt.eventOutcome === "SUCCESS"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {evt.eventOutcome}
                          </span>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {new Date(evt.eventTimestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Sub-Tab 4: Evidence & Packages */}
          {complianceSubTab === "evidence" && (
            <div className="space-y-6">
              {/* Evidence Registry */}
              <Card className="p-5 bg-card border-border/80 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Compliance Evidence Registry</h3>
                    <span className="text-xs text-muted-foreground">
                      Cryptographically hashed execution logs, test outputs, and review records.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowCollectEvidenceModal(true)}>
                      + Collect Evidence
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowExportPackageModal(true)}
                      className="bg-primary text-primary-foreground font-semibold"
                    >
                      Export Evidence Package
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Title & Source</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Classification</th>
                        <th className="py-2.5 px-3">Content Checksum (SHA-256)</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {complianceEvidenceList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-muted-foreground">
                            No evidence items collected yet. Click &quot;+ Collect Evidence&quot; to register a record.
                          </td>
                        </tr>
                      ) : (
                        complianceEvidenceList.map((ev) => (
                          <tr key={ev.id} className="hover:bg-muted/10 transition-colors">
                            <td className="py-3 px-3 font-sans">
                              <div className="font-semibold text-foreground">{ev.title}</div>
                              <span className="text-[11px] text-muted-foreground font-mono">{ev.source}</span>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground uppercase">{ev.evidenceType}</td>
                            <td className="py-3 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted/60 text-muted-foreground">
                                {ev.classification}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                              {ev.contentHash.slice(0, 16)}...
                            </td>
                            <td className="py-3 px-3">
                              {ev.isUnderLegalHold ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  LEGAL HOLD
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                                  VALID
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right text-muted-foreground">
                              {new Date(ev.collectedAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Exported Packages Table */}
              <Card className="p-5 bg-card border-border/80 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Authorized Evidence Packages</h3>
                    <span className="text-xs text-muted-foreground">
                      Self-contained, independently verifiable export manifests with individual checksums and redaction.
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadData}>
                    Refresh Packages
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Package Identifier</th>
                        <th className="py-2.5 px-3">Manifest Checksum</th>
                        <th className="py-2.5 px-3">Evidence Count</th>
                        <th className="py-2.5 px-3">Redaction</th>
                        <th className="py-2.5 px-3 text-right">Exported At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {evidencePackages.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-muted-foreground">
                            No evidence packages exported yet.
                          </td>
                        </tr>
                      ) : (
                        evidencePackages.map((pkg) => (
                          <tr key={pkg.id} className="hover:bg-muted/10 transition-colors">
                            <td className="py-3 px-3 font-bold text-foreground">{pkg.packageIdentifier}</td>
                            <td className="py-3 px-3 text-[11px] text-muted-foreground">
                              {pkg.manifestChecksum.slice(0, 16)}...
                            </td>
                            <td className="py-3 px-3 text-muted-foreground">{pkg.evidenceIds.length} items</td>
                            <td className="py-3 px-3 text-muted-foreground">{pkg.redactionLevel}</td>
                            <td className="py-3 px-3 text-right text-muted-foreground">
                              {new Date(pkg.exportedAt).toLocaleDateString()}
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

          {/* Sub-Tab 5: Legal Holds & Retention */}
          {complianceSubTab === "holds" && (
            <div className="space-y-6">
              {/* Active Legal Holds */}
              <Card className="p-5 bg-card border-border/80 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Active Legal Holds</h3>
                    <span className="text-xs text-muted-foreground">
                      Mandatory preservation holds overriding retention disposal policies for litigation and audit readiness.
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowCreateHoldModal(true)}>
                    + Create Legal Hold
                  </Button>
                </div>

                <div className="space-y-3">
                  {legalHolds.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      No active legal holds. Records follow standard retention policies.
                    </div>
                  ) : (
                    legalHolds.map((h) => (
                      <div
                        key={h.id}
                        className="p-4 rounded-xl border border-border/60 bg-muted/10 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                h.status === "ACTIVE"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-muted/60 text-muted-foreground"
                              }`}
                            >
                              {h.status}
                            </span>
                            <span className="font-bold text-foreground font-mono">{h.holdIdentifier}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="font-semibold text-foreground">{h.name}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{h.reason}</p>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            Scope: {h.scopeType} · Created: {new Date(h.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {h.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReleaseHold(h.holdIdentifier)}
                            className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                          >
                            Release Hold
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Retention Policies & Dry-Run Disposal Preview */}
              <Card className="p-5 bg-card border-border/80 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Record Retention Policies</h3>
                    <span className="text-xs text-muted-foreground">
                      Category-based retention rules with dry-run disposal simulation (zero destructive purge in Phase 22E).
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={handlePreviewDisposal}>
                    Run Dry-Run Disposal Preview
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Record Category</th>
                        <th className="py-2.5 px-3">Retention Duration</th>
                        <th className="py-2.5 px-3">Disposal Action</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {retentionPolicies.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                          <td className="py-3 px-3 font-bold text-foreground">{p.recordCategory}</td>
                          <td className="py-3 px-3 text-muted-foreground">{p.retentionDurationDays} days</td>
                          <td className="py-3 px-3 text-muted-foreground uppercase">{p.disposalAction}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {disposalPreviewData && (
                  <div className="p-4 rounded-xl border border-border/70 bg-card text-xs space-y-2 mt-4 font-mono">
                    <div className="flex items-center justify-between font-bold text-foreground">
                      <span>DRY-RUN DISPOSAL PREVIEW PLAN</span>
                      <span className="text-[11px] text-muted-foreground">
                        {disposalPreviewData.candidateCount} Candidates · {disposalPreviewData.protectedCount} Protected
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Evaluated {disposalPreviewData.policiesEvaluated} retention policies against {disposalPreviewData.activeHoldsCount} active legal holds. Zero database deletion executed.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Sub-Tab 6: Investigations & Timeline */}
          {complianceSubTab === "investigations" && (
            <div className="space-y-6">
              <Card className="p-5 bg-card border-border/80 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <h3 className="font-semibold text-base text-foreground">Audit Investigations & Incident Cases</h3>
                    <span className="text-xs text-muted-foreground">
                      Chronological activity reconstruction linking requests, policy evaluation, approvals, security gates, and tool executions.
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowCreateInvModal(true)}>
                    + Open Investigation Case
                  </Button>
                </div>

                <div className="space-y-3">
                  {investigations.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      No investigation cases open. Click &quot;+ Open Investigation Case&quot; to begin.
                    </div>
                  ) : (
                    investigations.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-4 rounded-xl border border-border/60 bg-muted/10 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-primary/20 text-primary border border-primary/30">
                              {inv.status}
                            </span>
                            <span className="font-bold text-foreground font-mono">{inv.caseNumber}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="font-semibold text-foreground">{inv.title}</span>
                          </div>
                          {inv.description && <p className="text-muted-foreground text-xs">{inv.description}</p>}
                          <div className="text-[11px] text-muted-foreground font-mono">
                            Notes: {inv.notes.length} · Opened: {new Date(inv.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewTimeline(inv)}>
                            View Timeline
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const note = prompt("Enter investigator note for " + inv.caseNumber + ":");
                              if (note) agentGovernanceService.addInvestigationNote(orgId, inv.caseNumber, note).then(loadData);
                            }}
                          >
                            + Note
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Investigation Timeline Reconstructor */}
              {investigationTimelineData && (
                <Card className="p-5 bg-card border-border/80 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div>
                      <h3 className="font-semibold text-base text-foreground">
                        Chronological Reconstruction: {investigationTimelineData.caseNumber}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        Agent Request → Policy Evaluation → Human Approval → Security Validation → Tool Execution → Execution Outcome
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setInvestigationTimelineData(null)}>
                      Close Timeline
                    </Button>
                  </div>

                  <div className="relative border-l-2 border-primary/30 ml-4 pl-4 space-y-4 text-xs">
                    {investigationTimelineData.timeline.length === 0 ? (
                      <div className="text-muted-foreground py-3">No activity steps found in correlation window.</div>
                    ) : (
                      investigationTimelineData.timeline.map((item, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                          <div className="p-3 rounded-lg bg-muted/20 border border-border/40 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-primary/20 text-primary">
                                {item.stage}
                              </span>
                              <span className="font-bold text-foreground font-mono">{item.eventType}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground font-mono">
                                {new Date(item.eventTimestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              Outcome: {item.outcome} · Agent: {item.agentId || "n/a"} · Actor: {item.actorId || "system"}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Modal: Verify Control */}
          {verifyControlModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <Card className="max-w-lg w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <h3 className="font-semibold text-base text-foreground">
                    Verify Compliance Control: {verifyControlModal.controlKey}
                  </h3>
                  <button onClick={() => setVerifyControlModal(null)} className="text-muted-foreground hover:text-foreground">
                    ✕
                  </button>
                </div>
                <form onSubmit={handleVerifyControlSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Target Verification Status</label>
                    <select
                      value={verifyControlStatus}
                      onChange={(e) => setVerifyControlStatus(e.target.value)}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground"
                    >
                      <option value="VERIFIED">VERIFIED (Evidence confirmed)</option>
                      <option value="IMPLEMENTED">IMPLEMENTED (Feature active)</option>
                      <option value="EVIDENCE_PENDING">EVIDENCE_PENDING (Awaiting artifacts)</option>
                      <option value="NONCOMPLIANT">NONCOMPLIANT (Identified gaps)</option>
                      <option value="NOT_APPLICABLE">NOT_APPLICABLE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-foreground mb-1">Exceptions & Remediation Notes (Optional)</label>
                    <textarea
                      rows={3}
                      placeholder="Specify any operational exceptions or justification..."
                      value={verifyControlExceptions}
                      onChange={(e) => setVerifyControlExceptions(e.target.value)}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground font-mono text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                    <Button type="button" variant="outline" size="sm" onClick={() => setVerifyControlModal(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                      Save Decision
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* Modal: Collect Evidence */}
          {showCollectEvidenceModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <Card className="max-w-lg w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <h3 className="font-semibold text-base text-foreground">Collect Compliance Evidence</h3>
                  <button onClick={() => setShowCollectEvidenceModal(false)} className="text-muted-foreground hover:text-foreground">
                    ✕
                  </button>
                </div>
                <form onSubmit={handleCollectEvidenceSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Evidence Title *</label>
                    <Input
                      required
                      placeholder="e.g. Q4 Agent Security Test Report"
                      value={newEvidenceTitle}
                      onChange={(e) => setNewEvidenceTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-foreground mb-1">Type</label>
                      <select
                        value={newEvidenceType}
                        onChange={(e) => setNewEvidenceType(e.target.value)}
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground"
                      >
                        <option value="test_report">Test Report</option>
                        <option value="execution_log">Execution Log</option>
                        <option value="security_event">Security Event</option>
                        <option value="approval_decision">Approval Decision</option>
                        <option value="governance_snapshot">Governance Snapshot</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-foreground mb-1">Classification</label>
                      <select
                        value={newEvidenceClass}
                        onChange={(e) => setNewEvidenceClass(e.target.value)}
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground"
                      >
                        <option value="INTERNAL">INTERNAL</option>
                        <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                        <option value="RESTRICTED">RESTRICTED</option>
                        <option value="PUBLIC">PUBLIC</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-medium text-foreground mb-1">Source Identifier *</label>
                    <Input
                      required
                      placeholder="e.g. vitest-security-suite-run"
                      value={newEvidenceSource}
                      onChange={(e) => setNewEvidenceSource(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-foreground mb-1">Structured Payload (JSON)</label>
                    <textarea
                      rows={4}
                      value={newEvidencePayload}
                      onChange={(e) => setNewEvidencePayload(e.target.value)}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground font-mono text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCollectEvidenceModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                      Record Evidence
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* Modal: Create Legal Hold */}
          {showCreateHoldModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <Card className="max-w-lg w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <h3 className="font-semibold text-base text-foreground">Activate Legal Hold</h3>
                  <button onClick={() => setShowCreateHoldModal(false)} className="text-muted-foreground hover:text-foreground">
                    ✕
                  </button>
                </div>
                <form onSubmit={handleCreateHoldSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Hold Title / Name *</label>
                    <Input
                      required
                      placeholder="e.g. Q4 Regulatory Audit Hold"
                      value={newHoldName}
                      onChange={(e) => setNewHoldName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-foreground mb-1">Reason & Justification *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Explain legal or regulatory grounds for holding records..."
                      value={newHoldReason}
                      onChange={(e) => setNewHoldReason(e.target.value)}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateHoldModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="bg-amber-600 hover:bg-amber-500 text-white font-semibold">
                      Activate Hold
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* Modal: Create Investigation */}
          {showCreateInvModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <Card className="max-w-lg w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <h3 className="font-semibold text-base text-foreground">Open Audit Investigation Case</h3>
                  <button onClick={() => setShowCreateInvModal(false)} className="text-muted-foreground hover:text-foreground">
                    ✕
                  </button>
                </div>
                <form onSubmit={handleCreateInvSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-foreground mb-1">Case Title *</label>
                    <Input
                      required
                      placeholder="e.g. Investigation: Unapproved Tool Invocation Probe"
                      value={newInvTitle}
                      onChange={(e) => setNewInvTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-foreground mb-1">Description & Scope</label>
                    <textarea
                      rows={3}
                      placeholder="Specify investigation scope or target agent/timeframe..."
                      value={newInvDesc}
                      onChange={(e) => setNewInvDesc(e.target.value)}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-foreground text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateInvModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                      Open Case
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* Modal: Export Evidence Package */}
          {showExportPackageModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <Card className="max-w-lg w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <h3 className="font-semibold text-base text-foreground">Export Evidence Package</h3>
                  <button onClick={() => setShowExportPackageModal(false)} className="text-muted-foreground hover:text-foreground">
                    ✕
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <p className="text-muted-foreground">
                    Generate an authorized, self-contained evidence package with SHA-256 manifest checksums, individual file hashes, and deep secret redaction.
                  </p>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/40 font-mono text-[11px] space-y-1">
                    <div>Selected Evidence: {complianceEvidenceList.length} items</div>
                    <div>Redaction: DEEP_SECRET_SCRUBBED</div>
                    <div>Algorithm: SHA-256</div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowExportPackageModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleExportPackageSubmit}
                      className="bg-primary text-primary-foreground font-semibold"
                    >
                      Generate & Export
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Agent Profiles */}
      {activeTab === "profiles" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {profiles.length} agent governance profiles.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const id = prompt("Enter Agent ID to configure governance profile:");
                if (id) setSelectedAgentForProfile(id);
              }}
            >
              + Configure Agent Profile
            </Button>
          </div>

          {profiles.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No agent governance profiles created yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profiles.map((p) => {
                const owner = ownershipList.find((o) => o.agentId === p.agentId);
                return (
                  <AgentGovernanceProfileCard
                    key={p.id}
                    agentId={p.agentId}
                    agentName={`Agent (${p.agentId.slice(0, 8)})`}
                    securityClassification={p.securityClassification}
                    riskTier={p.riskTier}
                    complianceFrameworks={p.complianceFrameworks || []}
                    maxAutonomyLevel={`Level ${p.maxAutonomyLevel}`}
                    approvalPolicy={p.requireApprovalForTools ? "Tools Require Approval" : "Autonomous Tools"}
                    complianceStatus={p.complianceStatus}
                    nextReviewDueAt={p.nextReviewDueAt}
                    primaryOwnerName={owner?.primaryOwnerId || null}
                    onEditProfile={() => setSelectedAgentForProfile(p.agentId)}
                    onAssignOwnership={() => setSelectedAgentForOwnership(p.agentId)}
                    onRecordReview={() => setSelectedAgentForReview(p.agentId)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Ownership & Accountability */}
      {activeTab === "ownership" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {ownershipList.length} agent ownership assignments.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const id = prompt("Enter Agent ID to assign ownership:");
                if (id) setSelectedAgentForOwnership(id);
              }}
            >
              + Assign Agent Ownership
            </Button>
          </div>

          {ownershipList.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No ownership assignments recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-border/60 rounded-xl bg-card/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-4">Agent ID</th>
                    <th className="py-2.5 px-4">Primary Owner</th>
                    <th className="py-2.5 px-4">Technical Owner</th>
                    <th className="py-2.5 px-4">Business Owner</th>
                    <th className="py-2.5 px-4">Escalation Contact</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {ownershipList.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-foreground">
                        {o.agentId}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {o.primaryOwnerId}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {o.technicalOwnerId || "—"}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {o.businessOwnerId || "—"}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {o.escalationContact}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-emerald-400 capitalize">
                          {o.accountabilityStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => {
                            setSelectedAgentForOwnership(o.agentId);
                            setOwnerPrimary(o.primaryOwnerId);
                            setOwnerTech(o.technicalOwnerId || "");
                            setOwnerBiz(o.businessOwnerId || "");
                            setOwnerEscalation(o.escalationContact);
                          }}
                        >
                          Reassign
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Audit Log Ledger */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing recent immutable governance audit log events.
            </span>
          </div>

          <GovernanceAuditLogTable
            logs={auditLogs.map((l) => ({
              id: l.id,
              action: l.action,
              targetType: l.targetType,
              targetId: l.targetId,
              actorId: l.actorId,
              createdAt: l.createdAt,
              metadata: l.metadata,
            }))}
          />
        </div>
      )}

      {/* Modal: Version Comparison Drawer */}
      {selectedPolicyForCompare && versionComparison && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground">Policy Version Diff</h3>
                <span className="font-mono text-xs text-muted-foreground">
                  Comparing v{versionComparison.v1.version} and v{versionComparison.v2.version}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedPolicyForCompare(null);
                  setVersionComparison(null);
                }}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/20 rounded border border-border/40">
                  <span className="font-semibold text-foreground block mb-1">
                    v{versionComparison.v1.version} ({versionComparison.v1.lifecycleState})
                  </span>
                  <pre className="font-mono text-[11px] text-muted-foreground overflow-auto max-h-48">
                    {JSON.stringify(versionComparison.v1.rules, null, 2)}
                  </pre>
                </div>
                <div className="p-3 bg-muted/20 rounded border border-border/40">
                  <span className="font-semibold text-foreground block mb-1">
                    v{versionComparison.v2.version} ({versionComparison.v2.lifecycleState})
                  </span>
                  <pre className="font-mono text-[11px] text-muted-foreground overflow-auto max-h-48">
                    {JSON.stringify(versionComparison.v2.rules, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="p-3 bg-card rounded border border-border/40 space-y-1">
                <span className="font-semibold text-foreground block">Change Summary</span>
                <span className="text-muted-foreground block">
                  Added rules: {versionComparison.diff.addedRules.join(", ") || "none"}
                </span>
                <span className="text-muted-foreground block">
                  Removed rules: {versionComparison.diff.removedRules.join(", ") || "none"}
                </span>
                <span className="text-muted-foreground block">
                  Modified rules: {versionComparison.diff.modifiedRules.length} items
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border/40">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedPolicyForCompare(null);
                  setVersionComparison(null);
                }}
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Create Policy */}
      {showCreatePolicy && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-semibold text-lg text-foreground">Create Governance Policy</h3>
              <button
                onClick={() => setShowCreatePolicy(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Policy Name</label>
                <Input
                  required
                  placeholder="e.g., Sensitive Data Protection Policy"
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Policy Key (Unique Identifier)</label>
                <Input
                  required
                  placeholder="e.g., sec-pii-protection"
                  value={newPolicyKey}
                  onChange={(e) => setNewPolicyKey(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Description</label>
                <Input
                  placeholder="Summary of requirements and scope"
                  value={newPolicyDesc}
                  onChange={(e) => setNewPolicyDesc(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Policy Type</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={newPolicyType}
                    onChange={(e) => setNewPolicyType(e.target.value)}
                  >
                    <option value="security">Security</option>
                    <option value="compliance">Compliance</option>
                    <option value="behavioral">Behavioral</option>
                    <option value="data_access">Data Access</option>
                    <option value="model_restriction">Model Restriction</option>
                    <option value="tool_restriction">Tool Restriction</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Severity</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={newPolicySeverity}
                    onChange={(e) => setNewPolicySeverity(e.target.value as PolicySeverity)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Scope</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={newPolicyScope}
                    onChange={(e) => setNewPolicyScope(e.target.value as PolicyScopeType)}
                  >
                    <option value="organization">Organization Wide</option>
                    <option value="workspace">Workspace Scoped</option>
                    <option value="agent_specific">Agent Specific</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Enforcement Action</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={newPolicyEnforcement}
                    onChange={(e) => setNewPolicyEnforcement(e.target.value as PolicyEnforcementAction)}
                  >
                    <option value="log">Audit Only (Silent)</option>
                    <option value="notify">Notify (Telemetry)</option>
                    <option value="require_approval">Require Approval</option>
                    <option value="block">Block Execution</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreatePolicy(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Create Policy
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Configure Profile */}
      {selectedAgentForProfile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground">Governance Profile</h3>
                <span className="font-mono text-xs text-muted-foreground">{selectedAgentForProfile}</span>
              </div>
              <button
                onClick={() => setSelectedAgentForProfile(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Security Classification</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                  value={profileClassification}
                  onChange={(e) => setProfileClassification(e.target.value as SecurityClassification)}
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="restricted">Restricted</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Risk Tier</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                  value={profileRiskTier}
                  onChange={(e) => setProfileRiskTier(e.target.value as RiskTier)}
                >
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                  <option value="critical">Critical Risk</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Compliance Frameworks (comma separated)</label>
                <Input
                  value={profileFrameworks}
                  onChange={(e) => setProfileFrameworks(e.target.value)}
                  placeholder="e.g. SOC2, HIPAA, GDPR"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Review Cadence (days)</label>
                  <Input
                    type="number"
                    value={profileCadenceDays}
                    onChange={(e) => setProfileCadenceDays(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Max Autonomy Level (1-4)</label>
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={profileMaxAutonomy}
                    onChange={(e) => setProfileMaxAutonomy(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAgentForProfile(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Profile
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Record Review */}
      {selectedAgentForReview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground">Record Compliance Review</h3>
                <span className="font-mono text-xs text-muted-foreground">{selectedAgentForReview}</span>
              </div>
              <button
                onClick={() => setSelectedAgentForReview(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordReview} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Review Outcome</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as ComplianceStatus)}
                >
                  <option value="compliant">Compliant (Passed)</option>
                  <option value="needs_review">Needs Additional Review</option>
                  <option value="non_compliant">Non-Compliant (Requires Remediation)</option>
                  <option value="exempt">Exempt</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Review Notes & Evidence</label>
                <Input
                  required
                  placeholder="e.g. Verified data isolation and prompt safeguards"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAgentForReview(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Record Review
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Decision Confirm (Approve / Reject / Escalate) */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground capitalize">
                  {approvalModal.type} Governance Approval
                </h3>
                <span className="font-mono text-xs text-muted-foreground">
                  Target: {approvalModal.request.actionTarget} ({approvalModal.request.riskClassification} risk)
                </span>
              </div>
              <button
                onClick={() => setApprovalModal(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitApprovalDecision} className="space-y-4 text-xs">
              <div className="p-3 rounded bg-muted/30 border border-border/40 space-y-1">
                <p className="text-foreground/90 font-medium">{approvalModal.request.approvalReason}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  <span>Agent: {approvalModal.request.agentId}</span>
                  <span>Requester: {approvalModal.request.requestingActorId}</span>
                </div>
              </div>

              {(approvalModal.type === "approve" || approvalModal.type === "reject") && (
                <div>
                  <label className="block font-medium text-foreground mb-1">
                    Justification {(approvalModal.request.riskClassification === "high" || approvalModal.request.riskClassification === "critical") ? "*" : "(Optional)"}
                  </label>
                  <Input
                    required={approvalModal.request.riskClassification === "high" || approvalModal.request.riskClassification === "critical"}
                    placeholder="Provide mandatory audit justification for this decision"
                    value={modalJustification}
                    onChange={(e) => setModalJustification(e.target.value)}
                  />
                </div>
              )}

              {approvalModal.type === "escalate" ? (
                <>
                  <div>
                    <label className="block font-medium text-foreground mb-1">Escalation Reason *</label>
                    <Input
                      required
                      placeholder="Explain why this request requires higher authorization"
                      value={modalReason}
                      onChange={(e) => setModalReason(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-foreground mb-1">Reassign to Reviewer (User ID / Optional)</label>
                    <Input
                      placeholder="e.g. user-senior-officer"
                      value={modalEscalationContact}
                      onChange={(e) => setModalEscalationContact(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-medium text-foreground mb-1">Optional Notes / Context</label>
                  <Input
                    placeholder="Additional rationale or conditions"
                    value={modalReason}
                    onChange={(e) => setModalReason(e.target.value)}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setApprovalModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className={
                    approvalModal.type === "approve"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                      : approvalModal.type === "reject"
                      ? "bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                      : "bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                  }
                >
                  Confirm {approvalModal.type.toUpperCase()}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Approval Details & Audit History (70% width) */}
      {selectedApprovalDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-4xl w-[70vw] max-h-[85vh] overflow-y-auto p-6 bg-card border-border/80 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                  <span>Approval Request Details</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/60 text-muted-foreground">
                    {selectedApprovalDetails.request.id}
                  </span>
                </h3>
                <span className="text-xs text-muted-foreground">
                  Target: {selectedApprovalDetails.request.actionTarget} ({selectedApprovalDetails.request.actionType})
                </span>
              </div>
              <button
                onClick={() => setSelectedApprovalDetails(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Core Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/20 p-3 rounded-lg border border-border/40">
              <div>
                <span className="text-muted-foreground block text-[10px]">Status</span>
                <span className="font-bold uppercase tracking-wider">{selectedApprovalDetails.request.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Risk Tier</span>
                <GovernanceRiskBadge riskTier={selectedApprovalDetails.request.riskClassification as any} />
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Security Classification</span>
                <SecurityClassificationBadge classification={selectedApprovalDetails.request.securityClassification as any} />
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Expires At</span>
                <span className="font-mono text-[11px]">{new Date(selectedApprovalDetails.request.expiresAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Payload & Canonical Fingerprint */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-foreground">Approved Payload Parameters</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  Fingerprint: {selectedApprovalDetails.request.canonicalPayloadFingerprint?.slice(0, 24)}...
                </span>
              </div>
              <pre className="p-3 rounded-lg bg-zinc-950 font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-48 border border-border/40">
                {JSON.stringify(selectedApprovalDetails.request.payload, null, 2)}
              </pre>
            </div>

            {/* Decision History */}
            <div>
              <span className="text-xs font-semibold text-foreground block mb-2">Immutable Decision History</span>
              {selectedApprovalDetails.decisions.length > 0 ? (
                <div className="space-y-2">
                  {selectedApprovalDetails.decisions.map((dec) => (
                    <div key={dec.id} className="p-3 rounded-lg bg-muted/20 border border-border/40 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase tracking-wider text-emerald-400">{dec.decision}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{new Date(dec.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-muted-foreground">Decided by: <span className="font-mono text-foreground">{dec.decidedByActorId}</span></p>
                      {dec.justification && <p className="text-foreground/90"><span className="text-muted-foreground">Justification: </span>{dec.justification}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No decisions recorded yet.</p>
              )}
            </div>

            {/* Escalation History */}
            <div>
              <span className="text-xs font-semibold text-foreground block mb-2">Escalation History</span>
              {selectedApprovalDetails.escalations.length > 0 ? (
                <div className="space-y-2">
                  {selectedApprovalDetails.escalations.map((esc) => (
                    <div key={esc.id} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between text-amber-400">
                        <span className="font-semibold uppercase tracking-wider">Escalated</span>
                        <span className="font-mono text-[10px]">{new Date(esc.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-muted-foreground">Escalated by: <span className="font-mono text-foreground">{esc.escalatedByActorId}</span></p>
                      {esc.escalationContact && <p className="text-muted-foreground">Contact: <span className="font-mono text-foreground">{esc.escalationContact}</span></p>}
                      <p className="text-foreground/90"><span className="text-muted-foreground">Reason: </span>{esc.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No escalations recorded.</p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border/40">
              <Button size="sm" variant="outline" onClick={() => setSelectedApprovalDetails(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Assign Ownership */}
      {selectedAgentForOwnership && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-semibold text-lg text-foreground">Assign Agent Ownership</h3>
                <span className="font-mono text-xs text-muted-foreground">{selectedAgentForOwnership}</span>
              </div>
              <button
                onClick={() => setSelectedAgentForOwnership(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOwnership} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Primary Owner (User ID / Email) *</label>
                <Input
                  required
                  placeholder="e.g. user-primary-owner"
                  value={ownerPrimary}
                  onChange={(e) => setOwnerPrimary(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Technical Owner (Optional)</label>
                <Input
                  placeholder="e.g. lead-engineer"
                  value={ownerTech}
                  onChange={(e) => setOwnerTech(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Business Owner (Optional)</label>
                <Input
                  placeholder="e.g. product-manager"
                  value={ownerBiz}
                  onChange={(e) => setOwnerBiz(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Escalation Contact (Email / PagerDuty / Slack) *</label>
                <Input
                  required
                  placeholder="e.g. ops-escalation@company.com"
                  value={ownerEscalation}
                  onChange={(e) => setOwnerEscalation(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAgentForOwnership(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Ownership
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {/* Modal: Emergency Stop Confirmation */}
      {showEmergencyStopModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-card border-rose-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <h3 className="font-bold text-lg text-rose-300">Activate Emergency Stop</h3>
              </div>
              <button
                onClick={() => setShowEmergencyStopModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              This will immediately halt all autonomous task workers, tool invocations, and agent runtimes across the entire organization.
            </p>
            <div>
              <label className="block font-medium text-foreground text-xs mb-1">Reason / Justification *</label>
              <Input
                placeholder="e.g. Suspected unauthorized model activity or runaway loop"
                value={emergencyStopReason}
                onChange={(e) => setEmergencyStopReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmergencyStopModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                onClick={handleTriggerEmergencyStop}
              >
                Confirm Emergency Stop
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Suspend Agent */}
      {suspendingAgentId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 bg-card border-rose-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-bold text-lg text-rose-300">Suspend Agent</h3>
              <button
                onClick={() => setSuspendingAgentId(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Target Agent: <span className="font-mono text-foreground font-semibold">{suspendingAgentId}</span>. All new executions and tool calls will be immediately rejected.
            </p>
            <div>
              <label className="block font-medium text-foreground text-xs mb-1">Suspension Reason *</label>
              <Input
                required
                placeholder="e.g. Administrative security hold pending policy review"
                value={suspensionReasonInput}
                onChange={(e) => setSuspensionReasonInput(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSuspendingAgentId(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                onClick={handleSuspendAgent}
              >
                Confirm Suspension
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Register Secret Reference */}
      {showCreateSecretModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-bold text-lg text-foreground">Register Secret Reference</h3>
              <button
                onClick={() => setShowCreateSecretModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSecret} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Opaque Identifier *</label>
                <Input
                  required
                  placeholder="e.g. SEC_REF_ACADEMIC_INTEGRATION_KEY"
                  value={newSecretIdent}
                  onChange={(e) => setNewSecretIdent(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-medium text-foreground mb-1">Reference Name *</label>
                <Input
                  required
                  placeholder="e.g. Academic SIS Integration Credential"
                  value={newSecretName}
                  onChange={(e) => setNewSecretName(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-medium text-foreground mb-1">Description</label>
                <Input
                  placeholder="Optional context about this credential reference"
                  value={newSecretDesc}
                  onChange={(e) => setNewSecretDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-medium text-foreground mb-1">Allowed Agent IDs (comma separated, empty = all)</label>
                <Input
                  placeholder="e.g. agent-academic-planning, agent-assessment-builder"
                  value={newSecretAgents}
                  onChange={(e) => setNewSecretAgents(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-medium text-foreground mb-1">Allowed Tool Keys (comma separated, empty = all)</label>
                <Input
                  placeholder="e.g. education.academic_structure.read"
                  value={newSecretTools}
                  onChange={(e) => setNewSecretTools(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-medium text-foreground mb-1">Synthetic Initial Value (Stored only in secure in-memory vault)</label>
                <Input
                  type="password"
                  placeholder="Optional synthetic test value (never saved to database)"
                  value={newSecretVal}
                  onChange={(e) => setNewSecretVal(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateSecretModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Register Secret Reference
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Configure Capability Profile (70% width) */}
      {selectedAgentForSecurity && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-4xl w-[70vw] max-h-[85vh] overflow-y-auto p-6 bg-card border-border/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="font-bold text-lg text-foreground">Configure Agent Capabilities & Sandbox</h3>
                <span className="font-mono text-xs text-muted-foreground">{selectedAgentForSecurity.agentId}</span>
              </div>
              <button
                onClick={() => setSelectedAgentForSecurity(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setError(null);
                  await agentGovernanceService.updateSecurityProfile(orgId, selectedAgentForSecurity.agentId, selectedAgentForSecurity);
                  setSelectedAgentForSecurity(null);
                  setActionSuccess("Agent capability profile updated");
                  await loadData();
                } catch (err: any) {
                  setError(err?.message || "Failed to update security profile");
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">Resource Classification</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={selectedAgentForSecurity.resourceClassification}
                    onChange={(e) => setSelectedAgentForSecurity({ ...selectedAgentForSecurity, resourceClassification: e.target.value })}
                  >
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="INTERNAL">INTERNAL</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                    <option value="RESTRICTED">RESTRICTED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Network Access Mode</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={selectedAgentForSecurity.networkAccessMode}
                    onChange={(e) => setSelectedAgentForSecurity({ ...selectedAgentForSecurity, networkAccessMode: e.target.value })}
                  >
                    <option value="BLOCKED">BLOCKED (No External Requests)</option>
                    <option value="ALLOWLIST">ALLOWLIST (Enforced Domains)</option>
                    <option value="UNRESTRICTED">UNRESTRICTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Allowed Network Domains (comma separated)</label>
                <Input
                  placeholder="e.g. *.education.gov, api.schoolhub.org"
                  value={selectedAgentForSecurity.allowedNetworkDomains.join(", ")}
                  onChange={(e) => setSelectedAgentForSecurity({
                    ...selectedAgentForSecurity,
                    allowedNetworkDomains: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">Storage Access Mode</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={selectedAgentForSecurity.storageAccessMode}
                    onChange={(e) => setSelectedAgentForSecurity({ ...selectedAgentForSecurity, storageAccessMode: e.target.value })}
                  >
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="WORKSPACE_ISOLATED">WORKSPACE_ISOLATED</option>
                    <option value="TEMPORARY_ONLY">TEMPORARY_ONLY</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Max Autonomy Level</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground"
                    value={selectedAgentForSecurity.maxAutonomyLevel}
                    onChange={(e) => setSelectedAgentForSecurity({ ...selectedAgentForSecurity, maxAutonomyLevel: e.target.value })}
                  >
                    <option value="L0">L0 (Full Approval)</option>
                    <option value="L1">L1 (Basic Guidance)</option>
                    <option value="L2">L2 (Semi-Autonomous)</option>
                    <option value="L3">L3 (Autonomous)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-foreground mb-1">Max Execution Duration (ms)</label>
                  <Input
                    type="number"
                    value={selectedAgentForSecurity.maxExecutionDurationMs}
                    onChange={(e) => setSelectedAgentForSecurity({ ...selectedAgentForSecurity, maxExecutionDurationMs: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">Max Tool Invocations</label>
                  <Input
                    type="number"
                    value={selectedAgentForSecurity.maxToolInvocations}
                    onChange={(e) => setSelectedAgentForSecurity({ ...selectedAgentForSecurity, maxToolInvocations: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Disallowed Tools (comma separated)</label>
                <Input
                  placeholder="e.g. code.eval, system.shell.exec"
                  value={selectedAgentForSecurity.disallowedToolKeys.join(", ")}
                  onChange={(e) => setSelectedAgentForSecurity({
                    ...selectedAgentForSecurity,
                    disallowedToolKeys: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAgentForSecurity(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Capabilities
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
