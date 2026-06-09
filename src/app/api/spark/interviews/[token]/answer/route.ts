import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationByInterviewToken,
  SPARK_INTERVIEW_RECORDINGS_BUCKET,
  updateApplication,
  type JsonValue,
} from "@/lib/spark-db";

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

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sessionQuestions(application: { interviewMedia?: unknown }) {
  const media = obj(application.interviewMedia);
  const session = obj(media.session);
  return Array.isArray(session.questions) ? session.questions : [];
}

function sessionExpiresAt(application: { interviewMedia?: unknown }) {
  const media = obj(application.interviewMedia);
  const session = obj(media.session);
  return str(session.expiresAt);
}

function isExpired(expiresAt: string, nowMs: number) {
  if (!expiresAt) return false;
  const expiresMs = Date.parse(expiresAt);
  return Number.isFinite(expiresMs) && expiresMs <= nowMs;
}

function validRecordingStorage(
  storage: Record<string, unknown>,
  applicationId: string
) {
  const bucket = str(storage.bucket);
  const path = str(storage.path);

  return (
    path.length > 0 &&
    path.startsWith(`${applicationId}/`) &&
    (!bucket || bucket === SPARK_INTERVIEW_RECORDINGS_BUCKET)
  );
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

    if (application.status === "InterviewCompleted") {
      return NextResponse.json(
        { success: false, error: "Interview is already completed." },
        { status: 409 }
      );
    }

    if (isExpired(sessionExpiresAt(application), Date.now())) {
      return NextResponse.json(
        { success: false, error: "Interview session has expired." },
        { status: 410 }
      );
    }

    const body = obj(await request.json());
    const questions = sessionQuestions(application);
    const questionIndex = finiteNumber(body.questionIndex);
    if (
      questionIndex === null ||
      !Number.isInteger(questionIndex) ||
      questionIndex < 0 ||
      questionIndex >= questions.length
    ) {
      return NextResponse.json(
        { success: false, error: "Question index is not valid." },
        { status: 400 }
      );
    }
    const mode = str(body.mode) === "typed" ? "typed" : "spoken";

    const transcript = "";
    let clipPath = "";
    if (mode === "spoken") {
      const recordingStorage = obj(obj(body.recording).storage);
      clipPath = str(recordingStorage.path);
      if (!validRecordingStorage(recordingStorage, application.id)) {
        return NextResponse.json(
          {
            success: false,
            error: "A valid recording clip path is required for this interview.",
          },
          { status: 400 }
        );
      }
      // Decoupled capture: the uploaded clip IS the saved answer. We do NOT
      // transcribe in the candidate's path — transcription runs post-hoc
      // (recruiter side) from clipPath, so a slow or oversized 5-minute clip can
      // never block or fail the candidate. transcript stays empty here.
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
