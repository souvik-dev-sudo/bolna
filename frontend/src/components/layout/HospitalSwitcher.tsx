import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlays";
import { hospitals, SIGNED_IN_ROLE } from "@/config/hospitals";
import { useHospital } from "@/hooks/useHospital";
import { cn } from "@/lib/utils";

/** Top-right hospital switcher for the super admin (a demo: it changes the name shown, not the data). */
export function HospitalSwitcher({ compact = false }: { compact?: boolean }) {
  const [hospital, selectHospital] = useHospital();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2.5 rounded-lg border bg-card text-left transition-colors hover:border-primary-border hover:bg-muted/40",
            compact ? "p-1" : "h-11 pl-1.5 pr-2.5",
          )}
          aria-label={`${hospital.name} (${SIGNED_IN_ROLE}). Switch hospital`}
        >
          <Avatar label={hospital.initials} className={compact ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-[11px]"} />
          {!compact && (
            <>
              <span className="min-w-0">
                <span className="block max-w-[220px] truncate text-[13px] font-semibold leading-4 text-heading">{hospital.name}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] leading-3 text-muted-foreground">
                  <ShieldCheck className="h-3 w-3 text-primary" /> {SIGNED_IN_ROLE}
                </span>
              </span>
              <ChevronDown className="ml-1 h-4 w-4 text-placeholder" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Hospitals</DropdownMenuLabel>
        {hospitals.map((h) => (
          <DropdownMenuItem
            key={h.id}
            onSelect={() => {
              if (h.id === hospital.id) return;
              selectHospital(h.id);
              toast.success(`Switched to ${h.name}`);
            }}
          >
            <Avatar label={h.initials} className="h-6 w-6 text-[10px]" />
            <span className="min-w-0 flex-1 truncate">{h.name}</span>
            {h.id === hospital.id && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
