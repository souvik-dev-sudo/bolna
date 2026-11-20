import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-soft",
        // Hover: border colour and shadow only. The card never moves, so its text can't shake.
        interactive && "transition-[border-color,box-shadow] duration-200 hover:border-primary-border hover:shadow-card",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1 p-5", className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-[15px] font-semibold leading-tight text-heading", className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-5 pt-0", className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
