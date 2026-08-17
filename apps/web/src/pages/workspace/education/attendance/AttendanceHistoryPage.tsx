import { useEffect, useState } from "react";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/routes/router";
import { Card, CardContent, Button, Input, Badge } from "@haza-aios/ui";
import { ArrowLeft, Clock, Search, Filter } from "lucide-react";
import { AttendanceService } from "@/modules/education/sis/attendance.service";
import type { AttendanceSession } from "@/modules/education/sis/sis.types";
import { AcademicService } from "@/modules/education/sis/academic.service";

export function AttendanceHistoryPage() {
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
        AcademicService.getSections(currentOrganization.id)
      ]).then(([loadedSessions, grades, sections]) => {
        setSessions(loadedSessions);
        
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/workspace/education/attendance" className="text-slate-400 hover:text-white transition-colors">
              <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center border border-white/5 hover:bg-slate-800">
                <ArrowLeft className="w-4 h-4" />
              </div>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Attendance History</h1>
              <p className="text-sm text-slate-400">View and correct past attendance sessions</p>
            </div>
          </div>
        </div>

        <Card className="bg-[#0f141f] border-white/5">
          <div className="p-4 border-b border-white/5 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search sessions..." 
                className="pl-9 bg-slate-900/50 border-white/10"
              />
            </div>
            <Button variant="outline" className="border-white/10">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
          
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-slate-500">Loading history...</div>
            ) : sessions.length === 0 ? (
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
                    {sessions.map(session => (
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
                            {session.status === "completed" ? "Completed" : "Draft"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/workspace/education/attendance/mark?sessionId=${session.id}`}>
                            <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10">
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
