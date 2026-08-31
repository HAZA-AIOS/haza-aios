import { useState, useEffect } from "react";
import { Link } from "@/routes/router";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { timetableService } from "@/modules/education/sis/timetable.service";
import { AcademicService } from "@/modules/education/sis/academic.service";
import type { TimePeriod, SchoolSchedule } from "@/modules/education/sis/sis.types";
import { DashboardCard, StatCard, Button } from "@haza-aios/ui";

export function TimetableOverviewPage() {
  const { currentOrganization: currentOrg } = useOrganization();
  const [schedule, setSchedule] = useState<SchoolSchedule | null>(null);
  const [periods, setPeriods] = useState<TimePeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!currentOrg) return;
      try {
        const [activeYear, per] = await Promise.all([
          AcademicService.getActiveAcademicYear(currentOrg.id),
          timetableService.getPeriods(currentOrg.id)
        ]);
        setSchedule(activeYear ? await timetableService.getSchoolSchedule(currentOrg.id, activeYear.id) : null);
        setPeriods(per);
      } catch (err) {
        console.error("Error loading timetable data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentOrg]);

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-slate-400">Loading timetable overview...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <div className="max-w-7xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-white">Timetable & Scheduling</h1>
          <p className="text-slate-400 mt-1">Manage school schedules, periods, and class timetables.</p>
        </div>
        <div className="flex space-x-3">
          <Link to="/workspace/education/timetable/config">
            <Button variant="outline">Schedule Settings</Button>
          </Link>
          <Link to="/workspace/education/timetable/class">
            <Button>Manage Timetables</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Configured Days" 
          value={schedule ? schedule.workingDays.length.toString() : "0"} 
          change="working days"
          changeType="positive"
        />
        <StatCard 
          title="Time Periods" 
          value={periods.length.toString()} 
          change={`${periods.filter(p => p.type === 'teaching').length} teaching`}
          changeType="positive"
        />
        <StatCard 
          title="Active Timetables" 
          value="-" 
          change="across classes"
          changeType="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <DashboardCard>
          <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
          <div className="flex flex-col space-y-3">
            <Link to="/workspace/education/timetable/class" className="block p-4 border border-slate-800 rounded-lg hover:bg-slate-800/50 transition-colors">
              <h3 className="text-white font-medium">Class Timetables</h3>
              <p className="text-sm text-slate-400 mt-1">View and manage weekly timetables for specific classes and sections.</p>
            </Link>
            <Link to="/workspace/education/timetable/teacher" className="block p-4 border border-slate-800 rounded-lg hover:bg-slate-800/50 transition-colors">
              <h3 className="text-white font-medium">Teacher Timetables</h3>
              <p className="text-sm text-slate-400 mt-1">View individual teacher schedules and identify conflicts.</p>
            </Link>
            <Link to="/workspace/education/timetable/config" className="block p-4 border border-slate-800 rounded-lg hover:bg-slate-800/50 transition-colors">
              <h3 className="text-white font-medium">Schedule Configuration</h3>
              <p className="text-sm text-slate-400 mt-1">Configure active working days and daily time periods.</p>
            </Link>
          </div>
        </DashboardCard>
        
        <DashboardCard>
          <h2 className="text-lg font-semibold text-white">Daily Schedule Overview</h2>
          {periods.length > 0 ? (
            <div className="space-y-2 mt-4">
              {periods.map(period => (
                <div key={period.id} className="flex justify-between items-center p-3 rounded-md bg-slate-900 border border-slate-800">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded">
                      {period.startTime} - {period.endTime}
                    </span>
                    <span className="text-slate-200 font-medium">{period.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    period.type === 'teaching' ? 'bg-blue-500/10 text-blue-400' :
                    period.type === 'break' ? 'bg-orange-500/10 text-orange-400' :
                    'bg-green-500/10 text-green-400'
                  }`}>
                    {period.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <p>No periods configured yet.</p>
              <Link to="/workspace/education/timetable/config" className="mt-2 text-blue-500 hover:underline">
                Configure Schedule
              </Link>
            </div>
          )}
        </DashboardCard>
      </div>
    </div>
    </AppShell>
  );
}

