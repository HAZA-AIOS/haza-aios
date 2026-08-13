import * as React from "react";
import { cn } from "@haza-aios/ui/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Badge } from "./badge";

// AgentBadge
export const AgentBadge: React.FC<{ category?: string; industry?: string }> = ({ category, industry }) => {
  return (
    <div className="flex gap-2">
      {category && <Badge variant="secondary">{category}</Badge>}
      {industry && <Badge variant="outline">{industry}</Badge>}
    </div>
  );
};

// AgentStatus
export const AgentStatus: React.FC<{ status: string }> = ({ status }) => {
  return <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>;
};

// AgentCapabilityList
export const AgentCapabilityList: React.FC<{ capabilities: { name: string }[] }> = ({ capabilities }) => {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {capabilities.map((cap, i) => (
        <span key={i} className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
          {cap.name}
        </span>
      ))}
    </div>
  );
};

// AgentCard
export interface AgentCardProps {
  name: string;
  description: string;
  icon?: string;
  category?: string;
  industry?: string;
  status?: string;
  capabilities?: { name: string }[];
  onClick?: () => void;
  action?: React.ReactNode;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  name,
  description,
  icon = "🤖",
  category,
  industry,
  status,
  capabilities,
  onClick,
  action
}) => {
  return (
    <Card 
      className={cn("flex flex-col h-full transition-all", onClick && "cursor-pointer hover:shadow-md hover:border-primary/50")}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="text-3xl bg-muted rounded-xl p-2 h-12 w-12 flex items-center justify-center">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <AgentBadge category={category} industry={industry} />
            </div>
          </div>
          {status && <AgentStatus status={status} />}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <CardDescription className="line-clamp-2">{description}</CardDescription>
        {capabilities && capabilities.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Capabilities</p>
            <AgentCapabilityList capabilities={capabilities} />
          </div>
        )}
      </CardContent>
      {action && (
        <CardFooter className="pt-3 border-t">
          {action}
        </CardFooter>
      )}
    </Card>
  );
};
