import React from "react";
import { cn } from "@haza-aios/ui/lib/utils";

// --- Layout Primitives ---

export const BuilderContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-background">
    {children}
  </div>
);

export const BuilderSidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full md:w-64 border-r bg-muted/30 overflow-y-auto flex-shrink-0">
    <div className="p-4 space-y-2">
      {children}
    </div>
  </div>
);

export interface BuilderNavItemProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export const BuilderNavItem: React.FC<BuilderNavItemProps> = ({ label, isActive, onClick, icon }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
      isActive 
        ? "bg-primary text-primary-foreground" 
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
  >
    {icon}
    {label}
  </button>
);

export const BuilderContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 overflow-y-auto p-6 md:p-8">
    <div className="max-w-4xl mx-auto space-y-8">
      {children}
    </div>
  </div>
);

// --- Form Primitives ---

export const BuilderSection: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ 
  title, 
  description, 
  children 
}) => (
  <section className="space-y-6">
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description && <p className="text-muted-foreground mt-1">{description}</p>}
    </div>
    <div className="space-y-6">
      {children}
    </div>
  </section>
);

export const ConfigField: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({
  label,
  description,
  children
}) => (
  <div className="space-y-2">
    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      {label}
    </label>
    {description && <p className="text-sm text-muted-foreground">{description}</p>}
    {children}
  </div>
);
