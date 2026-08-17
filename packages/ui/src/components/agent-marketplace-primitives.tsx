import React from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { cn } from "@haza-aios/ui/lib/utils";

// --- Agent Search ---
export interface AgentSearchProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const AgentSearch: React.FC<AgentSearchProps> = ({
  value,
  onChange,
  placeholder = "Search agents by name, capability, or industry...",
  className,
}) => {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 h-11 bg-background"
      />
    </div>
  );
};

// --- Agent Category Nav ---
export interface AgentCategoryNavProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

export const AgentCategoryNav: React.FC<AgentCategoryNavProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none w-full">
      <Button
        variant={activeCategory === "All" ? "default" : "secondary"}
        size="sm"
        onClick={() => onSelectCategory("All")}
        className="rounded-full px-4 shrink-0"
      >
        All
      </Button>
      {categories.map((cat) => (
        <Button
          key={cat}
          variant={activeCategory === cat ? "default" : "secondary"}
          size="sm"
          onClick={() => onSelectCategory(cat)}
          className="rounded-full px-4 shrink-0"
        >
          {cat}
        </Button>
      ))}
    </div>
  );
};

// --- Agent Filters ---
export interface AgentFiltersProps {
  industries: string[];
  selectedIndustry: string;
  onSelectIndustry: (industry: string) => void;
  statuses: string[];
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  onClear: () => void;
}

export const AgentFilters: React.FC<AgentFiltersProps> = ({
  industries,
  selectedIndustry,
  onSelectIndustry,
  statuses,
  selectedStatus,
  onSelectStatus,
  onClear,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
        <select
          value={selectedIndustry}
          onChange={(e) => onSelectIndustry(e.target.value)}
          className="h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-1 sm:w-[150px]"
        >
          <option value="All">All Industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
        
        <select
          value={selectedStatus}
          onChange={(e) => onSelectStatus(e.target.value)}
          className="h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-1 sm:w-[150px]"
        >
          <option value="All">All Statuses</option>
          {statuses.map((stat) => (
            <option key={stat} value={stat}>
              {stat}
            </option>
          ))}
        </select>
      </div>
      
      {(selectedIndustry !== "All" || selectedStatus !== "All") && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-10 w-full sm:w-auto">
          Clear Filters
        </Button>
      )}
    </div>
  );
};
