import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-md border border-input bg-card px-3 text-sm text-heading transition-colors placeholder:text-placeholder hover:border-border-strong focus:border-primary focus:shadow-focus disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }>(
  ({ className, icon, ...props }, ref) =>
    icon ? (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-placeholder [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
        <input ref={ref} className={cn(inputClass, "h-9 pl-9", className)} {...props} />
      </div>
    ) : (
      <input ref={ref} className={cn(inputClass, "h-9", className)} {...props} />
    ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { showCount?: boolean }
>(({ className, showCount, value, ...props }, ref) => (
  <div className="relative">
    <textarea
      ref={ref}
      value={value}
      className={cn(inputClass, "min-h-[84px] resize-y py-2.5 leading-relaxed text-indic scrollbar-thin", className)}
      {...props}
    />
    {showCount && (
      <span className="pointer-events-none absolute right-3 top-2 text-[11px] text-placeholder">
        {String(value ?? "").length} chars
      </span>
    )}
  </div>
));
Textarea.displayName = "Textarea";
