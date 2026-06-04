"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  Mic,
  PhoneOff,
  Play,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type SparkInterviewSessionProps = {
  token: string;
  candidateName: string;
  postingTitle: string;
  clientName?: string | null;
  initialStatus: string;
  questions: string[];
};

type InterviewPhase = "ready" | "active" | "completed";

type Answer = {
  question: string;
  answer: string;
};

type RecordingCapture = {
  blob: Blob | null;
  captured: boolean;
  durationSeconds: number;
  mimeType: string;
  sizeBytes: number;
};

type RecordingUploadResponse = {
  bucket: string;
  path: string;
  uploadToken: string;
};

const RECORDING_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function browserSignals() {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
    },
  };
}

function getRecordingMimeType() {
  if (!("MediaRecorder" in window)) return "";
  return (
    RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ||
    ""
  );
}

function storageContentType(mimeType: string) {
  return mimeType.split(";")[0] || "video/webm";
}

function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase browser configuration.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function SparkInterviewSession({
  token,
  candidateName,
  postingTitle,
  clientName,
  initialStatus,
  questions,
}: SparkInterviewSessionProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const captureRef = useRef<RecordingCapture | null>(null);

  const [phase, setPhase] = useState<InterviewPhase>(
    initialStatus === "completed" || initialStatus === "InterviewCompleted"
      ? "completed"
      : "ready"
  );
  const [loading, setLoading] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [recordingMeta, setRecordingMeta] = useState({
    captured: false,
    durationSeconds: 0,
    mimeType: "",
    sizeBytes: 0,
  });

  const currentQuestion = questions[questionIndex] || questions[0];
  const progress = Math.round(((questionIndex + 1) / questions.length) * 100);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const attachStream = (stream: MediaStream) => {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const startRecording = (stream: MediaStream) => {
    if (!("MediaRecorder" in window)) {
      return;
    }

    const mimeType = getRecordingMimeType();
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 550_000,
      audioBitsPerSecond: 64_000,
    });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.start(1000);
    recorderRef.current = recorder;
  };

  const startInterview = async () => {
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      attachStream(stream);
      startRecording(stream);
      startedAtRef.current = Date.now();

      const response = await fetch(`/api/spark/interviews/${token}/start`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to start interview.");
      }

      setPhase("active");
      toast.success("Interview started.");
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      toast.error(
        error instanceof Error
          ? error.message
          : "Camera and microphone are required."
      );
    } finally {
      setLoading(false);
    }
  };

  const stopRecorder = async (): Promise<RecordingCapture> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return captureRef.current || { ...recordingMeta, blob: null };
    }

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;

    const blob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "video/webm",
    });
    const durationSeconds = startedAtRef.current
      ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
      : 0;
    const meta = {
      captured: blob.size > 0,
      durationSeconds,
      mimeType: blob.type,
      sizeBytes: blob.size,
    };
    setRecordingMeta(meta);
    const capture = {
      ...meta,
      blob,
    };
    captureRef.current = capture;
    return capture;
  };

  const uploadRecording = async (capture: RecordingCapture) => {
    if (!capture.captured || !capture.blob) {
      return {
        captured: false,
        durationSeconds: capture.durationSeconds,
        mimeType: capture.mimeType,
        sizeBytes: capture.sizeBytes,
      };
    }

    const contentType = storageContentType(capture.mimeType);
    const response = await fetch(`/api/spark/interviews/${token}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType,
        sizeBytes: capture.sizeBytes,
      }),
    });
    const upload = (await response.json()) as Partial<RecordingUploadResponse> & {
      success?: boolean;
      error?: string;
    };

    if (
      !response.ok ||
      !upload.success ||
      !upload.bucket ||
      !upload.path ||
      !upload.uploadToken
    ) {
      throw new Error(upload.error || "Unable to prepare video upload.");
    }

    const supabase = getBrowserSupabase();
    const { error } = await supabase.storage
      .from(upload.bucket)
      .uploadToSignedUrl(upload.path, upload.uploadToken, capture.blob, {
        contentType,
      });

    if (error) {
      throw new Error(error.message || "Unable to upload interview video.");
    }

    return {
      captured: true,
      durationSeconds: capture.durationSeconds,
      mimeType: contentType,
      sizeBytes: capture.sizeBytes,
      storage: {
        bucket: upload.bucket,
        path: upload.path,
        uploadedAt: new Date().toISOString(),
      },
    };
  };

  const saveCurrentAnswer = () => {
    const answer = currentAnswer.trim();
    if (!answer) {
      toast.error("Please answer this question before continuing.");
      return null;
    }

    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = {
      question: currentQuestion,
      answer,
    };
    setAnswers(nextAnswers);
    return nextAnswers;
  };

  const nextQuestion = () => {
    const nextAnswers = saveCurrentAnswer();
    if (!nextAnswers) return;

    setQuestionIndex((current) => current + 1);
    setCurrentAnswer(nextAnswers[questionIndex + 1]?.answer || "");
  };

  const completeInterview = async () => {
    const nextAnswers = saveCurrentAnswer();
    if (!nextAnswers) return;

    setLoading(true);
    try {
      const capture = await stopRecorder();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const recording = await uploadRecording(capture);

      const response = await fetch(`/api/spark/interviews/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: nextAnswers,
          recording,
          browser: browserSignals(),
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to complete interview.");
      }

      setPhase("completed");
      toast.success("Interview completed.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to complete interview."
      );
    } finally {
      setLoading(false);
    }
  };

  if (phase === "completed") {
    return (
      <div className="flex min-h-[720px] flex-col justify-center bg-[var(--sn-soft)] px-5 pb-5 pt-16 text-center">
        <div className="sn-card p-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--sn-success-50)] text-[var(--sn-success)]">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold text-[var(--sn-ink)]">
            Screening complete
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--sn-muted)]">
            Your Spark interview is complete. A recruiter can now review your
            answers and follow up.
          </p>
          {recordingMeta.captured && (
            <p className="mt-4 rounded-lg bg-[var(--sn-success-50)] px-3 py-2 text-xs font-bold text-[var(--sn-success)]">
              Video session captured: {recordingMeta.durationSeconds}s
            </p>
          )}
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="flex min-h-[720px] flex-col bg-[var(--sn-soft)]">
        <header className="spark-mobile-header px-5 pb-4 pt-16">
          <p className="text-xs font-extrabold uppercase tracking-normal text-[var(--sn-blue-700)]">
            Interview session
          </p>
          <h1 className="mt-1 text-xl font-extrabold text-[var(--sn-ink)]">
            {postingTitle}
          </h1>
          {clientName && (
            <span className="sn-chip sn-chip-blue mt-3">{clientName}</span>
          )}
        </header>

        <div className="flex flex-1 flex-col justify-center px-4 py-5">
          <section className="sn-card p-4">
            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-[#111827]">
              <div className="flex h-full items-center justify-center text-white">
                <div className="text-center">
                  <Camera className="mx-auto h-10 w-10" />
                  <p className="mt-3 text-sm font-bold">Camera ready</p>
                </div>
              </div>
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-[var(--sn-ink)]">
              Hi {candidateName}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[var(--sn-line)] bg-white p-3">
                <Camera className="h-5 w-5 text-[var(--sn-coral)]" />
                <p className="mt-2 text-xs font-bold text-[var(--sn-ink)]">
                  Video
                </p>
              </div>
              <div className="rounded-lg border border-[var(--sn-line)] bg-white p-3">
                <Mic className="h-5 w-5 text-[var(--sn-blue)]" />
                <p className="mt-2 text-xs font-bold text-[var(--sn-ink)]">
                  Audio
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 border-t border-[var(--sn-line)] bg-white p-4">
          <Button
            type="button"
            className="sn-button-coral h-12 w-full text-base font-extrabold"
            onClick={startInterview}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start screening
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[720px] flex-col bg-[var(--sn-soft)]">
      <header className="spark-mobile-header px-5 pb-4 pt-16">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-normal text-[var(--sn-blue-700)]">
              Question {questionIndex + 1} of {questions.length}
            </p>
            <h1 className="mt-1 text-lg font-extrabold text-[var(--sn-ink)]">
              {postingTitle}
            </h1>
          </div>
          <span className="sn-chip sn-chip-coral">{progress}%</span>
        </div>
        <div className="mt-4 flex gap-1">
          {questions.map((question, index) => (
            <span
              key={question}
              className={
                index < questionIndex
                  ? "spark-stage-line is-done"
                  : index === questionIndex
                    ? "spark-stage-line is-current"
                    : "spark-stage-line"
              }
            />
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-lg bg-[#111827]">
          <video
            ref={videoRef}
            className="aspect-[4/3] w-full object-cover"
            autoPlay
            muted
            playsInline
          />
        </section>

        <section className="sn-card p-4">
          <h2 className="text-lg font-extrabold leading-7 text-[var(--sn-ink)]">
            {currentQuestion}
          </h2>
          <textarea
            value={currentAnswer}
            onChange={(event) => setCurrentAnswer(event.target.value)}
            className="sn-input mt-4 min-h-36 w-full px-3 py-2 text-sm"
            placeholder="Answer in your own words while the session records."
          />
        </section>
      </div>

      <div className="sticky bottom-0 grid grid-cols-[auto_1fr] gap-2 border-t border-[var(--sn-line)] bg-white p-4">
        <Button
          type="button"
          variant="outline"
          className="h-12 border-[var(--sn-line)]"
          onClick={completeInterview}
          disabled={loading}
          title="End interview"
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
        {questionIndex === questions.length - 1 ? (
          <Button
            type="button"
            className="sn-button-coral h-12 font-extrabold"
            onClick={completeInterview}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit screening
          </Button>
        ) : (
          <Button
            type="button"
            className="sn-button-primary h-12 font-extrabold"
            onClick={nextQuestion}
            disabled={loading}
          >
            Next question
          </Button>
        )}
      </div>
    </div>
  );
}
