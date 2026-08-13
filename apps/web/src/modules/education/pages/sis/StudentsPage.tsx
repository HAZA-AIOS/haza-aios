import React from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@haza-aios/ui/components/table";
import { Button } from "@haza-aios/ui/components/button";

export const StudentsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-2">Manage student directory.</p>
        </div>
        <Button>Add Student</Button>
      </div>
      <div className="rounded-md border bg-white dark:bg-zinc-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Admission No</TableHead>
              <TableHead>Current Class</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">John Doe</TableCell>
              <TableCell>ADM-1001</TableCell>
              <TableCell>Grade 1 - A</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
