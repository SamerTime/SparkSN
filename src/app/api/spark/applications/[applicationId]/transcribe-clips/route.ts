import { NextRequest, NextResponse } from "next/server";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import {
  getSparkSupabase,
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

/**
 * Post-hoc (recruiter-side) transcription of per-question interview clips. The
 * candidate's flow only uploads clips; transcription runs here so a slow or
 * oversized 5-minute clip can never block or fail the candidate.
 *
 * Idempotent: only spoken answers that have a clipPath and no transcript yet are
 * transcribed. Each clip runs in its own try/catch so one failure (e.g. a long
 * clip that exceeds Whisper limits) does not fail the whole request.
 */
export async function POST(
  _request: NextRequest,
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
    const { data, error } = await getSparkSupabase()
      .from("SparkApplication")
      .select("id,interviewTranscript")
      .eq("id", applicationId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Unable to load Spark application." },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Application not found." },
        { status: 404 }
      );
    }

    const transcript = obj(
      (data as { interviewTranscript?: unknown }).interviewTranscript
    );
    const answers = Array.isArray(transcript.answers)
      ? [...(transcript.answers as unknown[])]
      : [];

    // Run pending Whisper calls in PARALLEL — for 10 clips this cuts a ~30-80s
    // sequential pass down to roughly the slowest single clip (~5-10s). Each
    // clip keeps its own try/catch so one failure (e.g. an oversized 5-minute
    // clip) does not fail the batch.
    const transcribeTasks = answers.map(async (raw, i) => {
      const answer = obj(raw);
      const clipPath = str(answer.clipPath);
      const existing = str(answer.transcript) || str(answer.answer);
      // Only spoken clips without a transcript yet (idempotent).
      if (!clipPath || existing) return false;
      try {
        const text = (await transcribeRecordingAtPath(clipPath)).trim();
        if (!text) return false;
        // The recruiter view reads `.answer`; keep `.transcript` in sync.
        answers[i] = { ...answer, transcript: text, answer: text };
        return true;
      } catch (clipError) {
        console.error(
          `Spark clip transcription failed for ${clipPath}:`,
          clipError
        );
        return false;
      }
    });
    const results = await Promise.all(transcribeTasks);
    const transcribed = results.filter(Boolean).length;

    if (transcribed > 0) {
      const nextTranscript = {
        ...transcript,
        answers,
      };
      await updateApplication(
        applicationId,
        { interviewTranscript: nextTranscript as JsonValue },
        "id"
      );
    }

    return NextResponse.json({ success: true, transcribed });
  } catch (error) {
    console.error("Spark transcribe-clips error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to transcribe interview clips." },
      { status: 500 }
    );
  }
}
