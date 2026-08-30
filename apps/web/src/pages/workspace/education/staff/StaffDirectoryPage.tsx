import { useState, useEffect } from "react";
import { Link } from "@/routes/router";
import { navigate } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import { StaffService } from "@/modules/education/sis/staff.service";
import { AppShell } from "@/components/AppShell";
import type { Staff, StaffType, StaffStatus } from "@/modules/education/sis/sis.types";
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  BookOpen,
  Briefcase,
  UserPlus,
  ArrowLeft,
  Edit2,
  Trash2
} from "lucide-react";

export function StaffDirectoryPage() {
  const { currentOrganization } = useOrganization();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<StaffType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StaffStatus | "all">("all");

  useEffect(() => {
    if (currentOrganization) {
      loadStaff();
    }
  }, [currentOrganization]);

  const loadStaff = async () => {
    try {
      setIsLoading(true);
      
      // If list is empty, seed some data for the demo
      let list = await StaffService.getStaffList(currentOrganization!.id);
      if (list.length === 0) {
        await seedStaffData(currentOrganization!.id);
        list = await StaffService.getStaffList(currentOrganization!.id);
      }
      
      setStaffList(list);
    } catch (error) {
      console.error("Failed to load staff:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const seedStaffData = async (orgId: string) => {
    const deps = [
      { name: "Mathematics", description: "Math Dept" },
      { name: "Science", description: "Science Dept" },
      { name: "Administration", description: "Admin Dept" }
    ];
    
    for (const d of deps) {
      await StaffService.createDepartment({ organizationId: orgId, name: d.name, description: d.description });
    }
    
    const createdDeps = await StaffService.getDepartments(orgId);
    
    const adminDept = createdDeps.find(d => d.name === "Administration")?.id;
    const mathDept = createdDeps.find(d => d.name === "Mathematics")?.id;
    
    await StaffService.createStaff({
      organizationId: orgId,
      firstName: "Sarah",
      lastName: "Jenkins",
      hireDate: "2020-08-15",
      staffType: "administrator",
      employmentStatus: "full_time",
      status: "active",
      email: "s.jenkins@school.edu",
      phone: "+1234567890",
      departmentId: adminDept
    });

    await StaffService.createStaff({
      organizationId: orgId,
      firstName: "Michael",
      lastName: "Chen",
      hireDate: "2021-09-01",
      staffType: "teacher",
      employmentStatus: "full_time",
      status: "active",
      email: "m.chen@school.edu",
      phone: "+1987654321",
      departmentId: mathDept,
      qualifications: "MSc Mathematics"
    });
  };

  const filteredStaff = staffList.filter(staff => {
    const matchesSearch = 
      `${staff.firstName} ${staff.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.employeeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (staff.email && staff.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesType = typeFilter === "all" || staff.staffType === typeFilter;
    const matchesStatus = statusFilter === "all" || staff.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <AppShell>
      <div className="flex-1 overflow-auto bg-slate-950 text-slate-300">
        <div className="max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link to="/workspace" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-indigo-400" />
                Staff Directory
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Manage all organization staff members and personnel.
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Link 
              to="/workspace/education/staff/teachers" 
              className="px-4 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
            >
              <BookOpen className="h-4 w-4" />
              Teacher View
            </Link>
            <Link 
              to="/workspace/education/staff/new" 
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Add Staff
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by name, ID, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="teacher">Teacher</option>
                <option value="administrator">Administrator</option>
                <option value="coordinator">Coordinator</option>
                <option value="support_staff">Support Staff</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading staff data...</div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Users className="h-12 w-12 text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Staff Found</h3>
              <p className="text-slate-400 max-w-md">
                Try adjusting your search or filters, or add a new staff member to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50">
                    <th className="px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Type / Dept</th>
                    <th className="px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => navigate(`/workspace/education/staff/${staff.id}`)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-indigo-900/50 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-medium shrink-0">
                            {staff.firstName[0]}{staff.lastName[0]}
                          </div>
                          <div>
                            <div className="font-medium text-white group-hover:text-indigo-400 transition-colors">
                              {staff.firstName} {staff.lastName}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{staff.employeeNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-300 capitalize">{staff.staffType.replace('_', ' ')}</div>
                        <div className="text-xs text-slate-500 mt-0.5 capitalize">{staff.employmentStatus.replace('_', ' ')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-300">{staff.email || '—'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{staff.phone || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          staff.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                          staff.status === 'on_leave' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {staff.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-700 transition-colors" 
                            onClick={(e) => { e.stopPropagation(); navigate(`/workspace/education/staff/${staff.id}`); }}
                          >
                            View
                          </button>
                          <button className="text-blue-400 hover:text-blue-300 p-1.5 rounded-md hover:bg-blue-400/10 transition-colors" onClick={(e) => { e.stopPropagation(); }}>
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button className="text-red-400 hover:text-red-300 p-1.5 rounded-md hover:bg-red-400/10 transition-colors" onClick={(e) => { e.stopPropagation(); }}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
