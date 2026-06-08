"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquareText, Send } from "lucide-react";
import { toast } from "sonner";

type ActivityEvent = {
  type?: string;
  label?: string;
  at?: string;
  channel?: string;
  messagePreview?: string;
};

function parseEvents(value: unknown): ActivityEvent[] {
  const state =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return Array.isArray(state.events) ? (state.events as ActivityEvent[]) : [];
}

function formatWhen(at?: string) {
  if (!at) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(at));
  } catch {
    return "";
  }
}

// Unified messaging / status / history log: status events + recruiter notes in
// one chat-style timeline (oldest -> newest), with a note composer at the bottom.
export function SparkActivityLog({
  applicationId,
  communicationState,
}: {
  applicationId: string;
  communicationState: unknown;
}) {
  const router = useRouter();
  const events = parseEvents(communicationState);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Chat-style: keep the newest entry in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const addNote = async () => {
    const text = note.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/spark/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_notes", recruiterNotes: text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Couldn't add the note.");
      }
      setNote("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't add the note."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--sn-ink)]">
          <MessageSquareText className="h-4 w-4 text-[var(--sn-blue)]" />
          Activity &amp; notes
        </div>
        <span className="sn-chip py-1 text-xs">
          {events.length} {events.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1"
      >
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--sn-muted)]">
            No activity yet.
          </p>
        ) : (
          events.map((event, index) => {
            const isNote = event.type === "notes_saved";
            return (
              <div
                key={index}
                className={`rounded-md border px-3 py-2 ${
                  isNote
                    ? "border-[var(--sn-blue-200)] bg-[var(--sn-blue-50)]"
                    : "border-[var(--sn-line)] bg-[var(--sn-soft)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[var(--sn-ink)]">
                    {isNote ? "Recruiter note" : event.label || event.type}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--sn-muted)]">
                    {formatWhen(event.at)}
                  </span>
                </div>
                {event.messagePreview && (
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[var(--sn-muted)]">
                    {event.messagePreview}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void addNote();
            }
          }}
          placeholder="Add a note…"
          disabled={sending}
          className="sn-input flex-1 px-3 py-2 text-sm placeholder:text-[var(--sn-muted)]"
        />
        <button
          type="button"
          onClick={() => void addNote()}
          disabled={sending || !note.trim()}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-[var(--sn-ink,#18181b)] px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Add
        </button>
      </div>
    </section>
  );
}
