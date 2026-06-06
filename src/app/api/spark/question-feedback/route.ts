import { NextRequest, NextResponse } from "next/server";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import { insertQuestionFeedback } from "@/lib/spark-db";
import { submitRecruitingLessonToKaizenIs } from "@/lib/spark-roger";

type FeedbackItem = {
  questionId?: string | null;
  postingId?: string | null;
  applicationId?: string | null;
  jobOrderId?: string | null;
  kind?: string;
  signal?: string;
  lesson?: string;
  appliesTo?: string;
  outcome?: string | null;
  origin?: string;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const recruiter = await getSparkRecruiterUser();
    if (!recruiter) {
      return NextResponse.json(
        { success: false, error: "Recruiter login required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const items: FeedbackItem[] = Array.isArray(body?.items)
      ? body.items
      : body && typeof body === "object"
        ? [body as FeedbackItem]
        : [];

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No feedback items provided." },
        { status: 400 }
      );
    }

    const results = [];
    for (const item of items) {
      const origin = item.origin === "roger" ? "roger" : "recruiter";

      if (item.kind === "lesson") {
        const lesson = stringOrNull(item.lesson);
        if (!lesson) {
          results.push({ ok: false, error: "Empty lesson skipped." });
          continue;
        }
        const appliesTo = stringOrNull(item.appliesTo);
        // Forward to KaizenIs first so we can record the queue id; store locally
        // regardless of forward success (no lost feedback), and report status.
        const forward = await submitRecruitingLessonToKaizenIs({
          lesson,
          appliesTo,
          questionId: stringOrNull(item.questionId),
          postingId: stringOrNull(item.postingId),
          jobOrderId: stringOrNull(item.jobOrderId),
          applicationId: stringOrNull(item.applicationId),
          outcome: stringOrNull(item.outcome),
          origin,
        });
        const saved = await insertQuestionFeedback({
          questionId: stringOrNull(item.questionId),
          postingId: stringOrNull(item.postingId),
          applicationId: stringOrNull(item.applicationId),
          kind: "lesson",
          lessonText: lesson,
          appliesTo,
          origin,
          outcome: stringOrNull(item.outcome),
          recruiterId: recruiter.id,
          submittedToKaizenis: forward.ok,
          kaizenisQueueId: forward.queueId,
        });
        results.push({
          ok: true,
          id: saved.id,
          kind: "lesson",
          forwarded: forward.ok,
          queueId: forward.queueId,
          forwardError: forward.ok ? null : forward.error ?? "forward failed",
        });
      } else {
        const signal = item.signal === "up" || item.signal === "down" ? item.signal : null;
        if (!signal) {
          results.push({ ok: false, error: "Invalid signal skipped." });
          continue;
        }
        const saved = await insertQuestionFeedback({
          questionId: stringOrNull(item.questionId),
          postingId: stringOrNull(item.postingId),
          applicationId: stringOrNull(item.applicationId),
          kind: "signal",
          signal,
          origin,
          recruiterId: recruiter.id,
        });
        results.push({ ok: true, id: saved.id, kind: "signal", signal });
      }
    }

    const anyForwardFailed = results.some(
      (r) => r.kind === "lesson" && r.forwarded === false
    );

    return NextResponse.json({ success: true, results, anyForwardFailed });
  } catch (error) {
    console.error("Spark question feedback error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to record feedback." },
      { status: 500 }
    );
  }
}
