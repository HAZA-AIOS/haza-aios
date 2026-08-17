import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useOrganization } from "@/org/use-organization";
import { StaffService } from "@/modules/education/sis/staff.service";
import { TeachingAssignmentService } from "@/modules/education/sis/teaching-assignment.service";
import type { Subject } from "@/modules/education/sis/sis.types";

interface TeachingAssignmentDialogProps {
  staffId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TeachingAssignmentDialog({ staffId, isOpen, onClose, onSuccess }: TeachingAssignmentDialogProps) {
  const { currentOrganization } = useOrganization();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [gradeId, setGradeId] = useState("grade-5");
  const [sectionId, setSectionId] = useState("section-A");
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    if (isOpen && currentOrganization) {
      loadSubjects();
    }
  }, [isOpen, currentOrganization]);

  const loadSubjects = async () => {
    const list = await StaffService.getSubjects(currentOrganization!.id);
    if (list.length === 0) {
      // Seed some subjects if none exist for demo
      await StaffService.createSubject({ organizationId: currentOrganization!.id, name: "Mathematics", code: "MTH101", status: "active", displayOrder: 1 });
      await StaffService.createSubject({ organizationId: currentOrganization!.id, name: "Science", code: "SCI101", status: "active", displayOrder: 2 });
      await StaffService.createSubject({ organizationId: currentOrganization!.id, name: "English", code: "ENG101", status: "active", displayOrder: 3 });
      const newList = await StaffService.getSubjects(currentOrganization!.id);
      setSubjects(newList);
      if (newList.length > 0) setSubjectId(newList[0].id);
    } else {
      setSubjects(list);
      setSubjectId(list[0].id);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !subjectId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await TeachingAssignmentService.assignTeacher({
        organizationId: currentOrganization.id,
        staffId,
        academicYear,
        gradeId,
        sectionId,
        subjectId,
        isActive: true
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create teaching assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Assign Subject/Class</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Academic Year</label>
            <select 
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="2025-2026">2025-2026</option>
              <option value="2026-2027">2026-2027</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Grade / Class</label>
            <select 
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="grade-1">Grade 1</option>
              <option value="grade-5">Grade 5</option>
              <option value="grade-10">Grade 10</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Section (Optional)</label>
            <select 
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="section-A">Section A</option>
              <option value="section-B">Section B</option>
              <option value="section-C">Section C</option>
              <option value="">All Sections</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Subject</label>
            <select 
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            >
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
        </form>

        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !subjectId}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Assigning..." : "Save Assignment"}
          </button>
        </div>
        
      </div>
    </div>
  );
}
