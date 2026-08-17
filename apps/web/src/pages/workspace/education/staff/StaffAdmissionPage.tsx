import { useState, useEffect } from "react";
import { useOrganization } from "@/org/use-organization";
import { navigate } from "@/routes/navigation";
import { StaffService } from "@/modules/education/sis/staff.service";
import type { Department, StaffType, EmploymentStatus, StaffStatus } from "@/modules/education/sis/sis.types";
import { AdminPageHeader as PageHeader, Button, Input, Select, Card } from "@haza-aios/ui";

export function StaffAdmissionPage() {
  const { currentOrganization } = useOrganization();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    staffType: "teacher" as StaffType,
    employmentStatus: "full_time" as EmploymentStatus,
    departmentId: "",
    hireDate: new Date().toISOString().split("T")[0],
    qualifications: "",
  });

  useEffect(() => {
    if (currentOrganization) {
      StaffService.getDepartments(currentOrganization.id).then(setDepartments);
    }
  }, [currentOrganization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const newStaff = await StaffService.createStaff({
        organizationId: currentOrganization.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        staffType: formData.staffType,
        employmentStatus: formData.employmentStatus,
        status: "active" as StaffStatus,
        departmentId: formData.departmentId,
        hireDate: formData.hireDate,
        qualifications: formData.qualifications,
      });
      
      navigate(`/workspace/education/staff/${newStaff.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create staff member");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate("/workspace/education/staff")}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <PageHeader title="Add New Staff" description="Create a new staff or teacher record." />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        <Card className="p-6 bg-slate-900 border-white/5 space-y-6">
          <h3 className="text-lg font-medium text-white border-b border-white/5 pb-2">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">First Name *</label>
              <Input
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Last Name *</label>
              <Input
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email Address</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Phone Number</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-slate-900 border-white/5 space-y-6">
          <h3 className="text-lg font-medium text-white border-b border-white/5 pb-2">Employment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Staff Role *</label>
              <Select
                required
                value={formData.staffType}
                onChange={(e) => setFormData({ ...formData, staffType: e.target.value as StaffType })}
                className="w-full"
              >
                <option value="teacher">Teacher</option>
                <option value="administrator">Administrator</option>
                <option value="coordinator">Coordinator</option>
                <option value="counselor">Counselor</option>
                <option value="support_staff">Support Staff</option>
                <option value="it_staff">IT Staff</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Employment Status *</label>
              <Select
                required
                value={formData.employmentStatus}
                onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value as EmploymentStatus })}
                className="w-full"
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Department</label>
              <Select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full"
              >
                <option value="">No Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Hire Date *</label>
              <Input
                type="date"
                required
                value={formData.hireDate}
                onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
              />
            </div>
            {formData.staffType === "teacher" && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-300">Qualifications (Teacher)</label>
                <Input
                  value={formData.qualifications}
                  onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                  placeholder="e.g. B.Ed, M.Sc Mathematics"
                />
              </div>
            )}
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate("/workspace/education/staff")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Staff Record"}
          </Button>
        </div>
      </form>
    </div>
  );
}
