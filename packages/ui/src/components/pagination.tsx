import * as React from "react";
import { cn } from "@haza-aios/ui/lib/utils";
import { Button } from "./button";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  disabled?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
  disabled = false,
}: PaginationProps) {
  if (totalPages <= 1 && (totalItems === undefined || totalItems <= (pageSize ?? 25))) {
    return null;
  }

  const startItem =
    totalItems !== undefined && pageSize !== undefined
      ? Math.min((currentPage - 1) * pageSize + 1, totalItems)
      : undefined;
  const endItem =
    totalItems !== undefined && pageSize !== undefined
      ? Math.min(currentPage * pageSize, totalItems)
      : undefined;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 text-sm text-slate-400",
        className
      )}
    >
      <div className="text-xs sm:text-sm">
        {startItem !== undefined && endItem !== undefined && totalItems !== undefined ? (
          <span>
            Showing <strong className="text-slate-200">{startItem}</strong> to{" "}
            <strong className="text-slate-200">{endItem}</strong> of{" "}
            <strong className="text-slate-200">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="text-slate-200">{currentPage}</strong> of{" "}
            <strong className="text-slate-200">{Math.max(totalPages, 1)}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || currentPage <= 1}
          className="h-8 px-3 text-xs"
        >
          Previous
        </Button>

        <span className="text-xs px-2 text-slate-300 font-medium">
          {currentPage} / {Math.max(totalPages, 1)}
        </span>

        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || currentPage >= totalPages}
          className="h-8 px-3 text-xs"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
