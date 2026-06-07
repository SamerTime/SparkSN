"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { JsonValue } from "@/lib/spark-db";

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

type FocusArea = { area: string; why: string; suggested_probe: string };
type Analysis = {
  candidate_summary: string;
  in_person_focus_areas: FocusArea[];
  recommended_next_step: string;
  suggested_lesson: { lesson: string; applies_to: string } | null;
};

function parseAnalysis(value: unknown): Analysis | null {
  const o = obj(value);
  const isRoger =
    str(o.generatedBy) === "roger_mcp_v1" ||
    typeof o.candidate_summary === "string" ||
    Array.isArray(o.in_person_focus_areas);
  if (!isRoger) return null;
  const sl = obj(o.suggested_lesson);
  const lesson = str(sl.lesson);
  return {
    candidate_summary: str(o.candidate_summary),
    in_person_focus_areas: arr(o.in_person_focus_areas)
      .map((x) => {
        const f = obj(x);
        return {
          area: str(f.area),
          why: str(f.why),
          suggested_probe: str(f.suggested_probe),
        };
      })
      .filter((f) => f.area),
    recommended_next_step: str(o.recommended_next_step),
    suggested_lesson: lesson
      ? { lesson, applies_to: str(sl.applies_to) }
      : null,
  };
}

// Statuses where the AI screen is finished, so Roger's deeper analysis can run.
const SCREEN_DONE = new Set([
  "Complete",
  "InterviewCompleted",
  "RecruiterReview",
  "Reviewing",
  "Shortlisted",
  "Vetted",
  "Offer",
  "Declined",
]);

function deriveOutcome(status: string): string | null {
  const s = status.toLowerCase();
  if (s === "offer") return "hired";
  if (s === "declined") return "passed";
  if (s === "shortlisted" || s === "vetted") return "advancing";
  return status || null;
}

export function RogerCandidateCoach({
  applicationId,
  postingId,
  status,
  aiSummary,
}: {
  applicationId: string;
  postingId: string | null;
  status: string;
  aiSummary: JsonValue;
}) {
  const initial = parseAnalysis(aiSummary);
  const [analysis, setAnalysis] = useState<Analysis | null>(initial);
  const [running, setRunning] = useState(false);
  const [lesson, setLesson] = useState(initial?.suggested_lesson?.lesson ?? "");
  const [appliesTo, setAppliesTo] = useState(
    initial?.suggested_lesson?.applies_to ?? ""
  );
  const [origLesson, setOrigLesson] = useState(
    initial?.suggested_lesson?.lesson ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  async function runAnalysis() {
    setRunning(true);
    try {
      const res = await fetch(`/api/spark/applications/${applicationId}/analyze`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Analysis failed (${res.status})`);
      }
      const parsed = parseAnalysis(data.analysis);
      setAnalysis(parsed);
      if (parsed?.suggested_lesson && !lesson.trim()) {
        setLesson(parsed.suggested_lesson.lesson);
        setAppliesTo(parsed.suggested_lesson.applies_to);
        setOrigLesson(parsed.suggested_lesson.lesson);
      }
      flash("Roger analysis complete.");
    } catch (error) {
      flash(`Analysis failed: ${error instanceof Error ? error.message : "error"}`);
    } finally {
      setRunning(false);
    }
  }

  // Lazy auto-analyze: when a recruiter opens a completed-but-unanalyzed
  // candidate, run Roger once automatically (no "Run Roger analysis" click).
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (!analysis && !running && SCREEN_DONE.has(status)) {
      autoRanRef.current = true;
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function proposeLesson() {
    const text = lesson.trim();
    if (!text) return;
    setBusy(true);
    try {
      const origin =
        origLesson && text === origLesson.trim() ? "roger" : "recruiter";
      const res = await fetch("/api/spark/question-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              kind: "lesson",
              lesson: text,
              appliesTo: appliesTo.trim(),
              applicationId,
              postingId,
              outcome: deriveOutcome(status),
              origin,
            },
          ],
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed (${res.status})`);
      }
      flash(
        data.anyForwardFailed
          ? "Lesson saved, but it didn't reach Roger's queue — you can retry."
          : "Lesson proposed to Roger."
      );
    } catch (error) {
      flash(`Couldn't propose: ${error instanceof Error ? error.message : "error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--sn-ink)]">
          <Sparkles className="h-4 w-4 text-[var(--sn-blue)]" />
          Roger screening analysis
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={running}
          className="h-8 rounded-md border px-3 text-xs font-medium hover:bg-black/5 disabled:opacity-50"
        >
          {running ? "Running…" : analysis ? "Re-run" : "Run Roger analysis"}
        </button>
      </div>

      {analysis ? (
        <div className="mt-3 space-y-3">
          {analysis.candidate_summary && (
            <p className="text-sm leading-6 text-[var(--sn-muted)]">
              {analysis.candidate_summary}
            </p>
          )}
          {analysis.in_person_focus_areas.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sn-muted)]">
                In-person focus areas
              </p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[var(--sn-ink)]">
                {analysis.in_person_focus_areas.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium">{f.area}</span>
                    {f.why ? <span className="text-[var(--sn-muted)]"> — {f.why}</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {analysis.recommended_next_step && (
            <p className="text-sm">
              <span className="font-semibold">Next step: </span>
              <span className="text-[var(--sn-muted)]">{analysis.recommended_next_step}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--sn-muted)]">
          Run Roger to assess this candidate&apos;s answers against the job order
          (summary, three in-person focus areas, and a suggested lesson).
        </p>
      )}

      <div className="mt-4 rounded-md border border-[var(--sn-line)] bg-[var(--sn-surface,#fafafa)] p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--sn-ink)]">Teach Roger a lesson</p>
          {origLesson && lesson.trim() === origLesson.trim() && (
            <span className="text-xs text-[var(--sn-blue)]">Roger suggested this — edit or accept</span>
          )}
        </div>
        <textarea
          value={lesson}
          onChange={(e) => setLesson(e.target.value)}
          rows={2}
          placeholder="A reusable takeaway for future banks on similar roles…"
          className="mt-2 w-full rounded-md border border-[var(--sn-border,#d4d4d8)] p-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value)}
            placeholder="Applies to (role / skill)"
            className="h-9 flex-1 rounded-md border border-[var(--sn-border,#d4d4d8)] px-2 text-sm"
          />
          <button
            type="button"
            onClick={proposeLesson}
            disabled={busy || !lesson.trim()}
            className="h-9 rounded-md bg-[var(--sn-ink,#18181b)] px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Propose lesson →"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] rounded-md bg-[var(--sn-ink,#18181b)] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </section>
  );
}
