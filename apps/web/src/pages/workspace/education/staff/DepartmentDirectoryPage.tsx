import { useState, useEffect } from "react";
import { Link } from "@/routes/router";
import { useOrganization } from "@/org/use-organization";
import { StaffService } from "@/modules/education/sis/staff.service";
import type { Department } from "@/modules/education/sis/sis.types";
import { Card, CardContent, Button, Input } from "@haza-aios/ui";
import { AppShell } from "@/components/AppShell";
import { Building2, Plus, Search, ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { AddDepartmentDialog } from "./components/AddDepartmentDialog";

export function DepartmentDirectoryPage() {
  const { currentOrganization } = useOrganization();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const fetchDepartments = async () => {
    if (!currentOrganization) return;
    setIsLoading(true);
    try {
      const data = await StaffService.getDepartments(currentOrganization.id);
      setDepartments(data);
    } catch (err) {
      console.error("Failed to fetch departments", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [currentOrganization]);

  const filteredDepartments = departments.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to="/workspace/education/staff" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Departments
            </h1>
            <p className="text-slate-400 text-sm mt-1">Manage academic and administrative departments</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/workspace/education/staff">
            <Button variant="outline" className="border-white/10">Staff Directory</Button>
          </Link>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Department
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-white/5">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search departments..."
              className="pl-9 bg-slate-950 border-white/10 text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading departments...</div>
        ) : filteredDepartments.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            {searchQuery ? "No departments found matching your search." : "No departments added yet."}
          </div>
        ) : (
          filteredDepartments.map((dept) => (
            <Card key={dept.id} className="bg-slate-900/50 border-white/5 hover:border-white/10 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg text-white mb-1">{dept.name}</h3>
                    <p className="text-slate-400 text-sm line-clamp-2">{dept.description || "No description provided."}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-400 hover:text-blue-300 p-1.5 rounded-md hover:bg-blue-400/10 transition-colors" onClick={(e) => { e.stopPropagation(); }}>
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button className="text-red-400 hover:text-red-300 p-1.5 rounded-md hover:bg-red-400/10 transition-colors" onClick={(e) => { e.stopPropagation(); }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-6 text-xs text-slate-500">
                  Added on {new Date(dept.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AddDepartmentDialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen} 
        onSuccess={fetchDepartments}
      />
      </div>
    </AppShell>
  );
}
