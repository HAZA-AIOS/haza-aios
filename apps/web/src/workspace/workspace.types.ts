export interface WorkspaceModule {
  id: string;
  name: string;
  description: string;
  industry: string;
  version: string;
  status: "Available" | "Active";
  activationState: "active" | "inactive";
}

export interface WorkspaceMember {
  id: string; // The membership ID
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Member";
  status: "active" | "pending" | "suspended";
  joinedAt: string;
}

export interface WorkspaceActivityLog {
  id: string;
  organizationId: string;
  action: string;
  actor: string;
  details: string;
  timestamp: string;
}
