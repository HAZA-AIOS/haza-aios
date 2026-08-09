import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

interface NavItemProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
}

function NavItem({ className, active = false, ...props }: NavItemProps) {
  return (
    <a
      className={cn(
        "text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function Navbar({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      className={cn(
        "border-border/80 bg-card/80 flex w-full items-center justify-between rounded-full border px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

export { NavItem, Navbar };
