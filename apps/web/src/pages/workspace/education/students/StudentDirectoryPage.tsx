import React, { useState, useEffect } from "react";
import { Card, CardContent, Button, Input, Badge } from "@haza-aios/ui";
import type { Student } from "@/modules/education/sis/sis.types";
import { StudentService } from "@/modules/education/sis/student.service";
import { useOrganization } from "@/org/use-organization";
import { Link } from "@/routes/router";
import { AppShell } from "@/components/AppShell";
import { Search, Plus, UserCircle2, ArrowLeft, Edit2, Trash2 } from "lucide-react";

export const StudentDirectoryPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (currentOrganization) {
      StudentService.getStudents(currentOrganization.id).then(data => {
        setStudents(data);
        setLoading(false);
      });
    }
  }, [currentOrganization]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    setLoading(true);
    if (!searchQuery.trim()) {
      const data = await StudentService.getStudents(currentOrganization.id);
      setStudents(data);
    } else {
      const results = await StudentService.searchStudents(currentOrganization.id, searchQuery);
      setStudents(results);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "active": return "default";
      case "applicant": return "secondary";
      case "graduated": return "outline";
      case "withdrawn": 
      case "archived": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/workspace" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <UserCircle2 className="w-6 h-6 text-blue-500" /> Student Directory
              </h1>
              <p className="text-slate-400">Manage all students within your organization.</p>
            </div>
          </div>
          <Link to="/workspace/education/students/new">
            <Button><Plus className="w-4 h-4 mr-2" /> Admit Student</Button>
          </Link>
        </div>

        <Card className="bg-[#0f141f] border-white/5">
          <CardContent className="p-4 sm:p-6 space-y-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search by name, email, or admission number..." 
                  className="pl-9 bg-slate-900 border-white/10"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary">Search</Button>
            </form>

            {loading ? (
              <div className="py-12 text-center text-slate-400">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                {searchQuery ? "No students found matching your search." : "No students admitted yet."}
              </div>
            ) : (
              <div className="rounded-md border border-white/10 overflow-hidden">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Admission No.</th>
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Gender</th>
                      <th className="px-6 py-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[#0f141f]">
                    {students.map(student => (
                      <tr key={student.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-400">{student.admissionNumber}</td>
                        <td className="px-6 py-4 font-medium text-slate-200">
                          {student.firstName} {student.lastName}
                          {student.email && <div className="text-xs text-slate-500 font-normal">{student.email}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={getStatusColor(student.status) as any}>{student.status}</Badge>
                        </td>
                        <td className="px-6 py-4 capitalize">{student.gender.replace(/_/g, ' ')}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={`/workspace/education/students/${student.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                            <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 h-8 w-8 p-0">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8 w-8 p-0">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
};
