import { useEffect, useState } from "react";
import { useOrganization } from "../../org/use-organization";
import { AppShell } from "../../components/AppShell";
import { AdminPageHeader } from "@haza-aios/ui";
import { Link } from "../../routes/router";
import { 
  Settings, BookOpen, Users, GraduationCap, Calendar, 
  Activity, Stethoscope, PieChart, ShieldCheck, ArrowRight 
} from "lucide-react";

export function WorkspaceOverviewPage() {
  const { currentOrganization } = useOrganization();
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading to prevent flicker
  useEffect(() => {
    if (currentOrganization) {
      const timer = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [currentOrganization]);

  if (!currentOrganization) return null;

  const getIndustryModules = () => {
    switch (currentOrganization.industry) {
      case "Education": {
        const orgType = currentOrganization.organizationType || "School";
        const isHigherEd = orgType === "College" || orgType === "University";
        
        return [
          {
            id: "edu-1",
            title: `${orgType} General Setting`,
            description: `Configure ${orgType.toLowerCase()} basic information and settings`,
            icon: Settings,
            color: "text-blue-400",
            bg: "bg-blue-400/10",
            path: "#"
          },
          {
            id: "edu-2",
            title: isHigherEd ? "Programs and Courses" : "Courses and Batches",
            description: isHigherEd ? "Manage degree programs and course offerings" : "Manage courses, classes and batch assignments",
            icon: BookOpen,
            color: "text-amber-400",
            bg: "bg-amber-400/10",
            path: "#"
          },
          {
            id: "edu-3",
            title: "Students",
            description: "Manage student admission and directories",
            icon: Users,
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
            path: "/workspace/education/students"
          },
          {
            id: "edu-4",
            title: "Academic Structure",
            description: isHigherEd ? "Manage academic years, semesters, and subjects" : "Manage academic years, terms, classes, and subjects",
            icon: GraduationCap,
            color: "text-purple-400",
            bg: "bg-purple-400/10",
            path: "/workspace/education/academic"
          },
          {
            id: "edu-attendance",
            title: "Attendance",
            description: "Track and manage student attendance, sessions, and history",
            icon: Calendar,
            color: "text-rose-400",
            bg: "bg-rose-400/10",
            path: "/workspace/education/attendance"
          },
          {
            id: "edu-staff",
            title: isHigherEd ? "Faculty & Staff" : "Staff & Teachers",
            description: isHigherEd ? "Manage professors, faculty, and departments" : "Manage faculty, teachers, and departments",
            icon: Users,
            color: "text-indigo-400",
            bg: "bg-indigo-400/10",
            path: "/workspace/education/staff"
          },
          {
            id: "edu-5",
            title: "Time Table Management",
            description: "Create and manage class timetables",
            icon: Calendar,
            color: "text-rose-400",
            bg: "bg-rose-400/10",
            path: "#"
          }
        ];
      }
      case "Healthcare":
        return [
          {
            id: "hc-1",
            title: "Clinical Settings",
            description: "Manage clinic locations and medical configs",
            icon: Settings,
            color: "text-blue-400",
            bg: "bg-blue-400/10",
            path: "#"
          },
          {
            id: "hc-2",
            title: "Patient Records",
            description: "Access clinical patient charts and history",
            icon: Activity,
            color: "text-rose-400",
            bg: "bg-rose-400/10",
            path: "#"
          },
          {
            id: "hc-3",
            title: "Appointments",
            description: "Manage doctor schedules and patient visits",
            icon: Calendar,
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
            path: "#"
          },
          {
            id: "hc-4",
            title: "Staff Duty Roster",
            description: "Manage medical staff shifts and leaves",
            icon: Stethoscope,
            color: "text-purple-400",
            bg: "bg-purple-400/10",
            path: "#"
          }
        ];
      default:
        // Corporate / Generic
        return [
          {
            id: "corp-1",
            title: "Organization Settings",
            description: "Configure workspace and company settings",
            icon: Settings,
            color: "text-blue-400",
            bg: "bg-blue-400/10",
            path: "/workspace/settings"
          },
          {
            id: "corp-2",
            title: "Employee Directory",
            description: "Manage workforce and staff directories",
            icon: Users,
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
            path: "/workspace/members"
          },
          {
            id: "corp-3",
            title: "Finance & Payroll",
            description: "Manage compensation and expenses",
            icon: PieChart,
            color: "text-amber-400",
            bg: "bg-amber-400/10",
            path: "#"
          },
          {
            id: "corp-4",
            title: "Compliance",
            description: "Audit logs and system health policies",
            icon: ShieldCheck,
            color: "text-purple-400",
            bg: "bg-purple-400/10",
            path: "#"
          }
        ];
    }
  };

  const modules = getIndustryModules();

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        <AdminPageHeader
          title={`${currentOrganization.industry} Workspace`}
          description={`Select a module to manage your ${currentOrganization.industry.toLowerCase()} operations.`}
        />

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500"></span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {modules.map((mod) => (
              <Link 
                key={mod.id} 
                to={mod.path}
                className="group flex items-center p-5 rounded-2xl border border-white/5 bg-[#0f141f] hover:bg-slate-900/80 hover:border-white/10 transition-all duration-300"
              >
                <div className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-xl ${mod.bg} ${mod.color} mr-4 transition-transform group-hover:scale-110`}>
                  <mod.icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {mod.description}
                  </p>
                </div>
                <div className="shrink-0 text-slate-600 group-hover:text-slate-300 transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
