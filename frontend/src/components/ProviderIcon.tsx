import { cn } from "@/lib/utils";

// Neutral monograms (no third-party logos). One tint per provider for quick scanning.
const tints: Record<string, { bg: string; fg: string; label: string }> = {
  openai: { bg: "#E9F5EF", fg: "#0B6E4F", label: "AI" },
  gemini: { bg: "#EAF1FE", fg: "#2856C9", label: "G" },
  google: { bg: "#EAF1FE", fg: "#2856C9", label: "G" },
  sarvam: { bg: "#FFF1E8", fg: "#B4531E", label: "S" },
  cartesia: { bg: "#F1EEFE", fg: "#5B3FD1", label: "C" },
  elevenlabs: { bg: "#F1F2F4", fg: "#2B2F36", label: "XI" },
  deepgram: { bg: "#E8F8F6", fg: "#127A6E", label: "D" },
  azure: { bg: "#E7F2FD", fg: "#1460B0", label: "Az" },
  "azure-openai": { bg: "#E7F2FD", fg: "#1460B0", label: "Az" },
  groq: { bg: "#FDECEC", fg: "#B3261E", label: "Gq" },
  plivo: { bg: "#EAF8F2", fg: "#0B8F6C", label: "P" },
  twilio: { bg: "#FDECEE", fg: "#C0283B", label: "T" },
  exotel: { bg: "#EEF0FE", fg: "#3A31C4", label: "E" },
  web: { bg: "#EEF0FE", fg: "#3A31C4", label: "W" },
};

export function ProviderIcon({ id, className }: { id: string; className?: string }) {
  const t = tints[id] ?? { bg: "#F4F6FB", fg: "#3C4866", label: id.slice(0, 1).toUpperCase() };
  return (
    <span
      className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[9px] font-bold", className)}
      style={{ backgroundColor: t.bg, color: t.fg }}
      aria-hidden
    >
      {t.label}
    </span>
  );
}
