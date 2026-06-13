import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getSparkSupabase,
  SPARK_INTERVIEW_RECORDINGS_BUCKET,
} from "@/lib/spark-db";

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

type WhisperResult = { text?: string };
type AiBinding = {
  run: (model: string, input: { audio: string }) => Promise<WhisperResult>;
};

/** Path of the candidate's stored recording, or "" if none. */
export function recordingStoragePath(interviewMedia: unknown): string {
  const storage = obj(obj(obj(obj(interviewMedia).session).recording).storage);
  return str(storage.path);
}

/**
 * Transcribe the candidate's stored interview recording with Workers AI Whisper.
 * Deploy-only: Workers AI has no local inference, and the recording is a webm
 * VIDEO — whether Whisper decodes it cleanly is exactly what this validates.
 */
export async function transcribeInterviewRecording(
  interviewMedia: unknown
): Promise<string> {
  const path = recordingStoragePath(interviewMedia);
  if (!path) {
    throw new Error("No recording is stored for this candidate yet.");
  }
  return transcribeRecordingAtPath(path);
}

/**
 * Transcribe a single stored recording clip (a per-question segment, or the
 * whole-session recording) at the given storage path with Workers AI Whisper.
 */
export async function transcribeRecordingAtPath(path: string): Promise<string> {
  if (!path) {
    throw new Error("No recording path provided.");
  }

  const { data, error } = await getSparkSupabase()
    .storage.from(SPARK_INTERVIEW_RECORDINGS_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(
      `Unable to download the recording: ${error?.message || "file missing"}`
    );
  }

  // Base64 the clip for whisper-large-v3-turbo. The previous @cf/openai/whisper
  // model required `audio: number[]` — Array.from() on a multi-MB clip inflated
  // memory ~8x (a 14MB five-minute answer became a ~60-110MB JS array), which
  // blew the Worker's 128MB isolate limit and silently killed transcription for
  // every long-form candidate. Base64 costs ~1.3x instead.
  const audio = Buffer.from(await data.arrayBuffer()).toString("base64");

  const env = getCloudflareContext().env as unknown as { AI?: AiBinding };
  if (!env.AI) {
    throw new Error(
      "Workers AI binding (AI) is unavailable — enable Workers AI on the account and deploy."
    );
  }

  const result = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
    audio,
  });
  const text = str(result.text).trim();
  if (!text) {
    throw new Error(
      "Transcription returned empty text — the clip may be video-only or an unsupported container."
    );
  }
  return text;
}
