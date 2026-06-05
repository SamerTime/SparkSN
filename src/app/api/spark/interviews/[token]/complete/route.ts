import { NextRequest, NextResponse } from "next/server";
import {
  getApprovedQuestionBankForPosting,
  getApplicationByInterviewToken,
  SPARK_INTERVIEW_RECORDINGS_BUCKET,
  type JsonValue,
  updateApplication,
} from "@/lib/spark-db";
import { reviewScreeningWithRoger } from "@/lib/spark-roger";

type InterviewAnswer = {
  question: string;
  answer: string;
  questionId?: string;
  source?: string;
  sourceLabel?: string;
  type?: string;
  targetSeconds?: number | null;
  generatorLabel?: string;
  mcpRunId?: string | null;
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
      questionId: stringValue(item.questionId) || undefined,
      source: stringValue(item.source) || undefined,
      sourceLabel: stringValue(item.sourceLabel) || undefined,
      type: stringValue(item.type) || undefined,
      targetSeconds: numberValue(item.targetSeconds),
      generatorLabel: stringValue(item.generatorLabel) || undefined,
      mcpRunId: stringValue(item.mcpRunId) || null,
    }))
    .filter((item) => item.question && item.answer);
}

function chunkUploadsValue(value: unknown, applicationId: string) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => jsonObject(item))
    .map((item) => {
      const bucket = stringValue(item.bucket);
      const path = stringValue(item.path);
      return {
        bucket,
        path,
        mimeType: stringValue(item.mimeType),
        sizeBytes: numberValue(item.sizeBytes),
        uploadedAt: stringValue(item.uploadedAt),
      };
    })
    .filter(
      (item) =>
        item.bucket === SPARK_INTERVIEW_RECORDINGS_BUCKET &&
        item.path.startsWith(`${applicationId}/`)
    );
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
    const recordingStorage = jsonObject(recording.storage);
    const recordingBucket = stringValue(recordingStorage.bucket);
    const recordingPath = stringValue(recordingStorage.path);
    const validRecordingStorage =
      recordingBucket === SPARK_INTERVIEW_RECORDINGS_BUCKET &&
      recordingPath.startsWith(`${application.id}/`);
    const chunkUploads = chunkUploadsValue(recording.chunks, application.id);
    const chunkUploadSummary = jsonObject(recording.chunkUploadSummary);
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
        uploadStrategy:
          stringValue(recording.uploadStrategy) ||
          "final_recording_upload",
        chunks: chunkUploads as unknown as JsonValue,
        chunkUploadSummary: {
          uploadedChunks: chunkUploads.length,
          failedChunks: numberValue(chunkUploadSummary.failedChunks),
        },
        storage: validRecordingStorage
          ? {
              bucket: recordingBucket,
              path: recordingPath,
              uploadedAt: stringValue(recordingStorage.uploadedAt) || now,
            }
          : {
              status: "missing",
            },
      },
    }) as JsonValue;
    const questionBank = await getApprovedQuestionBankForPosting(
      application.posting.id
    );
    const aiSummary = await reviewScreeningWithRoger({
      applicationId: application.id,
      posting: application.posting,
      candidate: application.candidate,
      answers,
      questionBank,
      recordingSeconds,
      recordingCaptured: Boolean(recording.captured),
      browser: browser as JsonValue,
      deviceSignals: application.deviceSignals,
      locationSignals: application.locationSignals,
    });

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
