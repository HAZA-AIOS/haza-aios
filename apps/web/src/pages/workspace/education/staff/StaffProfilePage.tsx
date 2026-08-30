import { useState, useEffect } from "react";
import { Link } from "@/routes/router";
import { usePathname } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import { StaffService } from "@/modules/education/sis/staff.service";
import { TeachingAssignmentService } from "@/modules/education/sis/teaching-assignment.service";
import type { Staff, TeachingAssignment, Subject } from "@/modules/education/sis/sis.types";
import { TeachingAssignmentDialog } from "./components/TeachingAssignmentDialog";
import { AppShell } from "@/components/AppShell";
import { 
  ArrowLeft, 
  User, 
  Briefcase, 
  BookOpen, 
  Mail, 
  Phone,
  Calendar,
  Award,
  MoreVertical,
  Plus
} from "lucide-react";

export function StaffProfilePage() {
  const pathname = usePathname();
  const id = pathname.split('/').pop();
  const { currentOrganization } = useOrganization();
  
  const [staff, setStaff] = useState<Staff | null>(null);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [subjects, setSubjects] = useState<Record<string, Subject>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "employment" | "teaching">("overview");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  useEffect(() => {
    if (currentOrganization && id) {
      loadProfile();
    }
  }, [currentOrganization, id]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const data = await StaffService.getStaffById(id!, currentOrganization!.id);
      setStaff(data);
      
      if (data?.staffType === 'teacher') {
        const assigns = await TeachingAssignmentService.getAssignmentsByStaff(id!, currentOrganization!.id);
        setAssignments(assigns);
        
        const subjList = await StaffService.getSubjects(currentOrganization!.id);
        const subjMap: Record<string, Subject> = {};
        subjList.forEach(s => subjMap[s.id] = s);
        setSubjects(subjMap);
      }
    } catch (error) {
      console.error("Failed to load staff profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex-1 bg-slate-950 flex items-center justify-center text-slate-500 h-[calc(100vh-80px)]">Loading profile...</div>
      </AppShell>
    );
  }

  if (!staff) {
    return (
      <AppShell>
        <div className="flex-1 bg-slate-950 flex items-center justify-center text-slate-500 h-[calc(100vh-80px)]">Staff not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-auto bg-slate-950 text-slate-300">
      
      {/* Top Background Banner */}
      <div className="h-48 bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border-b border-indigo-500/10"></div>
      
      <div className="max-w-7xl pb-12 -mt-16 space-y-8">
        
        {/* Header Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col md:flex-row gap-6 relative">
          <Link 
            to="/workspace/education/staff" 
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </Link>
          
          <div className="h-32 w-32 rounded-xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center shrink-0 shadow-lg">
            <User className="h-16 w-16 text-slate-500" />
          </div>
          
          <div className="flex-1 flex flex-col justify-end">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-white">
                {staff.firstName} {staff.lastName}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                staff.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                staff.status === 'on_leave' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {staff.status.replace('_', ' ')}
              </span>
            </div>
            
            <p className="text-indigo-400 font-medium capitalize flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              {staff.staffType.replace('_', ' ')}
            </p>
            
            <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-500" />
                {staff.email || "No email"}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-500" />
                {staff.phone || "No phone"}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                Hire Date: {new Date(staff.hireDate).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-800">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('employment')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'employment'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              Employment Details
            </button>
            {staff.staffType === 'teacher' && (
              <button
                onClick={() => setActiveTab('teaching')}
                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'teaching'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
                }`}
              >
                Teaching Assignments
              </button>
            )}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-indigo-400" />
                  Personal Information
                </h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <dt className="text-slate-500">First Name</dt>
                    <dd className="text-slate-300 font-medium">{staff.firstName}</dd>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <dt className="text-slate-500">Last Name</dt>
                    <dd className="text-slate-300 font-medium">{staff.lastName}</dd>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/50 pb-2">
                    <dt className="text-slate-500">Email</dt>
                    <dd className="text-slate-300 font-medium">{staff.email || '—'}</dd>
                  </div>
                  <div className="flex justify-between pb-2">
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="text-slate-300 font-medium">{staff.phone || '—'}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Award className="h-5 w-5 text-indigo-400" />
                  Qualifications & Skills
                </h3>
                {staff.qualifications ? (
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {staff.qualifications}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    No qualifications listed.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'employment' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-indigo-400" />
                Employment Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Employee Number</label>
                  <div className="text-slate-300 font-mono">{staff.employeeNumber}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Hire Date</label>
                  <div className="text-slate-300">{new Date(staff.hireDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Employment Status</label>
                  <div className="text-slate-300 capitalize">{staff.employmentStatus.replace('_', ' ')}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Staff Type</label>
                  <div className="text-slate-300 capitalize">{staff.staffType.replace('_', ' ')}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Current Status</label>
                  <div className="text-slate-300 capitalize">{staff.status.replace('_', ' ')}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'teaching' && staff.staffType === 'teacher' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div>
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-indigo-400" />
                    Teaching Assignments
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">Subjects and classes assigned to this teacher.</p>
                </div>
                <button 
                  onClick={() => setIsAssignDialogOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Assign Subject
                </button>
              </div>

              {assignments.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center">
                  <BookOpen className="h-12 w-12 text-slate-700 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Assignments Yet</h3>
                  <p className="text-slate-400 max-w-md">
                    This teacher has not been assigned to any subjects or classes. Click "Assign Subject" to get started.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assignments.map(assignment => {
                    const subject = subjects[assignment.subjectId];
                    return (
                      <div key={assignment.id} className={`bg-slate-900 border ${assignment.isActive ? 'border-slate-700' : 'border-slate-800 opacity-60'} rounded-xl p-5 relative group`}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="px-2 py-1 bg-slate-800 rounded text-xs font-medium text-slate-300">
                            {assignment.academicYear}
                          </div>
                          {!assignment.isActive && (
                            <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-medium">
                              Inactive
                            </span>
                          )}
                        </div>
                        
                        <h4 className="text-lg font-medium text-white mb-1">
                          {subject ? subject.name : "Unknown Subject"}
                        </h4>
                        
                        <div className="text-sm text-slate-400 space-y-1">
                          <div><span className="text-slate-500">Grade:</span> {assignment.gradeId.replace('grade-', 'Grade ')}</div>
                          {assignment.sectionId && (
                            <div><span className="text-slate-500">Section:</span> {assignment.sectionId.replace('section-', '')}</div>
                          )}
                        </div>
                        
                        {assignment.isActive && (
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="text-slate-500 hover:text-white p-1">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <TeachingAssignmentDialog 
        staffId={staff.id} 
        isOpen={isAssignDialogOpen} 
        onClose={() => setIsAssignDialogOpen(false)} 
        onSuccess={loadProfile} 
      />
      </div>
    </AppShell>
  );
}
