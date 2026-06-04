import { NextRequest, NextResponse } from "next/server";
import {
  createInterviewRecordingUpload,
  getApplicationByInterviewToken,
} from "@/lib/spark-db";

const MAX_INTERVIEW_RECORDING_BYTES = 262_144_000;
const ALLOWED_CONTENT_TYPES = new Set([
  "video/webm",
  "video/mp4",
  "video/quicktime",
]);

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
      return NextResponse.json(
        { success: false, error: "Interview is already completed." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const contentType = stringValue(body.contentType).split(";")[0];
    const sizeBytes = numberValue(body.sizeBytes);

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { success: false, error: "Unsupported interview video format." },
        { status: 400 }
      );
    }

    if (
      sizeBytes === null ||
      sizeBytes <= 0 ||
      sizeBytes > MAX_INTERVIEW_RECORDING_BYTES
    ) {
      return NextResponse.json(
        { success: false, error: "Interview video size is not valid." },
        { status: 400 }
      );
    }

    const upload = await createInterviewRecordingUpload(
      application.id,
      token,
      contentType
    );

    return NextResponse.json({
      success: true,
      bucket: upload.bucket,
      path: upload.path,
      uploadToken: upload.token,
    });
  } catch (error) {
    console.error("Spark interview upload error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to prepare interview video upload." },
      { status: 500 }
    );
  }
}
