import { useEffect, useState, useMemo } from "react";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/routes/router";
import { Card, CardContent, Button, Input, Badge } from "@haza-aios/ui";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Plus,
} from "lucide-react";
import { AttendanceService } from "@/modules/education/sis/attendance.service";
import { AcademicService } from "@/modules/education/sis/academic.service";
import type {
  AttendanceSession,
  Grade,
  Section,
  AcademicYear,
} from "@/modules/education/sis/sis.types";

export function AttendanceHistoryPage() {
  const { currentOrganization } = useOrganization();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterGradeId, setFilterGradeId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [gradeMap, setGradeMap] = useState<Record<string, string>>({});
  const [sectionMap, setSectionMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentOrganization) {
      void loadData();
    }
  }, [currentOrganization]);

  const loadData = async () => {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      const [loadedSessions, loadedGrades, loadedSections, loadedYears] = await Promise.all([
        AttendanceService.getSessions(orgId),
        AcademicService.getGrades(orgId),
        AcademicService.getSections(orgId),
        AcademicService.getAcademicYears(orgId),
      ]);

      setSessions(loadedSessions);
      setGrades(loadedGrades);
      setSections(loadedSections);
      setAcademicYears(loadedYears);

      const gMap: Record<string, string> = {};
      loadedGrades.forEach((g) => (gMap[g.id] = g.name));
      setGradeMap(gMap);

      const sMap: Record<string, string> = {};
      loadedSections.forEach((s) => (sMap[s.id] = s.name));
      setSectionMap(sMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance history.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    setFilterDate("");
    setFilterGradeId("");
    setFilterSectionId("");
    setFilterStatus("all");
    setSearchQuery("");
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterDate && s.date !== filterDate) return false;
      if (filterGradeId && s.gradeId !== filterGradeId) return false;
      if (filterSectionId && s.sectionId !== filterSectionId) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const gName = (gradeMap[s.gradeId] || "").toLowerCase();
        const sName = (sectionMap[s.sectionId] || "").toLowerCase();
        const dStr = s.date.toLowerCase();
        if (!gName.includes(query) && !sName.includes(query) && !dStr.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, filterDate, filterGradeId, filterSectionId, filterStatus, searchQuery, gradeMap, sectionMap]);

  // Statistics
  const completedCount = useMemo(() => sessions.filter((s) => s.status === "completed").length, [sessions]);
  const draftCount = useMemo(() => sessions.filter((s) => s.status === "draft").length, [sessions]);

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/workspace/education/attendance"
              className="text-slate-400 hover:text-white transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-800/60 flex items-center justify-center border border-white/5 hover:bg-slate-800">
                <ArrowLeft className="w-4 h-4" />
              </div>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Attendance History</h1>
              <p className="text-sm text-slate-400">
                Review, filter, and modify past attendance records and sessions
              </p>
            </div>
          </div>

          <Link to="/workspace/education/attendance/mark">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-950/20">
              <Plus className="w-4 h-4 mr-2" />
              Mark Attendance
            </Button>
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-[#0f141f] border-white/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Total Sessions
                </p>
                <p className="text-2xl font-bold text-white mt-0.5">{sessions.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f141f] border-white/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
                  Completed Sessions
                </p>
                <p className="text-2xl font-bold text-emerald-400 mt-0.5">{completedCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f141f] border-white/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">
                  Draft Sessions
                </p>
                <p className="text-2xl font-bold text-amber-400 mt-0.5">{draftCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Toolbar */}
        <Card className="bg-[#0f141f] border-white/5">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search class or date..."
                  aria-label="Search sessions"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-900/50 border-white/10 text-white rounded-xl text-sm"
                />
              </div>

              <div>
                <select
                  aria-label="Filter by class"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={filterGradeId}
                  onChange={(e) => {
                    setFilterGradeId(e.target.value);
                    setFilterSectionId("");
                  }}
                >
                  <option value="">All Classes</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  aria-label="Filter by section"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={filterSectionId}
                  onChange={(e) => setFilterSectionId(e.target.value)}
                  disabled={!filterGradeId}
                >
                  <option value="">All Sections</option>
                  {sections
                    .filter((s) => !filterGradeId || s.gradeId === filterGradeId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <Input
                  type="date"
                  aria-label="Filter by date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-slate-900/50 border-white/10 text-white rounded-xl text-sm"
                />
              </div>

              <div>
                <select
                  aria-label="Filter by status"
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {(filterDate || filterGradeId || filterSectionId || filterStatus !== "all" || searchQuery) && (
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-xs text-slate-400">
                  Showing {filteredSessions.length} of {sessions.length} sessions
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Reset Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sessions Table */}
        <Card className="bg-[#0f141f] border-white/5">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto animate-spin text-slate-500 mb-2" />
                <p className="text-sm">Loading attendance history...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Calendar className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                <p className="text-base font-medium text-white">No attendance sessions found</p>
                <p className="text-sm text-slate-500 mt-1">
                  {sessions.length === 0
                    ? "Start your first attendance session to track student presence."
                    : "No sessions matched the active filters. Try clearing or adjusting filters."}
                </p>
                {sessions.length === 0 ? (
                  <Link to="/workspace/education/attendance/mark">
                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                      Start First Session
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleResetFilters}
                    className="mt-4 border-white/10 text-white rounded-xl"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-900/50 text-slate-400 tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Class / Section</th>
                      <th className="px-6 py-4 font-semibold">Session Type</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredSessions.map((sessionItem) => (
                      <tr
                        key={sessionItem.id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-white">
                          {new Date(sessionItem.date + "T00:00:00").toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-white">
                            {gradeMap[sessionItem.gradeId] || sessionItem.gradeId}
                          </span>
                          <span className="text-slate-400 ml-1.5">
                            — Section {sectionMap[sessionItem.sectionId] || sessionItem.sectionId}
                          </span>
                        </td>
                        <td className="px-6 py-4 capitalize text-slate-300">
                          {sessionItem.sessionType}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={sessionItem.status === "completed" ? "success" : "warning"}
                            className="text-xs uppercase tracking-wider"
                          >
                            {sessionItem.status === "completed" ? "Completed" : "Draft"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/workspace/education/attendance/mark?sessionId=${sessionItem.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg text-xs"
                            >
                              View / Edit
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
