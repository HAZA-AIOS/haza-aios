import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@haza-aios/ui/components/card";
import { Button } from "@haza-aios/ui/components/button";

export const SchoolProfilePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">School Profile</h1>
          <p className="text-muted-foreground mt-2">Manage fundamental school details.</p>
        </div>
        <Button>Edit Profile</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>School Information</CardTitle>
          <CardDescription>Primary details for the institution.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p>The Mentor School</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Code</p>
              <p>TMS</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
