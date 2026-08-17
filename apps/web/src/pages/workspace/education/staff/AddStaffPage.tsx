import { useState } from "react";
import { Link } from "@/routes/router";
import { navigate } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import { StaffService } from "@/modules/education/sis/staff.service";
import { ArrowLeft, Save, User, Camera } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export function AddStaffPage() {
  const { currentOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    staffType: "teacher",
    employmentStatus: "full_time",
    hireDate: new Date().toISOString().split("T")[0],
    qualifications: "",
    photoUrl: ""
  });
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real app, we'd upload this file to a server/storage
      // For the mock, we just create a local object URL to show a preview
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      setFormData({ ...formData, photoUrl: url });
    }
  };

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
        staffType: formData.staffType as any,
        employmentStatus: formData.employmentStatus as any,
        hireDate: formData.hireDate,
        status: "active",
        qualifications: formData.qualifications,
        photoUrl: formData.photoUrl
      });
      
      navigate(`/workspace/education/staff/${newStaff.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create staff member");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="flex-1 overflow-auto bg-slate-950 text-slate-300">
        <div className="max-w-4xl mx-auto p-8 space-y-6">
          {/* Header */}
          <div>
            <Link to="/workspace/education/staff" className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 mb-4 text-sm w-fit">
              <ArrowLeft className="h-4 w-4" />
              Back to Directory
            </Link>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <User className="h-6 w-6 text-indigo-400" />
              Add Staff Member
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Register a new employee, teacher, or administrator in the system.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-8">
            
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-white border-b border-slate-800 pb-2">Personal Information</h3>
              
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                {/* Photo Upload */}
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="relative group cursor-pointer">
                    <div className="w-24 h-24 rounded-full bg-slate-950 border-2 border-slate-800 flex items-center justify-center overflow-hidden relative">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
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
                  <div className="text-xs text-slate-500">Profile Picture</div>
                </div>

                {/* Name Fields */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">First Name *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Last Name *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Email Address</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Phone Number</label>
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white border-b border-slate-800 pb-2">Employment Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Staff Type *</label>
                  <select 
                    required
                    value={formData.staffType}
                    onChange={(e) => setFormData({...formData, staffType: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="administrator">Administrator</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="support_staff">Support Staff</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Employment Status *</label>
                  <select 
                    required
                    value={formData.employmentStatus}
                    onChange={(e) => setFormData({...formData, employmentStatus: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="temporary">Temporary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Hire Date *</label>
                  <input 
                    required
                    type="date" 
                    value={formData.hireDate}
                    onChange={(e) => setFormData({...formData, hireDate: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Qualifications (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. B.Ed, M.Sc Mathematics"
                    value={formData.qualifications}
                    onChange={(e) => setFormData({...formData, qualifications: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
              <Link 
                to="/workspace/education/staff"
                className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cancel
              </Link>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Create Staff Record
              </button>
            </div>

          </form>
        </div>
      </div>
    </AppShell>
  );
}
