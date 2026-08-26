import React, { useState } from "react";
// Forced HMR reload
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select } from "@haza-aios/ui";
import { StudentService } from "@/modules/education/sis/student.service";
import { EnrollmentService } from "@/modules/education/sis/enrollment.service";
import { AcademicService } from "@/modules/education/sis/academic.service";
import type { AcademicYear, Grade, Section } from "@/modules/education/sis/sis.types";
import type { StudentGuardian, Gender, StudentStatus } from "@/modules/education/sis/sis.types";
import { useOrganization } from "@/org/use-organization";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, Save, UserPlus, ShieldAlert, Contact2, GraduationCap, Camera, User } from "lucide-react";

export const StudentAdmissionPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHigherEd = currentOrganization?.organizationType === "College" || currentOrganization?.organizationType === "University";
  const gradeLabel = isHigherEd ? "Program" : "Grade";
  const sectionLabel = isHigherEd ? "Batch" : "Section";

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      setPhotoUrl(url);
    }
  };
  
  // Guardian State (Simplifying to one primary guardian for admission)
  const [guardianFirstName, setGuardianFirstName] = useState("");
  const [guardianLastName, setGuardianLastName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState<"father" | "mother" | "guardian" | "other">("father");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  // Enrollment State
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [academicYear, setAcademicYear] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");

  React.useEffect(() => {
    if (currentOrganization) {
      AcademicService.getAcademicYears(currentOrganization.id).then(years => {
        setAcademicYears(years);
        const active = years.find(y => y.status === "active");
        if (active) setAcademicYear(active.id);
        else if (years.length > 0) setAcademicYear(years[0].id);
      });
      AcademicService.getGrades(currentOrganization.id).then(g => {
        setGrades(g);
        if (g.length > 0) setGradeId(g[0].id);
      });
    }
  }, [currentOrganization]);

  React.useEffect(() => {
    if (currentOrganization && gradeId) {
      AcademicService.getSections(currentOrganization.id, gradeId).then(s => {
        setSections(s);
        if (s.length > 0) setSectionId(s[0].id);
        else setSectionId("");
      });
    } else {
      setSections([]);
      setSectionId("");
    }
  }, [currentOrganization, gradeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    setLoading(true);
    setError(null);

    try {
      const primaryGuardian: StudentGuardian = {
        id: `grd_${Date.now()}`,
        firstName: guardianFirstName,
        lastName: guardianLastName,
        relationship: guardianRelationship,
        email: guardianEmail,
        phone: guardianPhone,
        isEmergencyContact: true,
        isPrimaryContact: true
      };

      const newStudent = await StudentService.createStudent({
        organizationId: currentOrganization.id,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        email: email || undefined,
        photoUrl: photoUrl || undefined,
        admissionDate: new Date().toISOString(),
        status: "active" as StudentStatus,
        guardians: [primaryGuardian]
      });

      if (academicYear && gradeId && sectionId) {
        await EnrollmentService.enrollStudent({
          studentId: newStudent.id,
          organizationId: currentOrganization.id,
          academicYear,
          gradeId,
          sectionId,
          enrollmentDate: new Date().toISOString(),
          status: "active"
        });
      }

      navigate(`/workspace/education/students/${newStudent.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to admit student");
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/workspace/education/students" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-green-500" /> Admit New Student
            </h1>
            <p className="text-slate-400">Complete the admission workflow to enroll a new student.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-md flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" /> Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Photo Upload */}
              <div className="md:col-span-2 flex flex-col items-center sm:items-start gap-3 mb-4">
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-white/10 flex items-center justify-center overflow-hidden relative">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Student preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-10 w-10 text-slate-600" />
                    )}
                    <label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="h-6 w-6 text-white mb-1" />
                      <span className="text-[10px] text-white font-medium uppercase tracking-wider">Upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-medium">Student Photo</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">First Name <span className="text-red-400">*</span></label>
                <Input required value={firstName} onChange={e => setFirstName(e.target.value)} className="bg-slate-900 border-white/10" placeholder="e.g. John" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Last Name <span className="text-red-400">*</span></label>
                <Input required value={lastName} onChange={e => setLastName(e.target.value)} className="bg-slate-900 border-white/10" placeholder="e.g. Doe" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Date of Birth <span className="text-red-400">*</span></label>
                <Input required type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className="bg-slate-900 border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Gender <span className="text-red-400">*</span></label>
                <Select value={gender} onChange={(e: any) => setGender(e.target.value)} className="w-full">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer Not To Say</option>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-300">Email Address</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-slate-900 border-white/10" placeholder="student@example.com (Optional)" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Contact2 className="w-5 h-5 text-purple-400" /> Primary Guardian Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">First Name <span className="text-red-400">*</span></label>
                <Input required value={guardianFirstName} onChange={e => setGuardianFirstName(e.target.value)} className="bg-slate-900 border-white/10" placeholder="e.g. Jane" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Last Name <span className="text-red-400">*</span></label>
                <Input required value={guardianLastName} onChange={e => setGuardianLastName(e.target.value)} className="bg-slate-900 border-white/10" placeholder="e.g. Doe" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Relationship <span className="text-red-400">*</span></label>
                <Select value={guardianRelationship} onChange={(e: any) => setGuardianRelationship(e.target.value)} className="w-full">
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Phone Number <span className="text-red-400">*</span></label>
                <Input required type="tel" value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} className="bg-slate-900 border-white/10" placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-300">Email Address <span className="text-red-400">*</span></label>
                <Input required type="email" value={guardianEmail} onChange={e => setGuardianEmail(e.target.value)} className="bg-slate-900 border-white/10" placeholder="guardian@example.com" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-400" /> Enrollment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {academicYears.length === 0 && (
                <div className="md:col-span-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-md">
                  <p className="text-sm font-medium">Academic Structure Not Configured</p>
                  <p className="text-sm opacity-90 mt-1">
                    You must create at least one Academic Year, {gradeLabel}, and {sectionLabel} in the Academic Structure module before you can admit a student.
                  </p>
                  <Link to="/workspace/education/academic" className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block">
                    Go to Academic Structure &rarr;
                  </Link>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Academic Year <span className="text-red-400">*</span></label>
                <Select required value={academicYear} onChange={(e: any) => setAcademicYear(e.target.value)} className="w-full" disabled={academicYears.length === 0}>
                  <option value="" disabled>Select Year</option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">{gradeLabel} <span className="text-red-400">*</span></label>
                <Select required value={gradeId} onChange={(e: any) => setGradeId(e.target.value)} className="w-full" disabled={grades.length === 0}>
                  <option value="" disabled>Select {gradeLabel}</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">{sectionLabel} <span className="text-red-400">*</span></label>
                <Select required value={sectionId} onChange={(e: any) => setSectionId(e.target.value)} className="w-full" disabled={sections.length === 0}>
                  <option value="" disabled>Select {sectionLabel}</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link to="/workspace/education/students">
              <Button variant="ghost" type="button">Cancel</Button>
            </Link>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Admitting..." : "Admit & Create Profile"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
};
