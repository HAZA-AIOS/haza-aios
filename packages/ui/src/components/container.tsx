import * as React from "react";

import { cn } from "@haza-aios/ui/lib/utils";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
}

function Container({ as: Component = "div", className, ...props }: ContainerProps) {
  return (
    <Component
      className={cn("mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}

export { Container };
