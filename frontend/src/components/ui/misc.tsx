// Skeleton, Tabs, Accordion, Kbd, CopyButton, Avatar, Table helpers.
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Check, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tooltip } from "./overlays";

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-md bg-muted-deep", className)} />
);

// ---- Tabs ------------------------------------------------------------------------------------
export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("inline-flex items-center gap-1 rounded-md bg-muted p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:text-heading data-[state=active]:bg-card data-[state=active]:text-primary-hover data-[state=active]:shadow-soft [&_svg]:h-4 [&_svg]:w-4",
        className,
      )}
      {...props}
    />
  );
}

// ---- Accordion -------------------------------------------------------------------------------
export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  value,
  title,
  children,
  className,
}: {
  value: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AccordionPrimitive.Item value={value} className={cn("border-b last:border-b-0", className)}>
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-2 py-3.5 text-left text-sm font-semibold text-heading hover:text-primary-hover">
          {title}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
        <div className="pb-4">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

// ---- Small bits ------------------------------------------------------------------------------
export const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-heading">{children}</kbd>
);

/** "9c11…" chip that copies the full value. */
export function CopyChip({ value, display, className }: { value: string; display?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };
  return (
    <Tooltip content={copied ? "Copied" : value}>
      <button
        type="button"
        onClick={copy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm border border-primary-border bg-primary-soft px-2 py-0.5 font-mono text-xs text-primary-hover transition-colors hover:bg-primary-border/60",
          className,
        )}
      >
        {display ?? value}
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </Tooltip>
  );
}

export function Avatar({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white",
        className,
      )}
    >
      {label}
    </span>
  );
}

// ---- Table -----------------------------------------------------------------------------------
export const Table = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto scrollbar-thin">
    <table className={cn("w-full border-collapse text-sm", className)} {...props} />
  </div>
);
export const Th = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      "whitespace-nowrap border-b bg-muted/60 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground",
      className,
    )}
    {...props}
  />
);
export const Td = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("whitespace-nowrap border-b px-4 py-3 align-middle text-heading", className)} {...props} />
);
