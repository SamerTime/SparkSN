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

    // Transcribe pending clips with BOUNDED concurrency. Full parallelism
    // (Promise.all over 10 clips) held every clip's bytes + base64 in memory at
    // once and OOM'd the Worker's 128MB isolate on long answers — killing the
    // whole request before any transcript was saved. Two at a time keeps peak
    // memory safe while still overlapping Whisper round-trips. Each clip keeps
    // its own try/catch so one failure does not fail the batch, and every
    // failure is COLLECTED and returned so the UI can surface it instead of
    // reporting a silent `transcribed: 0` success.
    const pendingIndexes = answers.flatMap((raw, i) => {
      const answer = obj(raw);
      const clipPath = str(answer.clipPath);
      const existing = str(answer.transcript) || str(answer.answer);
      // Only spoken clips without a transcript yet (idempotent).
      return clipPath && !existing ? [i] : [];
    });

    const failures: Array<{ questionIndex: number; clipPath: string; error: string }> =
      [];
    let transcribed = 0;
    let cursor = 0;
    const TRANSCRIBE_CONCURRENCY = 2;

    async function transcribeNext() {
      while (cursor < pendingIndexes.length) {
        const i = pendingIndexes[cursor++];
        const answer = obj(answers[i]);
        const clipPath = str(answer.clipPath);
        try {
          const text = (await transcribeRecordingAtPath(clipPath)).trim();
          if (!text) {
            failures.push({
              questionIndex: i,
              clipPath,
              error: "Transcription returned empty text.",
            });
            continue;
          }
          // The recruiter view reads `.answer`; keep `.transcript` in sync.
          answers[i] = { ...answer, transcript: text, answer: text };
          transcribed += 1;
        } catch (clipError) {
          console.error(
            `Spark clip transcription failed for ${clipPath}:`,
            clipError
          );
          failures.push({
            questionIndex: i,
            clipPath,
            error:
              clipError instanceof Error
                ? clipError.message
                : "Unknown transcription error.",
          });
        }
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(TRANSCRIBE_CONCURRENCY, pendingIndexes.length) },
        () => transcribeNext()
      )
    );

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

    return NextResponse.json({
      success: true,
      transcribed,
      failed: failures.length,
      failures,
    });
  } catch (error) {
    console.error("Spark transcribe-clips error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to transcribe interview clips." },
      { status: 500 }
    );
  }
}
