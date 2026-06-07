import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationByInterviewToken,
  updateApplication,
  type JsonValue,
} from "@/lib/spark-db";
import { transcribeRecordingAtPath } from "@/lib/spark-transcription";

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const TYPED_REASONS = new Set([
  "accessibility",
  "technical",
  "cant_speak",
  "other",
]);

/**
 * Per-question answer (Increment 2a backend). Stores each answer incrementally
 * onto interviewTranscript.answers[index]:
 *  - spoken: a per-question clip path -> transcribed with Whisper
 *  - typed: an accessibility/exception answer, tagged with a reason
 * Additive; does not change the existing whole-session complete flow.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const application = await getApplicationByInterviewToken(token);
    if (!application) {
      return NextResponse.json(
        { success: false, error: "Interview not found." },
        { status: 404 }
      );
    }

    const body = obj(await request.json());
    const questionIndex = num(body.questionIndex);
    const mode = str(body.mode) === "typed" ? "typed" : "spoken";

    let transcript = "";
    let clipPath = "";
    if (mode === "spoken") {
      clipPath = str(obj(obj(body.recording).storage).path);
      if (!clipPath) {
        return NextResponse.json(
          {
            success: false,
            error: "A recording clip path is required for a spoken answer.",
          },
          { status: 400 }
        );
      }
      // Resilient: a transcription failure (e.g. the clip exceeds Whisper's
      // request limit) must NOT block the candidate. Store the clip + advance;
      // the transcript can be regenerated server-side later from clipPath.
      try {
        transcript = await transcribeRecordingAtPath(clipPath);
      } catch (transcriptionError) {
        transcript = "";
        console.error(
          "Spark per-question transcription failed:",
          transcriptionError instanceof Error
            ? transcriptionError.message
            : transcriptionError
        );
      }
    }

    const now = new Date().toISOString();
    const reason = TYPED_REASONS.has(str(body.reason))
      ? str(body.reason)
      : "other";
    const answer: Record<string, unknown> = {
      questionIndex,
      questionId: str(body.questionId),
      question: str(body.question),
      mode,
      answeredAt: now,
      ...(mode === "typed"
        ? {
            typedAnswer: str(body.typedAnswer),
            reason,
            reasonNote: str(body.note),
          }
        : {
            transcript,
            clipPath,
            durationSeconds: num(obj(body.recording).durationSeconds),
            mimeType: str(obj(body.recording).mimeType),
          }),
    };

    const existingTranscript = obj(
      (application as { interviewTranscript?: unknown }).interviewTranscript
    );
    const answers = Array.isArray(existingTranscript.answers)
      ? [...(existingTranscript.answers as unknown[])]
      : [];
    answers[questionIndex] = answer;

    const nextTranscript = {
      ...existingTranscript,
      source: "spark_interview_session",
      answers,
    };

    await updateApplication(
      application.id,
      { interviewTranscript: nextTranscript as JsonValue },
      "id"
    );

    return NextResponse.json({ success: true, answer });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to save the answer.",
      },
      { status: 500 }
    );
  }
}
