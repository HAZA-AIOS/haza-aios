import React, { useState } from "react";
import { Button, Input, Textarea } from "@haza-aios/ui";
import { useOrganization } from "@/org/use-organization";
import { StaffService } from "@/modules/education/sis/staff.service";

interface AddDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddDepartmentDialog({ open, onOpenChange, onSuccess }: AddDepartmentDialogProps) {
  const { currentOrganization } = useOrganization();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      await StaffService.createDepartment({
        organizationId: currentOrganization.id,
        name: formData.name,
        description: formData.description,
      });
      
      onSuccess();
      onOpenChange(false);
      setFormData({ name: "", description: "" });
    } catch (err: any) {
      setError(err.message || "Failed to create department");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-xl w-full max-w-[425px] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Add New Department</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-950/50 text-red-400 text-sm border border-red-900/50">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Department Name <span className="text-red-400">*</span></label>
            <Input
              required
              placeholder="e.g. Mathematics"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Description</label>
            <Textarea
              placeholder="Brief description of the department..."
              className="min-h-[100px]"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Department"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
