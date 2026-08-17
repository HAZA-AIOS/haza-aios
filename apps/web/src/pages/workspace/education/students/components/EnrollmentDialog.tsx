import React, { useState, useEffect } from "react";
import { Button, Input, Select } from "@haza-aios/ui";
import { EnrollmentService } from "@/modules/education/sis/enrollment.service";
import { AcademicService } from "@/modules/education/sis/academic.service";
import type { Student, Enrollment, AcademicYear, Grade, Section } from "@/modules/education/sis/sis.types";
import { useOrganization } from "@/org/use-organization";
import { BookOpen, X } from "lucide-react";

interface Props {
  student: Student;
  activeEnrollment?: Enrollment;
  onSuccess: () => void;
}

export const EnrollmentDialog: React.FC<Props> = ({ student, activeEnrollment, onSuccess }) => {
  const { currentOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  
  const [academicYear, setAcademicYear] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const isHigherEd = currentOrganization?.organizationType === "College" || currentOrganization?.organizationType === "University";
  const gradeLabel = isHigherEd ? "Program" : "Grade";
  const sectionLabel = isHigherEd ? "Batch" : "Section";

  useEffect(() => {
    if (open && currentOrganization) {
      AcademicService.getAcademicYears(currentOrganization.id).then(years => {
        setAcademicYears(years);
        if (activeEnrollment?.academicYear) {
          setAcademicYear(activeEnrollment.academicYear);
        } else {
          const active = years.find(y => y.status === "active");
          if (active) setAcademicYear(active.id);
          else if (years.length > 0) setAcademicYear(years[0].id);
        }
      });
      AcademicService.getGrades(currentOrganization.id).then(g => {
        setGrades(g);
        if (activeEnrollment?.gradeId) setGradeId(activeEnrollment.gradeId);
        else if (g.length > 0) setGradeId(g[0].id);
      });
    }
  }, [open, currentOrganization, activeEnrollment]);

  useEffect(() => {
    if (currentOrganization && gradeId) {
      AcademicService.getSections(currentOrganization.id, gradeId).then(s => {
        setSections(s);
        if (activeEnrollment?.sectionId && s.find(x => x.id === activeEnrollment.sectionId)) {
          setSectionId(activeEnrollment.sectionId);
        } else if (s.length > 0) {
          setSectionId(s[0].id);
        } else {
          setSectionId("");
        }
      });
    } else {
      setSections([]);
      setSectionId("");
    }
  }, [currentOrganization, gradeId, activeEnrollment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (activeEnrollment && activeEnrollment.academicYear === academicYear) {
        await EnrollmentService.transferStudent(student.id, student.organizationId, sectionId);
      } else {
        await EnrollmentService.enrollStudent({
          studentId: student.id,
          organizationId: student.organizationId,
          academicYear,
          gradeId,
          sectionId,
          enrollmentDate: new Date().toISOString(),
          status: "active"
        });
      }
      
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to process enrollment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant={activeEnrollment ? "secondary" : "default"} onClick={() => setOpen(true)}>
        <BookOpen className="w-4 h-4 mr-2" />
        {activeEnrollment ? "Transfer / Re-enroll" : "Enroll Student"}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[#0f141f] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-xl relative">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-white mb-4">
              {activeEnrollment ? "Update Enrollment" : "New Enrollment"}
            </h2>

            {error && <div className="text-sm text-red-400 bg-red-400/10 p-3 rounded-md mb-4">{error}</div>}

            {academicYears.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-md mb-4">
                <p className="text-sm font-medium">Academic Structure Not Configured</p>
                <p className="text-sm opacity-90 mt-1">
                  You must configure Academic Years, {gradeLabel}s, and {sectionLabel}s before enrolling a student.
                </p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Academic Year</label>
                <Select required value={academicYear} onChange={(e: any) => setAcademicYear(e.target.value)} className="w-full" disabled={academicYears.length === 0}>
                  <option value="" disabled>Select Year</option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">{gradeLabel}</label>
                <Select required value={gradeId} onChange={(e: any) => setGradeId(e.target.value)} className="w-full" disabled={grades.length === 0}>
                  <option value="" disabled>Select {gradeLabel}</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">{sectionLabel}</label>
                <Select required value={sectionId} onChange={(e: any) => setSectionId(e.target.value)} className="w-full" disabled={sections.length === 0}>
                  <option value="" disabled>Select {sectionLabel}</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading || academicYears.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? "Saving..." : "Confirm Enrollment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
