// Shared renderer for AI Screening Results chips (Roger + Spark-owned Typed).
// Spec: dashboard47 docs/briefs/spark-ai-screening-results-handoff.md.
// Advisory only — transcript-based, no numeric score, no auto-reject, no
// biometric/video/voice analysis. Evidence is treated as untrusted display text
// (React escapes it; we only ever put it in title/text, never dangerouslySetHTML).

export type ChipTone = "green" | "blue" | "amber" | "red";

export type ScreeningChip = {
  label: string;
  tone: ChipTone;
  evidence?: string;
  reason?: string; // Typed chip only
};

const TONE_CLASS: Record<ChipTone, string> = {
  green: "border-[#bde8ce] bg-[var(--sn-success-50)] text-[var(--sn-success)]",
  blue: "border-[var(--sn-blue-200)] bg-[var(--sn-blue-50)] text-[var(--sn-blue-700)]",
  amber:
    "border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)] text-[var(--sn-coral-600)]",
  red: "border-[#f3c0c0] bg-[#fbe9e9] text-[var(--sn-danger)]",
};

const REASON_LABEL: Record<string, string> = {
  accessibility: "Accessibility",
  technical: "Technical",
  cant_speak: "Couldn't speak aloud",
  other: "Other",
};

// Spark owns the Typed chip; Roger never emits it. Derived from answer metadata.
export function typedChip(mode?: string, reason?: string): ScreeningChip | null {
  if (mode !== "typed") return null;
  return { label: "Typed", tone: "red", reason: reason || "other" };
}

export function ScreeningChips({
  chips,
  className = "",
}: {
  chips: ScreeningChip[];
  className?: string;
}) {
  if (!chips.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {chips.map((chip, index) => {
        const reasonText = chip.reason
          ? ` · ${REASON_LABEL[chip.reason] || chip.reason}`
          : "";
        // Accessibility typed answers must not read as evasion.
        const title =
          chip.label === "Typed" && chip.reason === "accessibility"
            ? "Typed accessibility accommodation — verify differently; not evidence of evasion."
            : chip.evidence || undefined;
        return (
          <span
            key={`${chip.label}-${index}`}
            title={title}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${
              TONE_CLASS[chip.tone] || TONE_CLASS.blue
            }`}
          >
            {chip.label}
            {reasonText}
          </span>
        );
      })}
    </div>
  );
}
