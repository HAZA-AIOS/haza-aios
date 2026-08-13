import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@haza-aios/ui/components/card";
import { useSisDashboardMetrics } from "../sis/use-sis";

export const EducationDashboardPage: React.FC = () => {
  const { metrics, isLoading } = useSisDashboardMetrics();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Education Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your school information system.
        </p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading metrics...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <span className="text-muted-foreground text-xs">Active</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.studentCount || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Teachers</CardTitle>
              <span className="text-muted-foreground text-xs">Current</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.staffCount || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
              <span className="text-muted-foreground text-xs">This year</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.classCount || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Academic Year</CardTitle>
              <span className="text-muted-foreground text-xs">Current</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.currentAcademicYear || "Not Set"}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
