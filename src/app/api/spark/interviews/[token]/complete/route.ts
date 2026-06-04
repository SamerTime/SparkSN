import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationByInterviewToken,
  type JsonValue,
  updateApplication,
} from "@/lib/spark-db";

type InterviewAnswer = {
  question: string;
  answer: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function answersValue(value: unknown): InterviewAnswer[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => jsonObject(item))
    .map((item) => ({
      question: stringValue(item.question),
      answer: stringValue(item.answer),
    }))
    .filter((item) => item.question && item.answer);
}

function appendEvent(current: unknown, event: Record<string, unknown>) {
  const state = jsonObject(current);
  const existingEvents = Array.isArray(state.events) ? state.events : [];

  return {
    ...state,
    events: [...existingEvents, event],
  };
}

function updateSession(current: unknown, values: Record<string, unknown>) {
  const media = jsonObject(current);
  const session = jsonObject(media.session);

  return {
    ...media,
    session: {
      ...session,
      ...values,
    },
  };
}

function createSummary(
  answers: InterviewAnswer[],
  postingTitle: string,
  recordingSeconds: number | null
) {
  const answerText = answers.map((item) => item.answer).join(" ");
  const shortAnswerCount = answers.filter((item) => item.answer.length < 35).length;
  const availabilityAnswer =
    answers.find((item) => /availability|scheduling/i.test(item.question))?.answer ||
    "";
  const supportAnswer =
    answers.find((item) => /support|ramp/i.test(item.question))?.answer || "";

  return {
    status: "completed",
    generatedBy: "spark_rules_v1",
    summary:
      answerText.length > 0
        ? `Candidate completed a short screening for ${postingTitle}. Responses covered role fit, work style, availability, communication, reliability, and ramp-up needs. Recruiter should review the full answers before making a decision.`
        : `Candidate completed the screening for ${postingTitle}, but answer content was limited.`,
    recruiterFocus: [
      availabilityAnswer
        ? `Availability/scheduling: ${availabilityAnswer}`
        : "Confirm availability and schedule fit.",
      supportAnswer
        ? `Ramp-up/support: ${supportAnswer}`
        : "Confirm onboarding support needed.",
      shortAnswerCount > 2
        ? "Several answers were brief; recruiter may want follow-up questions."
        : "Answers appear complete enough for recruiter review.",
    ],
    nonBiasNotice:
      "Summary intentionally avoids protected-class assumptions and should be used only as recruiter review support.",
    answerCount: answers.length,
    recordingSeconds,
    completedAt: new Date().toISOString(),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const application = await getApplicationByInterviewToken(token);

    if (!application || !application.posting) {
      return NextResponse.json(
        { success: false, error: "Interview session not found." },
        { status: 404 }
      );
    }

    const answers = answersValue(body.answers);
    if (answers.length < 3) {
      return NextResponse.json(
        { success: false, error: "Please answer at least three questions." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const recording = jsonObject(body.recording);
    const browser = jsonObject(body.browser);
    const recordingSeconds = numberValue(recording.durationSeconds);
    const transcript: JsonValue = {
      source: "spark_interview_session",
      submittedAt: now,
      answers: answers as unknown as JsonValue,
      browser: browser as JsonValue,
    };
    const interviewMedia = updateSession(application.interviewMedia, {
      status: "completed",
      completedAt: now,
      recording: {
        captured: Boolean(recording.captured),
        durationSeconds: recordingSeconds,
        mimeType: stringValue(recording.mimeType),
        sizeBytes: numberValue(recording.sizeBytes),
        storage: "pending_supabase_storage",
      },
    }) as JsonValue;
    const aiSummary = createSummary(
      answers,
      application.posting.title,
      recordingSeconds
    ) as JsonValue;

    const updated = await updateApplication(
      application.id,
      {
        status: "InterviewCompleted",
        interviewMedia,
        interviewTranscript: transcript,
        aiSummary,
        communicationState: appendEvent(application.communicationState, {
          type: "interview_completed",
          label: "Interview completed",
          at: now,
          channel: "candidate",
          messagePreview:
            "Candidate completed the Spark screening session for recruiter review.",
        }) as JsonValue,
      },
      "id,status"
    );

    return NextResponse.json({
      success: true,
      status: updated.status,
    });
  } catch (error) {
    console.error("Spark interview complete error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to complete interview." },
      { status: 500 }
    );
  }
}
