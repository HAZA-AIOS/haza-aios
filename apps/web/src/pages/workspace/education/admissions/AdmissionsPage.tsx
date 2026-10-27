import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AdmissionStatusBadge,
  EnquiryStatusBadge,
  AssessmentOutcomeBadge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from "@haza-aios/ui";
import { AppShell } from "@/components/AppShell";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { AdmissionsService } from "@/modules/education/sis/admissions.service";
import type {
  AcademicYear,
  AdmissionApplication,
  AdmissionAssessment,
  AdmissionEnquiry,
  AdmissionPrintDocument,
  AdmissionsDashboardSummary,
  AdmissionsReport,
  Grade,
  Section,
} from "@/modules/education/sis/sis.types";
import { useOrganization } from "@/org/use-organization";
import { useAuth } from "@/auth/use-auth";
import { Link } from "@/routes/router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Mail,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

export type AdmissionsTab =
  | "overview"
  | "enquiries"
  | "applications"
  | "assessments"
  | "decisions"
  | "fees"
  | "conversion"
  | "printing"
  | "reports";

export interface AdmissionsPageProps {
  initialTab?: AdmissionsTab;
}

export const AdmissionsPage: React.FC<AdmissionsPageProps> = ({ initialTab = "overview" }) => {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const orgId = currentOrganization?.id ?? "";

  const [activeTab, setActiveTab] = useState<AdmissionsTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedCampus, setSelectedCampus] = useState<string>("All Campuses");
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Metadata Lists
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  // Domain Data States
  const [dashboard, setDashboard] = useState<AdmissionsDashboardSummary | null>(null);
  const [enquiries, setEnquiries] = useState<AdmissionEnquiry[]>([]);
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [assessments, setAssessments] = useState<AdmissionAssessment[]>([]);
  const [reportData, setReportData] = useState<AdmissionsReport | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<string>("conversion_summary");

  // Selected for Actions / Drawers / Modals
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [feePreview, setFeePreview] = useState<any>(null);
  const [printDocument, setPrintDocument] = useState<AdmissionPrintDocument | null>(null);

  // Modal Dialog States
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);

  // Synchronous in-flight guards & submission states (UX-002)
  const isSubmittingEnquiryRef = useRef(false);
  const [isSubmittingEnquiry, setIsSubmittingEnquiry] = useState(false);

  const isSubmittingAppRef = useRef(false);
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);

  const isSubmittingAssessmentRef = useRef(false);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);

  const isSubmittingDecisionRef = useRef(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const isSubmittingConversionRef = useRef(false);
  const [isSubmittingConversion, setIsSubmittingConversion] = useState(false);

  const isConvertingEnquiryRef = useRef(false);
  const isSubmittingApplicationActionRef = useRef(false);
  const isAssigningFeesRef = useRef(false);

  // Form States - Enquiry
  const [enqStudentName, setEnqStudentName] = useState("");
  const [enqGuardianName, setEnqGuardianName] = useState("");
  const [enqPhone, setEnqPhone] = useState("");
  const [enqEmail, setEnqEmail] = useState("");
  const [enqGradeId, setEnqGradeId] = useState("");
  const [enqCampus, setEnqCampus] = useState("Main Campus");
  const [enqPrevSchool, setEnqPrevSchool] = useState("");
  const [enqSource, setEnqSource] = useState("direct");
  const [enqNotes, setEnqNotes] = useState("");

  // Form States - Application
  const [appFirstName, setAppFirstName] = useState("");
  const [appLastName, setAppLastName] = useState("");
  const [appDob, setAppDob] = useState("");
  const [appGender, setAppGender] = useState<"male" | "female" | "other">("male");
  const [appGradeId, setAppGradeId] = useState("");
  const [appCampus, setAppCampus] = useState("Main Campus");
  const [appPrevSchool, setAppPrevSchool] = useState("");
  const [appGuardianFirst, setAppGuardianFirst] = useState("");
  const [appGuardianLast, setAppGuardianLast] = useState("");
  const [appGuardianPhone, setAppGuardianPhone] = useState("");
  const [appGuardianEmail, setAppGuardianEmail] = useState("");
  const [appGuardianRel, setAppGuardianRel] = useState<"father" | "mother" | "guardian">("father");

  // Form States - Assessment
  const [assSubject, setAssSubject] = useState("");
  const [assType, setAssType] = useState<any>("written_test");
  const [assMaxMarks, setAssMaxMarks] = useState("100");
  const [assObtainedMarks, setAssObtainedMarks] = useState("75");
  const [assDate, setAssDate] = useState(new Date().toISOString().slice(0, 10));
  const [assRemarks, setAssRemarks] = useState("");

  // Form States - Decision
  const [decisionStatus, setDecisionStatus] = useState<any>("approved");
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [waitlistRank, setWaitlistRank] = useState("1");

  // Form States - Conversion
  const [targetSectionId, setTargetSectionId] = useState("");
  const [reuseStudentId, setReuseStudentId] = useState("");

  // Load initial metadata
  useEffect(() => {
    if (!orgId) return;

    AcademicService.getAcademicYears(orgId)
      .then((years) => {
        const safeYears = years || [];
        setAcademicYears(safeYears);
        const active = safeYears.find((y) => y.status === "active") || safeYears[0];
        if (active) setSelectedYear(active.name);
      })
      .catch(() => {});

    AcademicService.getGrades(orgId)
      .then((g) => {
        const safeGrades = g || [];
        setGrades(safeGrades);
        if (safeGrades.length > 0) {
          setEnqGradeId(safeGrades[0].id);
          setAppGradeId(safeGrades[0].id);
        }
      })
      .catch(() => {});
  }, [orgId]);

  // Load sections when grade changes for conversion
  useEffect(() => {
    if (!orgId || !selectedGradeId) return;
    AcademicService.getSections(orgId, selectedGradeId)
      .then((s) => {
        const safe = s || [];
        setSections(safe);
        if (safe.length > 0) setTargetSectionId(safe[0].id);
      })
      .catch(() => {});
  }, [orgId, selectedGradeId]);

  // Main Data Refresh Handler
  const refreshData = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);

    try {
      const filters = {
        academicYear: selectedYear || undefined,
        campus: selectedCampus !== "All Campuses" ? selectedCampus : undefined,
        gradeId: selectedGradeId || undefined,
      };

      const [dashRes, enqRes, appRes, assRes] = await Promise.all([
        AdmissionsService.getDashboard(orgId, filters).catch(() => null),
        AdmissionsService.listEnquiries(orgId, { ...filters, search: searchQuery || undefined }).catch(() => []),
        AdmissionsService.listApplications(orgId, { ...filters, search: searchQuery || undefined }).catch(() => []),
        AdmissionsService.listAssessments(orgId, selectedAppId || undefined).catch(() => []),
      ]);

      setDashboard(dashRes);
      setEnquiries(enqRes || []);
      setApplications(appRes || []);
      setAssessments(assRes || []);

      if (activeTab === "reports") {
        const rep = await AdmissionsService.getReport(orgId, selectedReportType as any, filters).catch(() => null);
        setReportData(rep);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load admissions information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [orgId, activeTab, selectedYear, selectedCampus, selectedGradeId]);

  // Handlers with Synchronous In-Flight Guards (UX-002)
  const handleCreateEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    if (isSubmittingEnquiryRef.current) return;
    isSubmittingEnquiryRef.current = true;
    setIsSubmittingEnquiry(true);
    setLoading(true);
    setError(null);
    try {
      await AdmissionsService.createEnquiry(orgId, {
        studentName: enqStudentName,
        guardianName: enqGuardianName,
        phone: enqPhone,
        email: enqEmail || undefined,
        desiredGradeId: enqGradeId,
        preferredCampus: enqCampus,
        previousSchool: enqPrevSchool || undefined,
        source: enqSource,
        notes: enqNotes || undefined,
      });
      setSuccessMessage("Enquiry created successfully.");
      setShowEnquiryModal(false);
      setEnqStudentName("");
      setEnqGuardianName("");
      setEnqPhone("");
      setEnqEmail("");
      refreshData();
    } catch (err: any) {
      setError(err?.message || "Failed to create enquiry.");
    } finally {
      isSubmittingEnquiryRef.current = false;
      setIsSubmittingEnquiry(false);
      setLoading(false);
    }
  };

  const handleConvertEnquiry = async (enquiryId: string) => {
    if (!orgId) return;
    if (isConvertingEnquiryRef.current) return;
    isConvertingEnquiryRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const app = await AdmissionsService.convertEnquiryToApplication(orgId, enquiryId);
      setSuccessMessage(`Enquiry successfully converted to Application ${app.applicationNumber}.`);
      setActiveTab("applications");
      refreshData();
    } catch (err: any) {
      setError(err?.message || "Failed to convert enquiry.");
    } finally {
      isConvertingEnquiryRef.current = false;
      setLoading(false);
    }
  };

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    if (isSubmittingAppRef.current) return;
    isSubmittingAppRef.current = true;
    setIsSubmittingApp(true);
    setLoading(true);
    setError(null);
    try {
      await AdmissionsService.createApplication(orgId, {
        desiredGradeId: appGradeId,
        campus: appCampus,
        academicYear: selectedYear || "2026-2027",
        admissionCategory: "regular",
        status: "draft",
        student: {
          firstName: appFirstName,
          lastName: appLastName,
          dateOfBirth: appDob,
          gender: appGender,
          previousSchool: appPrevSchool || undefined,
        },
        guardians: [
          {
            id: `grd-${Date.now()}`,
            firstName: appGuardianFirst,
            lastName: appGuardianLast,
            phone: appGuardianPhone,
            email: appGuardianEmail,
            relationship: appGuardianRel,
            isPrimaryContact: true,
            isEmergencyContact: true,
          },
        ],
      });
      setSuccessMessage("Application submitted as draft.");
      setShowApplicationModal(false);
      setAppFirstName("");
      setAppLastName("");
      setAppDob("");
      refreshData();
    } catch (err: any) {
      setError(err?.message || "Failed to create application.");
    } finally {
      isSubmittingAppRef.current = false;
      setIsSubmittingApp(false);
      setLoading(false);
    }
  };

  const handleSubmitApplication = async (appId: string) => {
    if (!orgId) return;
    if (isSubmittingApplicationActionRef.current) return;
    isSubmittingApplicationActionRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await AdmissionsService.submitApplication(orgId, appId);
      setSuccessMessage("Application submitted for evaluation.");
      refreshData();
    } catch (err: any) {
      setError(err?.message || "Failed to submit application.");
    } finally {
      isSubmittingApplicationActionRef.current = false;
      setLoading(false);
    }
  };

  const handleRecordAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !selectedAppId) return;
    if (isSubmittingAssessmentRef.current) return;
    isSubmittingAssessmentRef.current = true;
    setIsSubmittingAssessment(true);
    setLoading(true);
    setError(null);
    try {
      await AdmissionsService.createAssessment(orgId, {
        applicationId: selectedAppId,
        subject: assSubject,
        assessmentType: assType,
        maximumMarks: Number(assMaxMarks),
        obtainedMarks: Number(assObtainedMarks),
        assessmentDate: assDate,
        remarks: assRemarks || undefined,
      });
      setSuccessMessage("Assessment record added successfully.");
      setShowAssessmentModal(false);
      setAssSubject("");
      refreshData();
    } catch (err: any) {
      setError(err?.message || "Failed to record assessment.");
    } finally {
      isSubmittingAssessmentRef.current = false;
      setIsSubmittingAssessment(false);
      setLoading(false);
    }
  };

  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !selectedAppId) return;
    if (isSubmittingDecisionRef.current) return;
    isSubmittingDecisionRef.current = true;
    setIsSubmittingDecision(true);
    setLoading(true);
    setError(null);
    try {
      await AdmissionsService.recordDecision(orgId, selectedAppId, {
        status: decisionStatus,
        remarks: decisionRemarks || undefined,
        rejectionReason: decisionStatus === "rejected" ? rejectionReason : undefined,
        waitlistRank: decisionStatus === "waitlisted" ? Number(waitlistRank) : undefined,
      });
      setSuccessMessage(`Decision recorded: Application is now ${decisionStatus.toUpperCase()}.`);
      setShowDecisionModal(false);
      setDecisionRemarks("");
      refreshData();
    } catch (err: any) {
      setError(err?.message || "Failed to record decision.");
    } finally {
      isSubmittingDecisionRef.current = false;
      setIsSubmittingDecision(false);
      setLoading(false);
    }
  };

  const handleLoadFeePreview = async (appId: string) => {
    if (!orgId) return;
    setSelectedAppId(appId);
    try {
      const prev = await AdmissionsService.getFeePreview(orgId, appId);
      setFeePreview(prev);
    } catch (err: any) {
      setError(err?.message || "Failed to load fee preview.");
    }
  };

  const handleAssignFees = async (feeStructureIds: string[]) => {
    if (!orgId || !selectedAppId) return;
    if (isAssigningFeesRef.current) return;
    isAssigningFeesRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await AdmissionsService.assignFeePackage(orgId, selectedAppId, {
        feeStructureIds,
        admissionFeeCents: 25000,
      });
      setSuccessMessage("Fee package successfully assigned.");
      refreshData();
    } catch (err: any) {
      setError(err?.message || "Failed to assign fees.");
    } finally {
      isAssigningFeesRef.current = false;
      setLoading(false);
    }
  };

  const handleEnrollmentConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !selectedAppId) return;
    const targetApp = applications.find((a) => a.id === selectedAppId);
    if (!targetApp) return;

    if (isSubmittingConversionRef.current) return;
    isSubmittingConversionRef.current = true;
    setIsSubmittingConversion(true);
    setLoading(true);
    setError(null);
    try {
      const res = await AdmissionsService.convertToEnrollment(orgId, selectedAppId, {
        academicYear: targetApp.academicYear || selectedYear || "2026-2027",
        gradeId: targetApp.desiredGradeId,
        sectionId: targetSectionId,
        reuseExistingStudentId: reuseStudentId || undefined,
      });
      setSuccessMessage(res.message || "Student successfully enrolled!");
      setShowConversionModal(false);
      refreshData();
    } catch (err: any) {
      setError(err?.message || "Enrollment conversion failed.");
    } finally {
      isSubmittingConversionRef.current = false;
      setIsSubmittingConversion(false);
      setLoading(false);
    }
  };

  const handleLoadPrintDocument = async (appId: string) => {
    if (!orgId) return;
    setSelectedAppId(appId);
    try {
      const doc = await AdmissionsService.getPrintDocument(orgId, appId);
      setPrintDocument(doc);
      setActiveTab("printing");
    } catch (err: any) {
      setError(err?.message || "Failed to load printable document.");
    }
  };

  const filteredApplications = useMemo(() => {
    return applications || [];
  }, [applications]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <Link to="/workspace" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-7 h-7 text-indigo-400" /> Admissions & Enrollment Suite
              </h1>
              <p className="text-sm text-slate-400">
                Manage candidate enquiries, multi-stage application workflows, assessments, and transactional enrollments.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowEnquiryModal(true);
              }}
              className="border-white/10 hover:bg-white/5 text-slate-200"
            >
              <Plus className="w-4 h-4 mr-1.5 text-cyan-400" /> New Enquiry
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setShowApplicationModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
            >
              <UserPlus className="w-4 h-4 mr-1.5" /> New Application
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={loading}
              className="border-white/10 hover:bg-white/5 text-slate-400"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Global Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3 animate-fadeIn">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-3 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto text-xs opacity-70 hover:opacity-100">
              Dismiss
            </button>
          </div>
        )}

        {/* Global Filter Bar */}
        <div className="bg-[#0f141f] border border-white/5 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filters:</span>
            </div>

            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200"
            >
              <option value="">All Academic Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.name}>
                  {y.name}
                </option>
              ))}
            </Select>

            <Select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200"
            >
              <option value="All Campuses">All Campuses</option>
              <option value="Main Campus">Main Campus</option>
              <option value="North Campus">North Campus</option>
              <option value="South Campus">South Campus</option>
            </Select>

            <Select
              value={selectedGradeId}
              onChange={(e) => setSelectedGradeId(e.target.value)}
              className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200"
            >
              <option value="">All Grades</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search candidate / ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refreshData()}
              className="h-9 pl-9 text-xs bg-slate-900 border-white/10 text-slate-200"
            />
          </div>
        </div>

        {/* 9 Interactive Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-white/5 pb-2 text-sm scrollbar-none">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "enquiries", label: "Enquiries", icon: Users, badge: enquiries.length },
            { id: "applications", label: "Applications", icon: FileText, badge: applications.length },
            { id: "assessments", label: "Assessments", icon: FileCheck },
            { id: "decisions", label: "Decisions & Review", icon: UserCheck },
            { id: "fees", label: "Fee Packages", icon: Layers },
            { id: "conversion", label: "Enrollment", icon: GraduationCap },
            { id: "printing", label: "Print Documents", icon: Printer },
            { id: "reports", label: "Reports & Exports", icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdmissionsTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium transition-all duration-150 whitespace-nowrap ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW & DASHBOARD */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "Total Enquiries", val: dashboard?.totalEnquiries ?? enquiries.length, color: "text-cyan-400" },
                { label: "Pending Apps", val: dashboard?.pendingApplications ?? 0, color: "text-amber-400" },
                { label: "Under Assessment", val: dashboard?.applicationsUnderAssessment ?? 0, color: "text-indigo-400" },
                { label: "Approved", val: dashboard?.approvedApplications ?? 0, color: "text-emerald-400" },
                { label: "Rejected", val: dashboard?.rejectedApplications ?? 0, color: "text-rose-400" },
                { label: "Enrolled", val: dashboard?.enrolledStudents ?? 0, color: "text-teal-300" },
                {
                  label: "Conversion Rate",
                  val: `${dashboard?.conversionRatePercentage ?? 0}%`,
                  color: "text-purple-400",
                },
              ].map((kpi, idx) => (
                <Card key={idx} className="bg-[#0f141f] border-white/5 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.val}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Actions & Recent Activity Stream */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-[#0f141f] border-white/5 lg:col-span-2">
                <CardHeader className="pb-3 border-b border-white/5">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" /> Recent Admissions Activity
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Real-time timeline of candidate enquiries, assessments, and enrollment conversions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 divide-y divide-white/5">
                  {(dashboard?.recentActivity || []).length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">No recent admissions events recorded.</p>
                  ) : (
                    (dashboard?.recentActivity || []).map((act) => (
                      <div key={act.id} className="py-3 flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-slate-200">{act.title}</p>
                          <p className="text-xs text-slate-400">{act.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(act.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions Card */}
              <Card className="bg-[#0f141f] border-white/5">
                <CardHeader className="pb-3 border-b border-white/5">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-cyan-400" /> Quick Admissions Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-xs border-white/10 hover:bg-white/5 text-slate-200"
                    onClick={() => setShowEnquiryModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-2 text-cyan-400" /> Log Prospect Enquiry
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-xs border-white/10 hover:bg-white/5 text-slate-200"
                    onClick={() => setShowApplicationModal(true)}
                  >
                    <FileText className="w-4 h-4 mr-2 text-blue-400" /> Create Admission Application
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-xs border-white/10 hover:bg-white/5 text-slate-200"
                    onClick={() => setActiveTab("assessments")}
                  >
                    <FileCheck className="w-4 h-4 mr-2 text-indigo-400" /> Schedule Diagnostic Test
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-xs border-white/10 hover:bg-white/5 text-slate-200"
                    onClick={() => setActiveTab("conversion")}
                  >
                    <GraduationCap className="w-4 h-4 mr-2 text-emerald-400" /> Process Student Enrollment
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: ENQUIRIES */}
        {activeTab === "enquiries" && (
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader className="p-4 sm:p-6 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-white">Prospect Enquiries Register</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Track incoming candidate queries, campus visits, follow-up timelines, and conversion triggers.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowEnquiryModal(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Log Enquiry
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] tracking-wider text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4">Ref Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Guardian Contact</th>
                    <th className="py-3 px-4">Desired Grade / Campus</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {enquiries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No candidate enquiries matching criteria.
                      </td>
                    </tr>
                  ) : (
                    enquiries.map((enq) => (
                      <tr key={enq.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-200">{enq.referenceNumber}</td>
                        <td className="py-3 px-4 font-medium text-white">{enq.studentName}</td>
                        <td className="py-3 px-4">
                          <div>{enq.guardianName}</div>
                          <div className="text-[11px] text-slate-500">{enq.phone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div>{grades.find((g) => g.id === enq.desiredGradeId)?.name || "Grade"}</div>
                          <div className="text-[10px] text-slate-500">{enq.preferredCampus || "Main Campus"}</div>
                        </td>
                        <td className="py-3 px-4 capitalize">{enq.source}</td>
                        <td className="py-3 px-4">
                          <EnquiryStatusBadge status={enq.status} />
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          {enq.status !== "converted" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] border-white/10 hover:bg-emerald-600/20 hover:text-emerald-400"
                              onClick={() => handleConvertEnquiry(enq.id)}
                            >
                              Convert to App
                            </Button>
                          ) : (
                            <span className="text-[11px] text-emerald-400 font-medium">Converted</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* TAB 3: APPLICATIONS */}
        {activeTab === "applications" && (
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader className="p-4 sm:p-6 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-white">Admissions Applications</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Manage multi-step candidate applications, student and guardian profiles, and verification status.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowApplicationModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> New Application
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] tracking-wider text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4">App ID</th>
                    <th className="py-3 px-4">Student Profile</th>
                    <th className="py-3 px-4">Grade & Campus</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No applications found.
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => {
                      const studentObj = app.student || ({} as any);
                      return (
                        <tr key={app.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-200">{app.applicationNumber}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">
                              {studentObj.firstName} {studentObj.lastName}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              DOB: {studentObj.dateOfBirth} | {studentObj.gender}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div>{grades.find((g) => g.id === app.desiredGradeId)?.name || "Grade"}</div>
                            <div className="text-[10px] text-slate-500">{app.campus || "Main Campus"}</div>
                          </td>
                          <td className="py-3 px-4 font-mono">{app.academicYear}</td>
                          <td className="py-3 px-4">
                            <AdmissionStatusBadge status={app.status} />
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            {app.status === "draft" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] border-white/10 hover:bg-blue-600/20 text-blue-400"
                                onClick={() => handleSubmitApplication(app.id)}
                              >
                                Submit
                              </Button>
                            )}

                            {["submitted", "under_review", "assessment"].includes(app.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] border-white/10 hover:bg-indigo-600/20 text-indigo-400"
                                onClick={() => {
                                  setSelectedAppId(app.id);
                                  setShowDecisionModal(true);
                                }}
                              >
                                Review
                              </Button>
                            )}

                            {app.status === "approved" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] border-white/10 hover:bg-emerald-600/20 text-emerald-400"
                                onClick={() => {
                                  setSelectedAppId(app.id);
                                  setSelectedGradeId(app.desiredGradeId);
                                  setShowConversionModal(true);
                                }}
                              >
                                Enroll
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] border-white/10 hover:bg-white/10 text-slate-300"
                              onClick={() => handleLoadPrintDocument(app.id)}
                            >
                              Print
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* TAB 4: ASSESSMENTS */}
        {activeTab === "assessments" && (
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader className="p-4 sm:p-6 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-white">Admission Diagnostics & Assessments</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Record written diagnostic scores, interview evaluations, and assessor remarks.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (applications.length > 0 && !selectedAppId) {
                    setSelectedAppId(applications[0].id);
                  }
                  setShowAssessmentModal(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Record Assessment
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 uppercase text-[10px] tracking-wider text-slate-400 border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4">Subject / Area</th>
                    <th className="py-3 px-4">Assessment Type</th>
                    <th className="py-3 px-4">Score & Benchmark</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Outcome</th>
                    <th className="py-3 px-4">Assessor Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {assessments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No assessment records found.
                      </td>
                    </tr>
                  ) : (
                    assessments.map((ass) => (
                      <tr key={ass.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">{ass.subject}</td>
                        <td className="py-3 px-4 capitalize">{ass.assessmentType.replace("_", " ")}</td>
                        <td className="py-3 px-4 font-mono font-medium">
                          {ass.obtainedMarks} / {ass.maximumMarks} (Pass: {ass.passingMarks})
                        </td>
                        <td className="py-3 px-4 text-slate-400">{ass.assessmentDate}</td>
                        <td className="py-3 px-4">
                          <AssessmentOutcomeBadge outcome={ass.outcome} />
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{ass.remarks || "No remarks"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* TAB 5: DECISIONS & REVIEW */}
        {activeTab === "decisions" && (
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader className="p-4 sm:p-6 border-b border-white/5">
              <CardTitle className="text-lg text-white">Admissions Committee Review & Decisions</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Review submitted candidate profiles, diagnostic results, and record approval/waitlist decisions with
                separation of duties governance.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {applications
                  .filter((a) => ["submitted", "under_review", "assessment"].includes(a.status))
                  .map((app) => {
                    const student = app.student || ({} as any);
                    return (
                      <div
                        key={app.id}
                        className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-3 hover:border-indigo-500/30 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-400">{app.applicationNumber}</span>
                          <AdmissionStatusBadge status={app.status} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-slate-400">
                            Grade: {grades.find((g) => g.id === app.desiredGradeId)?.name || "Grade"} | Campus: {app.campus}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/20"
                          onClick={() => {
                            setSelectedAppId(app.id);
                            setShowDecisionModal(true);
                          }}
                        >
                          Review & Record Decision
                        </Button>
                      </div>
                    );
                  })}
              </div>

              {applications.filter((a) => ["submitted", "under_review", "assessment"].includes(a.status)).length ===
                0 && (
                <div className="text-center py-8 text-slate-500">
                  All active applications have been reviewed. No candidates awaiting committee decision.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 6: FEE PACKAGES */}
        {activeTab === "fees" && (
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader className="p-4 sm:p-6 border-b border-white/5">
              <CardTitle className="text-lg text-white">Fee Package Review & Assignment</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Review and associate approved candidates with tuition fee structures, registration fees, and approved
                scholarship discounts before enrollment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs font-semibold text-slate-300">Select Approved Candidate:</span>
                <Select
                  value={selectedAppId}
                  onChange={(e) => handleLoadFeePreview(e.target.value)}
                  className="w-72 h-9 text-xs bg-slate-900 border-white/10 text-slate-200"
                >
                  <option value="">Choose an applicant...</option>
                  {applications
                    .filter((a) => ["approved", "enrolled"].includes(a.status))
                    .map((a) => {
                      const s = a.student || ({} as any);
                      return (
                        <option key={a.id} value={a.id}>
                          {a.applicationNumber} — {s.firstName} {s.lastName} ({a.status})
                        </option>
                      );
                    })}
                </Select>
              </div>

              {feePreview && (
                <div className="bg-slate-900 p-5 rounded-2xl border border-white/5 space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-sm font-bold text-white">Applicable Tuition & Fee Structures</h3>
                    <span className="text-xs font-mono text-emerald-400">
                      Total Calculated: ${(feePreview.totalTuitionCents / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {feePreview.applicableStructures?.map((st: any) => (
                      <div key={st.id} className="p-3 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-200">{st.name}</p>
                          <p className="text-[10px] text-slate-500 capitalize">{st.frequency || "Annual"}</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-indigo-400">
                          ${(st.amountCents / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleAssignFees(feePreview.applicableStructures?.map((s: any) => s.id) || [])}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                    >
                      Confirm Fee Package Assignment
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 7: ENROLLMENT CONVERSION */}
        {activeTab === "conversion" && (
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader className="p-4 sm:p-6 border-b border-white/5">
              <CardTitle className="text-lg text-white">Admissions to Enrollment Conversion</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Transactionally promote approved applicants into active students, assign sections, and establish SIS
                enrollment records with duplicate prevention.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {applications
                  .filter((a) => a.status === "approved")
                  .map((app) => {
                    const student = app.student || ({} as any);
                    return (
                      <div key={app.id} className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-400">{app.applicationNumber}</span>
                          <AdmissionStatusBadge status={app.status} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-slate-400">
                            Grade: {grades.find((g) => g.id === app.desiredGradeId)?.name || "Grade"} | Campus: {app.campus}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                          onClick={() => {
                            setSelectedAppId(app.id);
                            setSelectedGradeId(app.desiredGradeId);
                            setShowConversionModal(true);
                          }}
                        >
                          <GraduationCap className="w-3.5 h-3.5 mr-1.5" /> Convert & Admit Student
                        </Button>
                      </div>
                    );
                  })}
              </div>

              {applications.filter((a) => a.status === "approved").length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No candidate applications currently in Approved status ready for enrollment conversion.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 8: PRINTABLE DOCUMENTS */}
        {activeTab === "printing" && (
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader className="p-4 sm:p-6 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-white">Printable Admission Forms & Letters</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Official branded documents formatted for standard A4 paper printing.
                </CardDescription>
              </div>
              {printDocument && (
                <Button size="sm" onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-white text-xs">
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Document
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {!printDocument ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">Select an application to view printable letters and forms:</p>
                  <div className="flex flex-wrap gap-2">
                    {applications.slice(0, 10).map((a) => (
                      <Button
                        key={a.id}
                        variant="outline"
                        size="sm"
                        className="text-xs border-white/10 hover:bg-white/5 text-slate-300"
                        onClick={() => handleLoadPrintDocument(a.id)}
                      >
                        {a.applicationNumber} ({(a.student as any)?.firstName})
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white text-slate-900 p-8 rounded-xl max-w-3xl mx-auto space-y-6 shadow-2xl print:p-0 print:shadow-none font-serif">
                  {/* Letterhead */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight uppercase">
                        {currentOrganization?.name || "HAZA AIOS ACADEMY"}
                      </h2>
                      <p className="text-xs text-slate-600">Official Directorate of Admissions & Student Records</p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <p className="font-bold text-slate-900">{printDocument.campus}</p>
                      <p>Date: {new Date(printDocument.generatedAt).toLocaleDateString()}</p>
                      <p className="font-mono">Ref: {printDocument.applicationNumber}</p>
                    </div>
                  </div>

                  {/* Document Title */}
                  <div className="text-center py-2">
                    <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 underline underline-offset-4">
                      {printDocument.status === "approved"
                        ? "Official Admission Offer Letter"
                        : printDocument.status === "enrolled"
                        ? "Enrollment Confirmation Certificate"
                        : "Admission Application Summary"}
                    </h3>
                  </div>

                  {/* Candidate & Guardian Table */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="border border-slate-300 p-3 rounded space-y-1">
                      <p className="font-bold uppercase text-slate-700">Candidate Information</p>
                      <p>
                        <span className="font-semibold">Full Name:</span> {printDocument.student.fullName}
                      </p>
                      <p>
                        <span className="font-semibold">Date of Birth:</span> {printDocument.student.dateOfBirth}
                      </p>
                      <p>
                        <span className="font-semibold">Gender:</span> {printDocument.student.gender}
                      </p>
                      <p>
                        <span className="font-semibold">Academic Year:</span> {printDocument.academicYear}
                      </p>
                      <p>
                        <span className="font-semibold">Grade/Program:</span> {printDocument.gradeName}
                      </p>
                    </div>

                    <div className="border border-slate-300 p-3 rounded space-y-1">
                      <p className="font-bold uppercase text-slate-700">Guardian Records</p>
                      {printDocument.guardians.map((g, idx) => (
                        <div key={idx} className="pb-1">
                          <p>
                            <span className="font-semibold">Name:</span> {g.fullName} ({g.relationship})
                          </p>
                          <p>
                            <span className="font-semibold">Phone:</span> {g.phone}
                          </p>
                          <p>
                            <span className="font-semibold">Email:</span> {g.email}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Body Text */}
                  <div className="text-sm leading-relaxed text-slate-800 space-y-3">
                    {printDocument.status === "approved" && (
                      <p>
                        We are pleased to inform you that upon thorough review of the candidate diagnostic assessment
                        and academic credentials, <strong>{printDocument.student.fullName}</strong> has been offered
                        admission into <strong>{printDocument.gradeName}</strong> for the academic session{" "}
                        <strong>{printDocument.academicYear}</strong>.
                      </p>
                    )}
                    {printDocument.status === "enrolled" && (
                      <p>
                        This is to certify that <strong>{printDocument.student.fullName}</strong> is officially enrolled as
                        an active student in <strong>{printDocument.gradeName}</strong>. All institutional records and
                        student identification profiles have been verified.
                      </p>
                    )}
                  </div>

                  {/* Signature Blocks */}
                  <div className="pt-12 flex items-center justify-between text-xs text-slate-700">
                    <div className="text-center space-y-1">
                      <div className="w-48 border-b border-slate-900 mb-2"></div>
                      <p className="font-bold">Head of Admissions</p>
                      <p className="text-[10px] text-slate-500">Authorized Signatory</p>
                    </div>

                    <div className="text-center space-y-1">
                      <div className="w-48 border-b border-slate-900 mb-2"></div>
                      <p className="font-bold">Principal / Registrar</p>
                      <p className="text-[10px] text-slate-500">Institutional Seal</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 9: REPORTS & EXPORTS */}
        {activeTab === "reports" && (
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader className="p-4 sm:p-6 border-b border-white/5 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-white">Admissions & Enrollment Reports</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Comprehensive reporting on conversion ratios, campus distributions, and registration records.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={selectedReportType}
                  onChange={(e) => setSelectedReportType(e.target.value)}
                  className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200"
                >
                  <option value="conversion_summary">Conversion Summary</option>
                  <option value="enquiry_register">Enquiry Register</option>
                  <option value="application_register">Application Register</option>
                  <option value="campus_summary">Campus Breakdown</option>
                  <option value="grade_summary">Grade Breakdown</option>
                </Select>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const csvContent =
                      "data:text/csv;charset=utf-8," +
                      encodeURIComponent("Report,GeneratedAt,Organization\n" + `${selectedReportType},${new Date().toISOString()},${orgId}`);
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `admissions_${selectedReportType}.csv`);
                    document.body.appendChild(link);
                    link.click();
                  }}
                  className="border-white/10 hover:bg-white/5 text-slate-200 text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {reportData && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">{reportData.title}</h3>
                  {reportData.conversionRate && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                        <p className="text-[10px] text-slate-400 uppercase">Total Applications</p>
                        <p className="text-xl font-bold text-white mt-1">{reportData.totalApplications}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                        <p className="text-[10px] text-slate-400 uppercase">Enrolled</p>
                        <p className="text-xl font-bold text-teal-400 mt-1">{reportData.enrolled}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                        <p className="text-[10px] text-slate-400 uppercase">Approved</p>
                        <p className="text-xl font-bold text-emerald-400 mt-1">{reportData.approved}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                        <p className="text-[10px] text-slate-400 uppercase">Rejected</p>
                        <p className="text-xl font-bold text-rose-400 mt-1">{reportData.rejected}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/5">
                        <p className="text-[10px] text-slate-400 uppercase">Conversion Rate</p>
                        <p className="text-xl font-bold text-indigo-400 mt-1">{reportData.conversionRate}</p>
                      </div>
                    </div>
                  )}

                  {reportData.campuses && (
                    <div className="divide-y divide-white/5">
                      {reportData.campuses.map((c, i) => (
                        <div key={i} className="py-2.5 flex items-center justify-between text-xs text-slate-200">
                          <span className="font-semibold">{c.campus}</span>
                          <span>
                            Total: {c.totalApplications} | Enrolled: {c.enrolledStudents} ({c.conversionRate})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {reportData.rows && (
                    <p className="text-xs text-slate-400">Total Records in Register: {reportData.rowCount}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* MODAL: CREATE ENQUIRY */}
        {showEnquiryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0f141f] border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" /> Log Prospect Candidate Enquiry
              </h3>
              <form onSubmit={handleCreateEnquiry} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Student Name *</label>
                  <Input
                    required
                    value={enqStudentName}
                    onChange={(e) => setEnqStudentName(e.target.value)}
                    placeholder="Candidate full name"
                    className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Guardian Name *</label>
                    <Input
                      required
                      value={enqGuardianName}
                      onChange={(e) => setEnqGuardianName(e.target.value)}
                      placeholder="Parent/Guardian"
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Phone *</label>
                    <Input
                      required
                      value={enqPhone}
                      onChange={(e) => setEnqPhone(e.target.value)}
                      placeholder="Contact number"
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Email Address</label>
                    <Input
                      type="email"
                      value={enqEmail}
                      onChange={(e) => setEnqEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Desired Grade *</label>
                    <Select
                      value={enqGradeId}
                      onChange={(e) => setEnqGradeId(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    >
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Preferred Campus</label>
                    <Select
                      value={enqCampus}
                      onChange={(e) => setEnqCampus(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    >
                      <option value="Main Campus">Main Campus</option>
                      <option value="North Campus">North Campus</option>
                      <option value="South Campus">South Campus</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Previous School</label>
                    <Input
                      value={enqPrevSchool}
                      onChange={(e) => setEnqPrevSchool(e.target.value)}
                      placeholder="Last attended institution"
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmittingEnquiry}
                    onClick={() => setShowEnquiryModal(false)}
                    className="border-white/10 text-slate-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingEnquiry}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    {isSubmittingEnquiry ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Save Enquiry"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE APPLICATION */}
        {showApplicationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0f141f] border border-white/10 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" /> New Admission Application Form
              </h3>
              <form onSubmit={handleCreateApplication} className="space-y-3">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Candidate Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">First Name *</label>
                    <Input
                      required
                      value={appFirstName}
                      onChange={(e) => setAppFirstName(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Last Name *</label>
                    <Input
                      required
                      value={appLastName}
                      onChange={(e) => setAppLastName(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Date of Birth *</label>
                    <Input
                      type="date"
                      required
                      value={appDob}
                      onChange={(e) => setAppDob(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Gender *</label>
                    <Select
                      value={appGender}
                      onChange={(e) => setAppGender(e.target.value as any)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>
                </div>

                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider pt-2">Guardian Profile</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Guardian First Name</label>
                    <Input
                      value={appGuardianFirst}
                      onChange={(e) => setAppGuardianFirst(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Guardian Last Name</label>
                    <Input
                      value={appGuardianLast}
                      onChange={(e) => setAppGuardianLast(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Target Grade *</label>
                    <Select
                      value={appGradeId}
                      onChange={(e) => setAppGradeId(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    >
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Campus</label>
                    <Select
                      value={appCampus}
                      onChange={(e) => setAppCampus(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    >
                      <option value="Main Campus">Main Campus</option>
                      <option value="North Campus">North Campus</option>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmittingApp}
                    onClick={() => setShowApplicationModal(false)}
                    className="border-white/10 text-slate-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingApp}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {isSubmittingApp ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                      </>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RECORD ASSESSMENT */}
        {showAssessmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0f141f] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-400" /> Record Diagnostic Assessment
              </h3>
              <form onSubmit={handleRecordAssessment} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Subject / Area *</label>
                  <Input
                    required
                    value={assSubject}
                    onChange={(e) => setAssSubject(e.target.value)}
                    placeholder="e.g. Mathematics Diagnostic Test"
                    className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Max Marks</label>
                    <Input
                      type="number"
                      value={assMaxMarks}
                      onChange={(e) => setAssMaxMarks(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Obtained Marks</label>
                    <Input
                      type="number"
                      value={assObtainedMarks}
                      onChange={(e) => setAssObtainedMarks(e.target.value)}
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Remarks</label>
                  <Input
                    value={assRemarks}
                    onChange={(e) => setAssRemarks(e.target.value)}
                    placeholder="Candidate performance observations"
                    className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmittingAssessment}
                    onClick={() => setShowAssessmentModal(false)}
                    className="border-white/10 text-slate-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingAssessment}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {isSubmittingAssessment ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Save Assessment"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: COMMITTEE DECISION */}
        {showDecisionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0f141f] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" /> Record Committee Decision
              </h3>
              <form onSubmit={handleRecordDecision} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Decision Outcome *</label>
                  <Select
                    value={decisionStatus}
                    onChange={(e) => setDecisionStatus(e.target.value)}
                    className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                  >
                    <option value="approved">Approve Application</option>
                    <option value="rejected">Reject Application</option>
                    <option value="waitlisted">Place on Waitlist</option>
                    <option value="under_review">Keep Under Review</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Committee Remarks</label>
                  <Input
                    value={decisionRemarks}
                    onChange={(e) => setDecisionRemarks(e.target.value)}
                    placeholder="Rationale for admission decision"
                    className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                  />
                </div>
                {decisionStatus === "rejected" && (
                  <div>
                    <label className="text-xs text-slate-400">Reason for Rejection</label>
                    <Input
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Class capacity reached or benchmark not met"
                      className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                    />
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmittingDecision}
                    onClick={() => setShowDecisionModal(false)}
                    className="border-white/10 text-slate-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingDecision}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {isSubmittingDecision ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                      </>
                    ) : (
                      "Submit Decision"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ENROLLMENT CONVERSION */}
        {showConversionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-[#0f141f] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-400" /> Confirm Student Enrollment
              </h3>
              <form onSubmit={handleEnrollmentConversion} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Assign Section *</label>
                  <Select
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                  >
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Reuse Existing Student Record (Optional)</label>
                  <Input
                    value={reuseStudentId}
                    onChange={(e) => setReuseStudentId(e.target.value)}
                    placeholder="Existing student UUID if re-enrolling"
                    className="h-9 text-xs bg-slate-900 border-white/10 text-slate-200 mt-1"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmittingConversion}
                    onClick={() => setShowConversionModal(false)}
                    className="border-white/10 text-slate-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingConversion}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {isSubmittingConversion ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Enrolling...
                      </>
                    ) : (
                      "Finalize Enrollment"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
