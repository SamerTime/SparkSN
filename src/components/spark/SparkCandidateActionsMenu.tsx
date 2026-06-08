"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  MessageSquareText,
  MoreVertical,
  Trophy,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const ACTIONS = [
  { action: "approve", label: "Approve", Icon: CheckCircle2 },
  { action: "invite_interview", label: "Invite to AI Screen", Icon: MessageSquareText },
  { action: "move_in_person", label: "Move to In-Person", Icon: UserRoundCheck },
  { action: "hire", label: "Hire", Icon: Trophy },
  { action: "decline", label: "Reject", Icon: XCircle },
] as const;

// Top-of-panel candidate status actions in a kebab (matches the card menu).
// Save notes is intentionally NOT here — it lives in the activity log.
export function SparkCandidateActionsMenu({
  applicationId,
}: {
  applicationId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const run = async (action: string, label: string) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/spark/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Action failed.");
      }
      toast.success(`${label} recorded.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Candidate actions"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--sn-line)] bg-white hover:bg-black/5"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--sn-line)] bg-white py-1 shadow-lg">
          {ACTIONS.map(({ action, label, Icon }) => (
            <button
              key={action}
              type="button"
              disabled={Boolean(loading)}
              onClick={() => run(action, label)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--sn-ink)] hover:bg-black/5 disabled:opacity-50"
            >
              {loading === action ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
