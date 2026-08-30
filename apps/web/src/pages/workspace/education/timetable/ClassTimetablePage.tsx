import { useState, useEffect } from "react";
import { Link } from "@/routes/router";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { timetableService } from "@/modules/education/sis/timetable.service";
import { AcademicService } from "@/modules/education/sis/academic.service";
import type { TimePeriod, SchoolSchedule, TimetableEntry } from "@/modules/education/sis/sis.types";
import { DashboardCard } from "@haza-aios/ui";

export function ClassTimetablePage() {
  const { currentOrganization: currentOrg } = useOrganization();
  const [schedule, setSchedule] = useState<SchoolSchedule | null>(null);
  const [periods, setPeriods] = useState<TimePeriod[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock selection
  const gradeId = "grade-1";
  const sectionId = "section-a";

  useEffect(() => {
    async function loadData() {
      if (!currentOrg) return;
      try {
        const [activeYear, per] = await Promise.all([
          AcademicService.getActiveAcademicYear(currentOrg.id),
          timetableService.getPeriods(currentOrg.id)
        ]);
        const [sch, ent] = await Promise.all([
          activeYear ? timetableService.getSchoolSchedule(currentOrg.id, activeYear.id) : Promise.resolve(null),
          timetableService.getTimetableEntries(currentOrg.id, {
            ...(activeYear ? { academicYearId: activeYear.id } : {}),
            gradeId,
            sectionId,
          })
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
  }, [currentOrg]);

  const addEntry = async (dayOfWeek: number, periodId: string) => {
    if (!currentOrg) return;
    const activeYear = await AcademicService.getActiveAcademicYear(currentOrg.id);
    if (!activeYear) {
      alert("Create and activate an academic year before adding timetable entries.");
      return;
    }
    const teacherId = prompt("Enter Teacher ID (e.g. t1):");
    const subjectId = prompt("Enter Subject ID (e.g. s1):");
    if (!teacherId || !subjectId) return;

    try {
      const newEntry = await timetableService.saveTimetableEntry(currentOrg.id, {
        academicYearId: activeYear.id,
        gradeId,
        sectionId,
        subjectId,
        teacherId,
        dayOfWeek,
        periodId,
      });
      setEntries([...entries, newEntry]);
      alert("Added successfully!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed to add entry: ${message}`);
    }
  };

  const removeEntry = async (id: string) => {
    if (!currentOrg) return;
    if (confirm("Remove this entry?")) {
      await timetableService.deleteTimetableEntry(currentOrg.id, id);
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-slate-400">Loading class timetable...</div>
      </AppShell>
    );
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const activeDays = schedule ? schedule.workingDays : [1,2,3,4,5];

  return (
    <AppShell>
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/workspace/education/timetable" className="text-slate-400 hover:text-white transition-colors">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-white border-l border-slate-700 pl-4">Class Timetable (Grade 1 - A)</h1>
        </div>
      </div>

      <DashboardCard>
        <h2 className="text-lg font-semibold text-white">Weekly View</h2>
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
                      <td key={day} className="p-3 border-l border-slate-800 relative group min-w-[150px]">
                        {entry ? (
                          <div className="bg-slate-800 p-2 rounded relative">
                            <div className="text-sm font-medium text-blue-400">{entry.subjectId}</div>
                            <div className="text-xs text-slate-400">Teacher: {entry.teacherId}</div>
                            <button 
                              onClick={() => removeEntry(entry.id)}
                              className="absolute top-1 right-1 text-xs text-red-400 hidden group-hover:block bg-slate-900 rounded-full w-4 h-4 flex items-center justify-center"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          period.type === 'teaching' ? (
                            <button 
                              onClick={() => addEntry(day, period.id)}
                              className="w-full h-full min-h-[50px] border border-dashed border-slate-700 rounded text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors text-xs flex items-center justify-center"
                            >
                              + Add
                            </button>
                          ) : (
                            <div className="text-xs text-slate-600 text-center uppercase tracking-wider">{period.type}</div>
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

