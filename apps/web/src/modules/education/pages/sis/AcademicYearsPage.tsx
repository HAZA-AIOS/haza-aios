import React from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@haza-aios/ui/components/table";
import { StatusBadge } from "@haza-aios/ui/components/status-badge";
import { Button } from "@haza-aios/ui/components/button";

export const AcademicYearsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academic Years</h1>
          <p className="text-muted-foreground mt-2">Manage school academic cycles.</p>
        </div>
        <Button>New Year</Button>
      </div>
      <div className="rounded-md border bg-white dark:bg-zinc-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">2026-2027</TableCell>
              <TableCell>Sep 2026 - Jun 2027</TableCell>
              <TableCell>
                <StatusBadge status="current" />
              </TableCell>
              <TableCell>
                <StatusBadge status="active" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
