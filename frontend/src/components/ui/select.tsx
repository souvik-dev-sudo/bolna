import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}

interface SelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  /** Rendered before the selected label (e.g. a provider logo). */
  leading?: React.ReactNode;
  size?: "sm" | "md";
  disabled?: boolean;
  "aria-label"?: string;
}

/** Single-select dropdown built on Radix (keyboard + screen-reader friendly). */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className,
  leading,
  size = "md",
  disabled,
  ...rest
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={rest["aria-label"]}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm text-heading transition-colors hover:border-border-strong focus:border-primary focus:shadow-focus disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-placeholder",
          size === "sm" ? "h-8 text-xs" : "h-9",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {leading}
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-placeholder" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-[320px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-2 pl-8 pr-3 text-sm text-heading outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary-hover data-[disabled]:opacity-50"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2.5">
                  <Check className="h-3.5 w-3.5 text-primary" />
                </SelectPrimitive.ItemIndicator>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  {o.hint && <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
                </div>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
