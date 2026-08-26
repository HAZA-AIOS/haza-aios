import { useState, useEffect } from "react";
import { Link } from "@/routes/router";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { timetableService } from "@/modules/education/sis/timetable.service";
import type { TimePeriod, SchoolSchedule, PeriodType } from "@/modules/education/sis/sis.types";
import { DashboardCard, Button } from "@haza-aios/ui";

export function ScheduleConfigPage() {
  const { currentOrganization: currentOrg } = useOrganization();
  const [schedule, setSchedule] = useState<SchoolSchedule | null>(null);
  const [periods, setPeriods] = useState<TimePeriod[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:00");
  const [days, setDays] = useState<number[]>([1,2,3,4,5]); // Mon-Fri default

  useEffect(() => {
    async function loadData() {
      if (!currentOrg) return;
      try {
        const [sch, per] = await Promise.all([
          timetableService.getSchoolSchedule(currentOrg.id, 'current-year'),
          timetableService.getPeriods(currentOrg.id)
        ]);
        if (sch) {
          setSchedule(sch);
          setStart(sch.scheduleStartTime);
          setEnd(sch.scheduleEndTime);
          setDays(sch.workingDays);
        }
        setPeriods(per);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentOrg]);

  const saveSchedule = async () => {
    if (!currentOrg) return;
    try {
      const saved = await timetableService.saveSchoolSchedule(currentOrg.id, {
        academicYearId: 'current-year',
        workingDays: days,
        scheduleStartTime: start,
        scheduleEndTime: end
      });
      setSchedule(saved);
      alert("Schedule saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save schedule.");
    }
  };

  const addPeriod = async () => {
    if (!currentOrg) return;
    try {
      const newPeriod = await timetableService.savePeriod(currentOrg.id, {
        name: `New Period ${periods.length + 1}`,
        startTime: "00:00",
        endTime: "00:45",
        type: "teaching",
        displayOrder: periods.length + 1
      });
      setPeriods([...periods, newPeriod]);
    } catch (err) {
      console.error(err);
    }
  };

  const deletePeriod = async (id: string) => {
    if (!currentOrg) return;
    if (confirm("Are you sure? This will delete associated timetable entries.")) {
      await timetableService.deletePeriod(currentOrg.id, id);
      setPeriods(periods.filter(p => p.id !== id));
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-slate-400">Loading configuration...</div>
      </AppShell>
    );
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <AppShell>
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center space-x-4">
        <Link to="/workspace/education/timetable" className="text-slate-400 hover:text-white transition-colors">
          ← Back to Overview
        </Link>
        <div className="border-l border-slate-700 pl-4">
          <h1 className="text-2xl font-semibold text-white">Schedule Configuration</h1>
          <p className="text-sm text-slate-500">
            {schedule ? "Schedule saved for the current academic year." : "No saved schedule yet."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashboardCard>
          <h2 className="text-lg font-semibold text-white">Working Days & Hours</h2>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Active Days</label>
              <div className="flex flex-wrap gap-2">
                {dayNames.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (days.includes(idx)) setDays(days.filter(d => d !== idx));
                      else setDays([...days, idx].sort());
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      days.includes(idx) 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Start Time</label>
                <input 
                  type="time" 
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">End Time</label>
                <input 
                  type="time" 
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white" 
                />
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={saveSchedule} className="w-full">Save Schedule Settings</Button>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="text-lg font-semibold text-white">Time Periods</h2>
          <div className="space-y-3 mt-4">
            {periods.map((period, index) => (
              <div key={period.id} className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-md">
                <div className="flex-1 space-y-2">
                  <input 
                    type="text"
                    value={period.name}
                    onChange={e => {
                      const newP = [...periods];
                      newP[index].name = e.target.value;
                      setPeriods(newP);
                    }}
                    className="w-full bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-white px-1"
                  />
                  <div className="flex gap-2">
                    <input type="time" value={period.startTime} onChange={e => { const newP = [...periods]; newP[index].startTime = e.target.value; setPeriods(newP); }} className="bg-slate-800 text-xs rounded px-2 py-1 text-slate-300 w-24" />
                    <span className="text-slate-500">-</span>
                    <input type="time" value={period.endTime} onChange={e => { const newP = [...periods]; newP[index].endTime = e.target.value; setPeriods(newP); }} className="bg-slate-800 text-xs rounded px-2 py-1 text-slate-300 w-24" />
                    <select value={period.type} onChange={e => { const newP = [...periods]; newP[index].type = e.target.value as PeriodType; setPeriods(newP); }} className="bg-slate-800 text-xs rounded px-2 py-1 text-slate-300">
                      <option value="teaching">Teaching</option>
                      <option value="break">Break</option>
                      <option value="activity">Activity</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => timetableService.savePeriod(currentOrg!.id, period).then(() => alert('Saved'))} className="text-xs text-blue-400 hover:text-blue-300">Save</button>
                  <button onClick={() => deletePeriod(period.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            ))}
            
            <Button variant="outline" onClick={addPeriod} className="w-full mt-4">
              + Add Period
            </Button>
          </div>
        </DashboardCard>
      </div>
    </div>
    </AppShell>
  );
}
