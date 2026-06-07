"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail, Pencil, Send, X } from "lucide-react";
import { toast } from "sonner";

export function SparkCandidateContact({
  applicationId,
  email,
}: {
  applicationId: string;
  email: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(email || "");
  const [draft, setDraft] = useState(email || "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reinviting, setReinviting] = useState(false);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/spark/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      throw new Error(result.error || "Request failed.");
    }
    return result;
  };

  const saveEmail = async () => {
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const result = await post({ action: "update_email", email: next });
      const saved = result.application?.candidateEmail || next;
      setValue(saved);
      setDraft(saved);
      setEditing(false);
      toast.success("Candidate email updated.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the email."
      );
    } finally {
      setSaving(false);
    }
  };

  const reinvite = async () => {
    setReinviting(true);
    try {
      await post({ action: "reinvite" });
      toast.success(`Interview link re-sent to ${value}.`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not resend the invite."
      );
    } finally {
      setReinviting(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {editing ? (
        <span className="sn-chip gap-1 pr-1">
          <Mail className="h-3.5 w-3.5" />
          <input
            type="email"
            value={draft}
            autoFocus
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveEmail();
              }
              if (event.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
            }}
            className="w-52 max-w-[60vw] bg-transparent text-sm outline-none"
            placeholder="name@email.com"
          />
          <button
            type="button"
            onClick={saveEmail}
            disabled={saving}
            title="Save (Enter)"
            className="text-[var(--sn-success)]"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
            title="Cancel (Esc)"
            className="text-[var(--sn-muted)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="sn-chip gap-1 hover:bg-black/5"
          title="Click to edit the candidate's email"
        >
          <Mail className="h-3.5 w-3.5" />
          {value || "Add email"}
          <Pencil className="h-3 w-3 text-[var(--sn-muted)]" />
        </button>
      )}
      <button
        type="button"
        onClick={reinvite}
        disabled={reinviting || !value}
        className="sn-chip gap-1 hover:bg-black/5 disabled:opacity-50"
        title="Resend the interview invite email to this address"
      >
        {reinviting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        Reinvite
      </button>
    </span>
  );
}
