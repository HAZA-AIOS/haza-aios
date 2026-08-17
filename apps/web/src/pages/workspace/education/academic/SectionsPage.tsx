import React, { useState, useEffect } from "react";
import { Card, CardContent, Button, Input, Badge } from "@haza-aios/ui";
import { useOrganization } from "@/org/use-organization";
import { AppShell } from "@/components/AppShell";
import { Link } from "@/routes/router";
import { Plus, Hash, X, ArrowLeft, AlertCircle, Edit2, Trash2 } from "lucide-react";
import { AcademicService } from "@/modules/education/sis/academic.service";
import type { Section, Grade } from "@/modules/education/sis/sis.types";

export const SectionsPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [sections, setSections] = useState<Section[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  
  // Form state
  const [formData, setFormData] = useState({
    gradeId: "",
    name: "",
    capacity: 30,
    status: "active" as "active" | "inactive"
  });

  const loadData = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    const [sectionsData, gradesData] = await Promise.all([
      AcademicService.getSections(currentOrganization.id),
      AcademicService.getGrades(currentOrganization.id)
    ]);
    setSections(sectionsData);
    setGrades(gradesData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentOrganization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    setError("");

    try {
      await AcademicService.createSection(currentOrganization.id, formData);
      setShowModal(false);
      setFormData({ gradeId: "", name: "", capacity: 30, status: "active" });
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create section");
    }
  };

  const getStatusColor = (status: string) => {
    return status === "active" ? "default" : "secondary";
  };

  const getGradeName = (gradeId: string) => {
    return grades.find(g => g.id === gradeId)?.name || "Unknown Grade";
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
                <Hash className="w-6 h-6 text-pink-500" /> Sections
              </h1>
              <p className="text-slate-400">Manage student groups within grades.</p>
            </div>
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Section
          </Button>
        </div>

        <Card className="bg-[#0f141f] border-white/5">
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-slate-400">Loading...</div>
            ) : sections.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No sections defined. Click "Add Section" to start.
              </div>
            ) : (
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs uppercase bg-slate-900/50 text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Grade / Class</th>
                    <th className="px-6 py-4 font-medium">Section Name</th>
                    <th className="px-6 py-4 font-medium">Capacity</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sections.map(section => (
                    <tr key={section.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 text-slate-400">{getGradeName(section.gradeId)}</td>
                      <td className="px-6 py-4 font-medium text-white">{section.name}</td>
                      <td className="px-6 py-4">{section.capacity || 'Unlimited'}</td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusColor(section.status) as any}>{section.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
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
              <h2 className="text-lg font-bold text-white">Add Section</h2>
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
                <label className="text-sm font-medium text-slate-300">Grade / Class</label>
                <select 
                  className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-white outline-none focus:border-blue-500/50"
                  value={formData.gradeId}
                  onChange={e => setFormData({...formData, gradeId: e.target.value})}
                  required
                >
                  <option value="" disabled>Select a grade</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-300">Section Name</label>
                  <Input 
                    placeholder="e.g. A, Alpha, Blue" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-300">Max Capacity</label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                    className="bg-slate-900 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">Status</label>
                <select 
                  className="w-full bg-slate-900 border border-white/10 rounded-md p-2 text-white outline-none focus:border-blue-500/50"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit">Create Section</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};
