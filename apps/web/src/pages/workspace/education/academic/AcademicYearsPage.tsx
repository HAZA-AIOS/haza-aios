import React, { useState, useEffect } from "react";
import { Card, CardContent, Button, Input, Badge } from "@haza-aios/ui";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/routes/router";
import { Plus, Calendar, X, AlertCircle, ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { AcademicService } from "@/modules/education/sis/academic.service";
import type { AcademicYear } from "@/modules/education/sis/sis.types";

export const AcademicYearsPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    status: "planned" as "planned" | "active" | "completed" | "archived"
  });

  const loadYears = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    const data = await AcademicService.getAcademicYears(currentOrganization.id);
    setYears(data);
    setLoading(false);
  };

  useEffect(() => {
    loadYears();
  }, [currentOrganization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    setError("");

    try {
      await AcademicService.createAcademicYear(currentOrganization.id, formData);
      setShowModal(false);
      setFormData({ name: "", startDate: "", endDate: "", status: "planned" });
      loadYears();
    } catch (err: any) {
      setError(err.message || "Failed to create academic year");
    }
  };

  const toggleStatus = async (year: AcademicYear, newStatus: any) => {
    if (!currentOrganization) return;
    try {
      await AcademicService.updateAcademicYear(year.id, currentOrganization.id, { status: newStatus });
      loadYears();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "active": return "default";
      case "planned": return "secondary";
      case "completed": return "outline";
      case "archived": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-6 space-y-6 animate-in fade-in duration-500">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/workspace/education/academic" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-500" /> Academic Years
              </h1>
              <p className="text-slate-400">Manage the overarching time periods for the school.</p>
            </div>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Academic Year
          </Button>
        </div>

        <Card className="bg-[#0f141f] border-white/5">
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-slate-400">Loading...</div>
            ) : years.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No academic years defined. Click "Add Academic Year" to start.
              </div>
            ) : (
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Start Date</th>
                    <th className="px-6 py-4 font-medium">End Date</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {years.map(year => (
                    <tr key={year.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{year.name}</td>
                      <td className="px-6 py-4">{new Date(year.startDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{new Date(year.endDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusColor(year.status) as any}>{year.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {year.status === "planned" && (
                            <Button variant="outline" size="sm" onClick={() => toggleStatus(year, "active")}>
                              Activate
                            </Button>
                          )}
                          {year.status === "active" && (
                            <Button variant="outline" size="sm" onClick={() => toggleStatus(year, "completed")}>
                              Complete
                            </Button>
                          )}
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
            )}
          </CardContent>
        </Card>

      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#0f141f] border border-white/10 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">Add Academic Year</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">Name</label>
                <Input 
                  placeholder="e.g. 2026-2027" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                  className="bg-slate-900 border-white/10 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-300">Start Date</label>
                  <Input 
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                    required
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-300">End Date</label>
                  <Input 
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({...formData, endDate: e.target.value})}
                    required
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">Initial Status</label>
                <select 
                  className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-white outline-none focus:border-blue-500/50"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit">Create Year</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};
