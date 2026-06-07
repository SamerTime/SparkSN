import { NextRequest, NextResponse } from "next/server";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import {
  getApplicationForRecruiterAction,
  updateApplication,
  type JsonValue,
} from "@/lib/spark-db";
import { transcribeInterviewRecording } from "@/lib/spark-transcription";

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const recruiter = await getSparkRecruiterUser();
    if (!recruiter) {
      return NextResponse.json(
        { success: false, error: "Recruiter login required." },
        { status: 401 }
      );
    }

    const { applicationId } = await params;
    const application = await getApplicationForRecruiterAction(applicationId);
    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found." },
        { status: 404 }
      );
    }

    const text = await transcribeInterviewRecording(application.interviewMedia);

    // Store the transcript on interviewMedia.session.recording (does not touch
    // interviewTranscript.answers), so we can validate before wiring it to Roger.
    const media = obj(application.interviewMedia);
    const session = obj(media.session);
    const recording = obj(session.recording);
    const nextMedia = {
      ...media,
      session: {
        ...session,
        recording: {
          ...recording,
          audioTranscript: text,
          audioTranscribedAt: new Date().toISOString(),
        },
      },
    };
    await updateApplication(
      applicationId,
      { interviewMedia: nextMedia as JsonValue },
      "id"
    );

    return NextResponse.json({ success: true, text });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Transcription failed.",
      },
      { status: 500 }
    );
  }
}
