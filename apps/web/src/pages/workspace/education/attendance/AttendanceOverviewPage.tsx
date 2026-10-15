import { useEffect, useState, useMemo } from "react";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/routes/router";
import { AdminPageHeader, Card, CardContent, Button, Badge } from "@haza-aios/ui";
import {
  CalendarCheck,
  ClipboardList,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Layers,
} from "lucide-react";
import { AttendanceService } from "@/modules/education/sis/attendance.service";
import type { AttendanceSession } from "@/modules/education/sis/sis.types";
import { AcademicService } from "@/modules/education/sis/academic.service";

export function AttendanceOverviewPage() {
  const { currentOrganization } = useOrganization();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gradeMap, setGradeMap] = useState<Record<string, string>>({});
  const [sectionMap, setSectionMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentOrganization) {
      Promise.all([
        AttendanceService.getSessions(currentOrganization.id),
        AcademicService.getGrades(currentOrganization.id),
        AcademicService.getSections(currentOrganization.id),
      ])
        .then(([allSessions, grades, sections]) => {
          setSessions(allSessions);

          const gMap: Record<string, string> = {};
          grades.forEach((g) => (gMap[g.id] = g.name));
          setGradeMap(gMap);

          const sMap: Record<string, string> = {};
          sections.forEach((s) => (sMap[s.id] = s.name));
          setSectionMap(sMap);

          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [currentOrganization]);

  const recentSessions = useMemo(() => sessions.slice(0, 5), [sessions]);
  const completedCount = useMemo(
    () => sessions.filter((s) => s.status === "completed").length,
    [sessions]
  );
  const draftCount = useMemo(
    () => sessions.filter((s) => s.status === "draft").length,
    [sessions]
  );
  const uniqueClassesCount = useMemo(
    () => new Set(sessions.map((s) => s.gradeId)).size,
    [sessions]
  );

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Link
            to="/workspace"
            className="hover:text-white transition-colors flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workspace
          </Link>
        </div>

        <AdminPageHeader
          title="Attendance Management"
          description="Track and manage student attendance sessions, review attendance history, and analyze summaries."
          actions={
            <Link to="/workspace/education/attendance/mark">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 rounded-xl">
                <CalendarCheck className="w-4 h-4 mr-2" />
                Mark Attendance
              </Button>
            </Link>
          }
        />

        {/* Metric Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#0f141f] border-white/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Completed
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
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  In Progress / Draft
                </p>
                <p className="text-2xl font-bold text-amber-400 mt-0.5">{draftCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f141f] border-white/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                  Classes Tracked
                </p>
                <p className="text-2xl font-bold text-purple-400 mt-0.5">{uniqueClassesCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/workspace/education/attendance/mark" className="block group">
            <Card className="bg-[#0f141f] border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Mark Attendance</h3>
                    <p className="text-sm text-slate-400">
                      Record daily or subject attendance with roster loading and bulk marking.
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/workspace/education/attendance/history" className="block group">
            <Card className="bg-[#0f141f] border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Attendance History</h3>
                    <p className="text-sm text-slate-400">
                      Filter, view, and edit past sessions by date, class, and section.
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/workspace/education/analytics/reports" className="block group">
            <Card className="bg-[#0f141f] border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all h-full">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 text-purple-400 group-hover:scale-110 transition-transform">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Attendance Reports</h3>
                    <p className="text-sm text-slate-400">
                      Generate official attendance summaries, class analytics, and exports.
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-colors shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Sessions Table */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Attendance Sessions</h2>
            <Link
              to="/workspace/education/attendance/history"
              className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All Sessions
            </Link>
          </div>

          <Card className="bg-[#0f141f] border-white/5">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-slate-500">Loading recent sessions...</div>
              ) : recentSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  No attendance sessions found. Start by marking attendance for a class.
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
                        <th className="px-6 py-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentSessions.map((session) => (
                        <tr
                          key={session.id}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-white">
                            {new Date(session.date + "T00:00:00").toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-white">
                              {gradeMap[session.gradeId] || session.gradeId}
                            </span>
                            <span className="text-slate-400 ml-1.5">
                              — Section {sectionMap[session.sectionId] || session.sectionId}
                            </span>
                          </td>
                          <td className="px-6 py-4 capitalize text-slate-300">
                            {session.sessionType}
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={session.status === "completed" ? "success" : "warning"}
                              className="text-xs uppercase tracking-wider"
                            >
                              {session.status === "completed" ? "Completed" : "Draft"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link to={`/workspace/education/attendance/mark?sessionId=${session.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg text-xs"
                              >
                                {session.status === "completed" ? "View / Edit" : "Continue"}
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
      </div>
    </AppShell>
  );
}
