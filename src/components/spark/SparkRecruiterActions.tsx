"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MessageSquareText, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type SparkRecruiterActionsProps = {
  applicationId: string;
  initialNotes: string;
};

const ACTION_LABELS: Record<string, string> = {
  save_notes: "Save notes",
  approve: "Approve",
  invite_interview: "Invite interview",
  decline: "Decline",
};

export function SparkRecruiterActions({
  applicationId,
  initialNotes,
}: SparkRecruiterActionsProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes || "");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const runAction = async (action: string) => {
    setLoadingAction(action);
    try {
      const response = await fetch(`/api/spark/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          recruiterNotes: notes,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to update application.");
      }

      toast.success(`${ACTION_LABELS[action]} recorded.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update application."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const iconFor = (action: string) => {
    if (loadingAction === action) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (action === "approve") return <CheckCircle2 className="h-4 w-4" />;
    if (action === "invite_interview") return <MessageSquareText className="h-4 w-4" />;
    if (action === "decline") return <XCircle className="h-4 w-4" />;
    return <Save className="h-4 w-4" />;
  };

  return (
    <div className="grid gap-3">
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Recruiter notes, screening context, follow-up details"
        className="sn-input min-h-28 w-full px-3 py-2 text-sm placeholder:text-[var(--sn-muted)]"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-[var(--sn-line)] bg-white"
          disabled={Boolean(loadingAction)}
          onClick={() => runAction("save_notes")}
        >
          {iconFor("save_notes")}
          Save notes
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-[var(--sn-success)] text-white hover:bg-[#1f9651]"
          disabled={Boolean(loadingAction)}
          onClick={() => runAction("approve")}
        >
          {iconFor("approve")}
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          className="sn-button-coral"
          disabled={Boolean(loadingAction)}
          onClick={() => runAction("invite_interview")}
        >
          {iconFor("invite_interview")}
          Invite interview
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-[var(--sn-coral-100)] bg-white text-[var(--sn-danger)] hover:bg-[var(--sn-danger-50)] hover:text-[var(--sn-danger)]"
          disabled={Boolean(loadingAction)}
          onClick={() => runAction("decline")}
        >
          {iconFor("decline")}
          Decline
        </Button>
      </div>
    </div>
  );
}
