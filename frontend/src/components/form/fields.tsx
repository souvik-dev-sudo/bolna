// Form building blocks shared by the agent editor and the graph inspector.
import * as React from "react";
import { Info, type LucideIcon } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label, Slider, Switch } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/overlays";
import { languageName } from "@/config/languages";
import { cn } from "@/lib/utils";
import type { Localized } from "@/types/agent";

export function InfoTip({ text }: { text: React.ReactNode }) {
  return (
    <Tooltip content={text}>
      <button type="button" className="text-placeholder hover:text-primary" aria-label="More info">
        <Info className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}

export function Field({
  label,
  info,
  hint,
  children,
  className,
  htmlFor,
  aside,
}: {
  label: React.ReactNode;
  info?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={htmlFor}>{label}</Label>
          {info && <InfoTip text={info} />}
        </div>
        {aside}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Slider with a synced number box, like Bolna's, but with unit + range shown. */
export function SliderField({
  label,
  info,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  disabled,
  className,
}: {
  label: React.ReactNode;
  info?: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  className?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <Field label={label} info={info} className={cn(disabled && "opacity-50", className)}>
      <div className="flex items-center gap-4">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={([v]) => onChange(v)}
          aria-label={typeof label === "string" ? label : undefined}
        />
        <div className="relative w-24 shrink-0">
          <Input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className={cn("text-right tabular-nums", unit && "pr-9")}
          />
          {unit && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-placeholder">{unit}</span>}
        </div>
      </div>
    </Field>
  );
}

/** A labelled on/off row with optional description and icon. */
export function ToggleRow({
  icon: Icon,
  label,
  description,
  info,
  checked,
  onCheckedChange,
  disabled,
  badge,
}: {
  icon?: LucideIcon;
  label: React.ReactNode;
  description?: React.ReactNode;
  info?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-lg border bg-card px-4 py-3", disabled && "opacity-60")}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-heading">
            {label}
            {info && <InfoTip text={info} />}
            {badge}
          </div>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-1" />
    </div>
  );
}

/** Language chips: pick which language's text you're editing. */
export function LanguageChips({
  codes,
  value,
  onChange,
  defaultCode,
  filled,
}: {
  codes: string[];
  value: string;
  onChange: (code: string) => void;
  defaultCode?: string;
  filled?: Localized;
}) {
  if (codes.length <= 1) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium transition-colors",
            value === code
              ? "border-primary-border bg-primary-soft text-primary-hover"
              : "bg-card text-muted-foreground hover:border-border-strong hover:text-heading",
          )}
        >
          {filled && (
            <span className={cn("h-1.5 w-1.5 rounded-full", filled[code]?.trim() ? "bg-success" : "bg-border-strong")} />
          )}
          {languageName(code)}
          {code === defaultCode && <span className="text-[10px] opacity-70">(Default)</span>}
        </button>
      ))}
    </div>
  );
}

/** One text per language, edited one language at a time. */
export function LocalizedText({
  value,
  onChange,
  codes,
  defaultCode,
  placeholder,
  multiline = true,
  rows = 3,
  showCount,
}: {
  value: Localized;
  onChange: (v: Localized) => void;
  codes: string[];
  defaultCode: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  showCount?: boolean;
}) {
  const [active, setActive] = React.useState(defaultCode);
  const code = codes.includes(active) ? active : codes[0];
  const set = (text: string) => onChange({ ...value, [code]: text });
  return (
    <div className="flex flex-col gap-2">
      <LanguageChips codes={codes} value={code} onChange={setActive} defaultCode={defaultCode} filled={value} />
      {multiline ? (
        <Textarea value={value[code] ?? ""} onChange={(e) => set(e.target.value)} placeholder={placeholder} rows={rows} showCount={showCount} />
      ) : (
        <Input value={value[code] ?? ""} onChange={(e) => set(e.target.value)} placeholder={placeholder} className="text-indic" />
      )}
    </div>
  );
}

/** A titled card that groups related settings. */
export function SectionCard({
  icon: Icon,
  title,
  description,
  info,
  actions,
  children,
  className,
  id,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  info?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-xl border bg-card shadow-soft", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] font-semibold">{title}</h3>
              {info && <InfoTip text={info} />}
            </div>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {children && <div className="px-5 pb-5 pt-5">{children}</div>}
    </section>
  );
}

/** Small yellow note for settings the backend can't apply yet. */
export function PendingNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">{children}</p>
  );
}
