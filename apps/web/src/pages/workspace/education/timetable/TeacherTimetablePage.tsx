import { useState, useEffect } from "react";
import { Link } from "@/routes/router";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { timetableService } from "@/modules/education/sis/timetable.service";
import type { TimePeriod, SchoolSchedule, TimetableEntry } from "@/modules/education/sis/sis.types";
import { DashboardCard } from "@haza-aios/ui";

export function TeacherTimetablePage() {
  const { currentOrganization: currentOrg } = useOrganization();
  const [schedule, setSchedule] = useState<SchoolSchedule | null>(null);
  const [periods, setPeriods] = useState<TimePeriod[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState("t1");

  useEffect(() => {
    async function loadData() {
      if (!currentOrg) return;
      try {
        const [sch, per, ent] = await Promise.all([
          timetableService.getSchoolSchedule(currentOrg.id, 'current-year'),
          timetableService.getPeriods(currentOrg.id),
          timetableService.getTimetableEntries(currentOrg.id, { teacherId })
        ]);
        setSchedule(sch);
        setPeriods(per);
        setEntries(ent);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentOrg, teacherId]);

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-slate-400">Loading teacher timetable...</div>
      </AppShell>
    );
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const activeDays = schedule ? schedule.workingDays : [1,2,3,4,5];

  return (
    <AppShell>
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/workspace/education/timetable" className="text-slate-400 hover:text-white transition-colors">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-white border-l border-slate-700 pl-4">Teacher Timetable</h1>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 text-sm">View for:</span>
          <select 
            value={teacherId} 
            onChange={(e) => setTeacherId(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-sm rounded px-3 py-1.5"
          >
            <option value="t1">Teacher 1 (t1)</option>
            <option value="t2">Teacher 2 (t2)</option>
          </select>
        </div>
      </div>

      <DashboardCard>
        <h2 className="text-lg font-semibold text-white">Weekly Schedule - {teacherId}</h2>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="p-3 border-b border-slate-700 text-slate-400 font-medium bg-slate-900">Period</th>
                {activeDays.map(day => (
                  <th key={day} className="p-3 border-b border-slate-700 text-slate-400 font-medium bg-slate-900">
                    {dayNames[day]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(period => (
                <tr key={period.id} className="border-b border-slate-800">
                  <td className="p-3 bg-slate-900/50">
                    <div className="text-sm font-medium text-white">{period.name}</div>
                    <div className="text-xs text-slate-500">{period.startTime} - {period.endTime}</div>
                  </td>
                  {activeDays.map(day => {
                    const entry = entries.find(e => e.dayOfWeek === day && e.periodId === period.id);
                    return (
                      <td key={day} className="p-3 border-l border-slate-800">
                        {entry ? (
                          <div className="bg-slate-800 p-2 rounded">
                            <div className="text-sm font-medium text-blue-400">{entry.subjectId}</div>
                            <div className="text-xs text-slate-400">Class: {entry.gradeId} - {entry.sectionId}</div>
                          </div>
                        ) : (
                          period.type === 'teaching' ? (
                            <div className="text-xs text-slate-600">Free</div>
                          ) : (
                            <div className="text-xs text-slate-600 uppercase tracking-wider">{period.type}</div>
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
    </AppShell>
  );
}
