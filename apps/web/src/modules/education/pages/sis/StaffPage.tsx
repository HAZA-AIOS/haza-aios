import React from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@haza-aios/ui/components/table";
import { Button } from "@haza-aios/ui/components/button";

export const StaffPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground mt-2">Manage teachers and staff.</p>
        </div>
        <Button>Add Staff</Button>
      </div>
      <div className="rounded-md border bg-white dark:bg-zinc-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Employee No</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Jane Smith</TableCell>
              <TableCell>EMP-2001</TableCell>
              <TableCell>Teacher</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
