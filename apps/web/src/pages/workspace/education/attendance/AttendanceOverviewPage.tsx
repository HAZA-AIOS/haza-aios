import { useEffect, useState } from "react";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/routes/router";
import { AdminPageHeader, Card, CardContent, Button, Badge } from "@haza-aios/ui";
import { 
  CalendarCheck, ClipboardList, Clock, CheckCircle2, XCircle, ArrowRight, ArrowLeft 
} from "lucide-react";
import { AttendanceService } from "@/modules/education/sis/attendance.service";
import type { AttendanceSession } from "@/modules/education/sis/sis.types";
import { AcademicService } from "@/modules/education/sis/academic.service";

export function AttendanceOverviewPage() {
  const { currentOrganization } = useOrganization();
  const [recentSessions, setRecentSessions] = useState<AttendanceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gradeMap, setGradeMap] = useState<Record<string, string>>({});
  const [sectionMap, setSectionMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentOrganization) {
      Promise.all([
        AttendanceService.getSessions(currentOrganization.id),
        AcademicService.getGrades(currentOrganization.id),
        AcademicService.getSections(currentOrganization.id)
      ]).then(([sessions, grades, sections]) => {
        setRecentSessions(sessions.slice(0, 5));
        
        const gMap: Record<string, string> = {};
        grades.forEach(g => gMap[g.id] = g.name);
        setGradeMap(gMap);
        
        const sMap: Record<string, string> = {};
        sections.forEach(s => sMap[s.id] = s.name);
        setSectionMap(sMap);
        
        setIsLoading(false);
      });
    }
  }, [currentOrganization]);

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Link to="/workspace" className="hover:text-white transition-colors flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Workspace
          </Link>
        </div>

        <AdminPageHeader
          title="Attendance Management"
          description="Track and manage student attendance, view history, and generate reports."
          actions={
            <Link to="/workspace/education/attendance/mark">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20">
                <CalendarCheck className="w-4 h-4 mr-2" />
                Mark Attendance
              </Button>
            </Link>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/workspace/education/attendance/mark" className="block group">
            <Card className="bg-[#0f141f] border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Mark Attendance</h3>
                    <p className="text-sm text-slate-400">Record daily or period attendance for a class.</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/workspace/education/attendance/history" className="block group">
            <Card className="bg-[#0f141f] border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Attendance History</h3>
                    <p className="text-sm text-slate-400">View and correct past attendance records.</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="#" className="block group">
            <Card className="bg-[#0f141f] border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all opacity-75">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 text-purple-400 group-hover:scale-110 transition-transform">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1">Reports</h3>
                    <p className="text-sm text-slate-400">Generate attendance summaries and statistics.</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Attendance Sessions</h2>
            <Link to="/workspace/education/attendance/history" className="text-sm text-blue-400 hover:text-blue-300">
              View All
            </Link>
          </div>
          
          <Card className="bg-[#0f141f] border-white/5">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-slate-500">Loading sessions...</div>
              ) : recentSessions.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  No attendance sessions found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
                      <tr>
                        <th className="px-6 py-4 font-medium">Date</th>
                        <th className="px-6 py-4 font-medium">Class / Section</th>
                        <th className="px-6 py-4 font-medium">Type</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentSessions.map(session => (
                        <tr key={session.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-medium text-white">
                            {new Date(session.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            {gradeMap[session.gradeId] || session.gradeId} - {sectionMap[session.sectionId] || session.sectionId}
                          </td>
                          <td className="px-6 py-4 capitalize">{session.sessionType}</td>
                          <td className="px-6 py-4">
                            <Badge variant={session.status === "completed" ? "success" : "warning"} className="flex w-max items-center gap-1.5">
                              {session.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                              {session.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link to={`/workspace/education/attendance/mark?sessionId=${session.id}`}>
                              <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10">
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
