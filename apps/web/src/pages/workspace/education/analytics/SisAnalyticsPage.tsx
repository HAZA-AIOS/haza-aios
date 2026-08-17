import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { SisAnalyticsService } from "@/modules/education/sis/analytics.service";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { useCurrentUser } from "@/auth/use-auth";
import { useOrganization } from "@/org/use-organization";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";
import type {
  AcademicYear,
  Grade,
  Section,
  SisAnalyticsActor,
  SisAnalyticsFilters,
  SisAnalyticsOverview,
  SisHealthOverview,
  SisReportKind,
  SisReportResult,
} from "@/modules/education/sis/sis.types";
import { AdminPageHeader, Badge, Button, Card, CardContent, Input, Select } from "@haza-aios/ui";
import { ArrowLeft, BarChart3, CheckCircle2, Download, FileWarning, HeartPulse, Printer } from "lucide-react";

type AnalyticsTab = "overview" | "reports" | "quality" | "health";

const reportKinds: Array<{ value: SisReportKind; label: string }> = [
  { value: "student_directory", label: "Student Directory" },
  { value: "staff_directory", label: "Staff Directory" },
  { value: "attendance_summary", label: "Attendance Summary" },
  { value: "timetable_summary", label: "Timetable Summary" },
  { value: "results_summary", label: "Results Summary" },
  { value: "finance_collection", label: "Finance Collection" },
  { value: "communication_delivery", label: "Communication Delivery" },
];

function cents(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
}

export function SisAnalyticsPage({ initialTab = "overview" }: { initialTab?: AnalyticsTab }) {
  const user = useCurrentUser();
  const { currentOrganization, currentMembership } = useOrganization();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filters, setFilters] = useState<SisAnalyticsFilters>({});
  const [overview, setOverview] = useState<SisAnalyticsOverview | null>(null);
  const [health, setHealth] = useState<SisHealthOverview | null>(null);
  const [reportKind, setReportKind] = useState<SisReportKind>("student_directory");
  const [report, setReport] = useState<SisReportResult | null>(null);
  const [csvPreview, setCsvPreview] = useState("");

  const actor = useMemo<SisAnalyticsActor | undefined>(() => {
    if (!user) return undefined;
    return {
      userId: user.id,
      role: currentMembership?.role || "Owner",
    };
  }, [currentMembership?.role, user]);

  const loadData = useCallback(async () => {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      const [yearData, gradeData, sectionData, overviewData, healthData, reportData] = await Promise.all([
        AcademicService.getAcademicYears(orgId),
        AcademicService.getGrades(orgId),
        AcademicService.getSections(orgId),
        SisAnalyticsService.getOverview(orgId, filters, actor),
        SisAnalyticsService.getHealth(orgId, filters, actor),
        SisAnalyticsService.getReport(orgId, reportKind, filters, actor),
      ]);
      setYears(yearData);
      setGrades(gradeData);
      setSections(sectionData);
      setOverview(overviewData);
      setHealth(healthData);
      setReport(reportData);
      if (!filters.academicYearId && yearData[0]) setFilters((current) => ({ ...current, academicYearId: yearData.find((year) => year.status === "active")?.id || yearData[0].id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load SIS analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [actor, currentOrganization, filters, reportKind]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function exportCsv() {
    if (!currentOrganization) return;
    setMessage(null);
    setError(null);
    try {
      const csv = await SisAnalyticsService.exportCsv(currentOrganization.id, reportKind, filters, actor);
      setCsvPreview(csv.slice(0, 1200));
      setMessage("CSV export generated with active filters.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV export failed.");
    }
  }

  function printReport() {
    window.print();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <AdminPageHeader
          title="SIS Analytics & Reports"
          description="Operational analytics, filtered reporting, CSV export, data quality checks, and SIS readiness."
          breadcrumbs={[{ label: "Workspace", onClick: () => navigate("/workspace") }, { label: "Education" }, { label: "Analytics & Reports" }]}
          actions={<Badge variant="secondary">Operational Completion</Badge>}
        />

        <Link to="/workspace" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Workspace
        </Link>

        {message && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

        <Card className="border-white/5 bg-[#0f141f]">
          <CardContent className="grid gap-3 p-4 md:grid-cols-5">
            <Select value={filters.academicYearId || ""} onChange={(event) => setFilters({ ...filters, academicYearId: event.target.value || undefined })}>
              <option value="">All Academic Years</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </Select>
            <Select value={filters.gradeId || ""} onChange={(event) => setFilters({ ...filters, gradeId: event.target.value || undefined, sectionId: undefined })}>
              <option value="">All Classes</option>
              {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
            </Select>
            <Select value={filters.sectionId || ""} onChange={(event) => setFilters({ ...filters, sectionId: event.target.value || undefined })}>
              <option value="">All Sections</option>
              {sections.filter((section) => !filters.gradeId || section.gradeId === filters.gradeId).map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </Select>
            <Input type="date" value={filters.dateFrom || ""} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value || undefined })} />
            <Input type="date" value={filters.dateTo || ""} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value || undefined })} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {(["overview", "reports", "quality", "health"] as AnalyticsTab[]).map((tab) => (
            <Button key={tab} variant={activeTab === tab ? "default" : "outline"} onClick={() => setActiveTab(tab)}>
              {tab === "overview" ? "Overview" : tab === "reports" ? "Reports" : tab === "quality" ? "Data Quality" : "SIS Health"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <Card className="border-white/5 bg-[#0f141f]"><CardContent className="p-8 text-slate-400">Loading SIS analytics...</CardContent></Card>
        ) : (
          <>
            {activeTab === "overview" && overview && <OverviewTab overview={overview} />}
            {activeTab === "reports" && report && (
              <ReportsTab
                report={report}
                reportKind={reportKind}
                csvPreview={csvPreview}
                onReportKind={setReportKind}
                onExport={exportCsv}
                onPrint={printReport}
              />
            )}
            {activeTab === "quality" && health && <QualityTab health={health} />}
            {activeTab === "health" && health && <HealthTab health={health} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function OverviewTab({ overview }: { overview: SisAnalyticsOverview }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Active Students" value={overview.students.active} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Active Teachers" value={overview.staff.activeTeachers} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Attendance Rate" value={`${overview.attendance.attendancePercentage}%`} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Collection Rate" value={`${overview.finance.collectionRate}%`} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Scheduled Classes" value={overview.timetable.scheduledClasses} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Published Results" value={overview.results.publishedResults} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Outstanding" value={cents(overview.finance.outstandingCents)} />
        <MetricCard icon={<BarChart3 className="h-5 w-5" />} label="Failed Deliveries" value={overview.communication.failedDeliveries} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Distribution title="Class Distribution" rows={overview.students.byClass} />
        <Distribution title="Teacher Load" rows={overview.timetable.teacherLoad} />
        <Distribution title="Period Utilization" rows={overview.timetable.periodUtilization} />
      </div>
    </div>
  );
}

function ReportsTab({ report, reportKind, csvPreview, onReportKind, onExport, onPrint }: { report: SisReportResult; reportKind: SisReportKind; csvPreview: string; onReportKind: (kind: SisReportKind) => void; onExport: () => void; onPrint: () => void }) {
  return (
    <div className="space-y-4">
      <Card className="border-white/5 bg-[#0f141f]">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={reportKind} onChange={(event) => onReportKind(event.target.value as SisReportKind)} className="max-w-xs">
            {reportKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
          </Select>
          <Button onClick={onExport}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="secondary" onClick={onPrint}><Printer className="mr-2 h-4 w-4" />Print</Button>
          <Badge variant="secondary">{report.rows.length} rows</Badge>
        </CardContent>
      </Card>
      <ReportTable report={report} />
      {csvPreview && (
        <Card className="border-white/5 bg-[#0f141f]">
          <CardContent className="space-y-2 p-6">
            <h2 className="text-lg font-semibold text-white">CSV Preview</h2>
            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{csvPreview}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QualityTab({ health }: { health: SisHealthOverview }) {
  return (
    <RecordList
      title="Data Quality Issues"
      icon={<FileWarning className="h-5 w-5 text-red-400" />}
      rows={health.dataQuality.map((issue) => ({ id: issue.id, title: issue.title, meta: `${issue.category} - ${issue.details}`, status: issue.severity }))}
      empty="No data quality issues detected."
    />
  );
}

function HealthTab({ health }: { health: SisHealthOverview }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <RecordList title="Operational Readiness" icon={<HeartPulse className="h-5 w-5 text-red-400" />} rows={health.readiness.map((item) => ({ id: item.key, title: item.label, meta: item.details, status: item.status }))} empty="No readiness checks." />
        <RecordList title="SIS Module Completion" icon={<CheckCircle2 className="h-5 w-5 text-red-400" />} rows={health.modules.map((item) => ({ id: item.epic, title: `${item.epic} ${item.module}`, meta: item.details, status: item.status }))} empty="No module status available." />
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="flex min-h-28 items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs uppercase text-slate-500">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold text-white">{value}</p>
        </div>
        <div className="shrink-0 rounded-xl bg-red-500/10 p-3 text-red-400">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Distribution({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {rows.length === 0 ? <p className="text-sm text-slate-500">No data available.</p> : rows.slice(0, 8).map((row) => (
          <div key={row.label} className="space-y-1">
            <div className="flex justify-between text-sm"><span className="text-slate-300">{row.label}</span><span className="text-white">{row.value}</span></div>
            <div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-red-500" style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ReportTable({ report }: { report: SisReportResult }) {
  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">{report.title}</h2>
        <div className="overflow-auto rounded-lg border border-white/5">
          <table className="min-w-full divide-y divide-white/5 text-sm">
            <thead className="bg-slate-950/60">
              <tr>{report.columns.map((column) => <th key={column.key} className="px-4 py-3 text-left font-medium text-slate-300">{column.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {report.rows.length === 0 ? (
                <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={report.columns.length}>No report rows for the active filters.</td></tr>
              ) : report.rows.slice(0, 80).map((row, index) => (
                <tr key={`${report.kind}-${index}`}>{report.columns.map((column) => <td key={column.key} className="px-4 py-3 text-slate-300">{String(row[column.key] ?? "")}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function RecordList({ title, icon, rows, empty }: { title: string; icon: ReactNode; rows: Array<{ id: string; title: string; meta: string; status?: string }>; empty: string }) {
  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="space-y-3 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">{icon}{title}</h2>
        {rows.length === 0 ? <div className="rounded-lg border border-white/5 py-8 text-center text-sm text-slate-500">{empty}</div> : (
          <div className="divide-y divide-white/5 rounded-lg border border-white/5">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{row.title}</p>
                  <p className="truncate text-sm text-slate-400">{row.meta}</p>
                </div>
                {row.status && <Badge variant="secondary">{row.status}</Badge>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SisAnalyticsOverviewPage() {
  return <SisAnalyticsPage initialTab="overview" />;
}

export function SisReportsPage() {
  return <SisAnalyticsPage initialTab="reports" />;
}

export function SisDataQualityPage() {
  return <SisAnalyticsPage initialTab="quality" />;
}

export function SisHealthPage() {
  return <SisAnalyticsPage initialTab="health" />;
}
