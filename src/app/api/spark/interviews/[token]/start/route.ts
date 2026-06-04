import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationByInterviewToken,
  type JsonValue,
  updateApplication,
} from "@/lib/spark-db";

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const application = await getApplicationByInterviewToken(token);

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Interview session not found." },
        { status: 404 }
      );
    }

    if (application.status === "InterviewCompleted") {
      return NextResponse.json({
        success: true,
        status: application.status,
      });
    }

    const now = new Date().toISOString();
    const userAgent = request.headers.get("user-agent");

    await updateApplication(application.id, {
      status: "InterviewStarted",
      interviewMedia: updateSession(application.interviewMedia, {
        status: "started",
        startedAt: now,
        userAgent,
      }) as JsonValue,
      communicationState: appendEvent(application.communicationState, {
        type: "interview_started",
        label: "Interview started",
        at: now,
        channel: "candidate",
        messagePreview: "Candidate opened the interview session.",
      }) as JsonValue,
    });

    return NextResponse.json({
      success: true,
      status: "InterviewStarted",
    });
  } catch (error) {
    console.error("Spark interview start error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to start interview." },
      { status: 500 }
    );
  }
}
