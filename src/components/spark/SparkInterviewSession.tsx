"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  Mic,
  Pencil,
  PhoneOff,
  Play,
  Send,
  SwitchCamera,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type SparkInterviewSessionProps = {
  token: string;
  candidateName: string;
  postingTitle: string;
  clientName?: string | null;
  initialStatus: string;
  questions: InterviewQuestion[];
};

type InterviewPhase = "ready" | "reading" | "active" | "completed";
type CameraFacing = "user" | "environment";

type Answer = {
  question: string;
  answer: string;
  questionId?: string;
  source?: string;
  sourceLabel?: string;
  type?: string;
  targetSeconds?: number;
  generatorLabel?: string;
  mcpRunId?: string | null;
  mode?: "spoken" | "typed";
  reason?: string;
  clipPath?: string;
};

type TypedReason = "accessibility" | "technical" | "cant_speak" | "other";

const TYPED_REASON_LABELS: Record<TypedReason, string> = {
  accessibility: "Accessibility",
  technical: "Technical issue (mic/camera)",
  cant_speak: "Can't speak aloud right now",
  other: "Other",
};

type InterviewQuestion = {
  id: string;
  text: string;
  type: string;
  source: string;
  sourceLabel: string;
  generatorLabel: string;
  mcpRunId: string | null;
  targetSeconds: number;
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
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
];
const RECORDING_CHUNK_MS = 6_000;
// Each spoken answer can run up to 5 minutes; at the cap we auto-submit/advance
// that question by reusing the normal submit path (capture + queue + advance,
// or complete on the last question) so the candidate never loses the clip.
const MAX_ANSWER_SECONDS = 300;
// Read gate: before recording starts on each question, the candidate sees the
// question with a short countdown so they can read it and compose themselves.
// Recording (and the 5-minute answer cap) only begins once the gate ends.
const READ_GATE_SECONDS = 10;

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

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function mediaConstraints(facingMode: CameraFacing): MediaStreamConstraints {
  return {
    video: {
      facingMode,
      // Request the camera's natural (landscape) sensor for a wider field of
      // view; forcing portrait makes phones center-crop the sensor (= zoomed in
      // too close). The portrait preview box still frames it via object-cover.
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 15, max: 24 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };
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
  initialStatus,
  questions,
}: SparkInterviewSessionProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkUploadsRef = useRef<
    Array<{
      bucket: string;
      path: string;
      sizeBytes: number;
      mimeType: string;
      uploadedAt: string;
    }>
  >([]);
  const pendingChunkUploadsRef = useRef<Promise<void>[]>([]);
  const failedChunkUploadsRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const captureRef = useRef<RecordingCapture | null>(null);
  const timerRef = useRef<number | null>(null);
  // Per-question upload+transcribe tasks run in the background so advancing is
  // instant; answersRef is the authoritative answers list they fill in.
  const answerTasksRef = useRef<Promise<void>[]>([]);
  const answersRef = useRef<Answer[]>([]);
  // Guards the 5-minute auto-submit so it fires once per question and never
  // races a manual Next/Submit tap.
  const autoSubmittingRef = useRef(false);
  // Read gate: countdown timer + a once-guard so the gate begins recording
  // exactly once (the tick and the "Start answering now" tap can't double-fire).
  const readTimerRef = useRef<number | null>(null);
  const readDoneRef = useRef(false);

  const [phase, setPhase] = useState<InterviewPhase>(
    initialStatus === "completed" || initialStatus === "InterviewCompleted"
      ? "completed"
      : "ready"
  );
  const [loading, setLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("user");
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [, setBackgroundUpload] = useState({
    uploadedChunks: 0,
    pendingChunks: 0,
    failedChunks: 0,
  });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [recordingMeta, setRecordingMeta] = useState({
    captured: false,
    durationSeconds: 0,
    mimeType: "",
    sizeBytes: 0,
  });
  const [questionMode, setQuestionMode] = useState<"spoken" | "typed">("spoken");
  const [typedReason, setTypedReason] = useState<TypedReason>("cant_speak");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [readCountdown, setReadCountdown] = useState(READ_GATE_SECONDS);

  const currentQuestion = questions[questionIndex] || questions[0];
  const currentQuestionText = currentQuestion?.text || "";

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (readTimerRef.current) window.clearInterval(readTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [phase, previewReady]);

  const attachStream = (stream: MediaStream) => {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const stopCurrentStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPreviewReady(false);
  };

  const requestMediaStream = async (facingMode: CameraFacing) => {
    const stream = await navigator.mediaDevices.getUserMedia(
      mediaConstraints(facingMode)
    );
    attachStream(stream);
    setPreviewReady(true);
    return stream;
  };

  const updateBackgroundUploadState = () => {
    setBackgroundUpload((current) => ({
      ...current,
      uploadedChunks: chunkUploadsRef.current.length,
      pendingChunks: pendingChunkUploadsRef.current.length,
    }));
  };

  const uploadRecordingBlob = async (blob: Blob, mimeType: string) => {
    const contentType = storageContentType(mimeType);
    const response = await fetch(`/api/spark/interviews/${token}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType,
        sizeBytes: blob.size,
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
      .uploadToSignedUrl(upload.path, upload.uploadToken, blob, {
        contentType,
      });

    if (error) {
      throw new Error(error.message || "Unable to upload interview video.");
    }

    return {
      bucket: upload.bucket,
      path: upload.path,
      mimeType: contentType,
      sizeBytes: blob.size,
      uploadedAt: new Date().toISOString(),
    };
  };

  // Upload a clip, retrying ONCE after a short wait on a transient failure so a
  // single hiccup doesn't silently drop a candidate's answer clip.
  const uploadRecordingBlobWithRetry = async (blob: Blob, mimeType: string) => {
    try {
      return await uploadRecordingBlob(blob, mimeType);
    } catch (error) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      try {
        return await uploadRecordingBlob(blob, mimeType);
      } catch {
        throw error instanceof Error
          ? error
          : new Error("Unable to upload interview video.");
      }
    }
  };

  const uploadChunkInBackground = (chunk: Blob) => {
    if (!chunk.size) return;

    const uploadPromise = uploadRecordingBlob(
      chunk,
      chunk.type || recorderRef.current?.mimeType || "video/webm"
    )
      .then((upload) => {
        chunkUploadsRef.current.push(upload);
        setBackgroundUpload((current) => ({
          ...current,
          uploadedChunks: chunkUploadsRef.current.length,
        }));
      })
      .catch(() => {
        failedChunkUploadsRef.current += 1;
        setBackgroundUpload((current) => ({
          ...current,
          failedChunks: failedChunkUploadsRef.current,
        }));
      })
      .finally(() => {
        pendingChunkUploadsRef.current =
          pendingChunkUploadsRef.current.filter((item) => item !== uploadPromise);
        updateBackgroundUploadState();
      });

    pendingChunkUploadsRef.current.push(uploadPromise);
    updateBackgroundUploadState();
  };

  const waitForBackgroundUploads = async () => {
    const pendingUploads = pendingChunkUploadsRef.current;
    if (pendingUploads.length) {
      await Promise.allSettled(pendingUploads);
      updateBackgroundUploadState();
    }
  };

  const startRecording = (stream: MediaStream) => {
    if (!("MediaRecorder" in window)) {
      return;
    }

    const mimeType = getRecordingMimeType();
    chunkUploadsRef.current = [];
    pendingChunkUploadsRef.current = [];
    failedChunkUploadsRef.current = 0;
    setBackgroundUpload({
      uploadedChunks: 0,
      pendingChunks: 0,
      failedChunks: 0,
    });
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      // Low video bitrate keeps per-question clips small enough for Whisper's
      // request limit (the 3006 "too large" cause); high audio bitrate keeps
      // transcription accurate.
      videoBitsPerSecond: 250_000,
      audioBitsPerSecond: 128_000,
    });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
        uploadChunkInBackground(event.data);
      }
    };
    recorder.start(RECORDING_CHUNK_MS);
    recorderRef.current = recorder;
  };

  const startCameraTest = async (facingMode = cameraFacing) => {
    setLoading(true);
    try {
      stopCurrentStream();
      await requestMediaStream(facingMode);
      toast.success("Camera and microphone are ready.");
    } catch (error) {
      stopCurrentStream();
      toast.error(
        error instanceof Error
          ? error.message
          : "Camera and microphone are required."
      );
    } finally {
      setLoading(false);
    }
  };

  const switchCamera = async () => {
    if (phase !== "ready") return;
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    setCameraFacing(nextFacing);
    await startCameraTest(nextFacing);
  };

  const startInterview = async () => {
    setLoading(true);
    try {
      // Make sure camera/mic are live, then mark the interview started. Recording
      // does not begin here — the read gate shows Q1 first and starts the clip.
      await (streamRef.current
        ? Promise.resolve(streamRef.current)
        : requestMediaStream(cameraFacing));

      const response = await fetch(`/api/spark/interviews/${token}/start`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to start interview.");
      }

      enterReadGate();
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (readTimerRef.current) window.clearInterval(readTimerRef.current);
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
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      recorder.onstop = done;
      // Safety: if onstop never fires (a known browser quirk) don't hang.
      window.setTimeout(done, 4000);
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

  const beginQuestionRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    autoSubmittingRef.current = false;
    startRecording(stream);
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    setRecordingElapsed(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setRecordingElapsed(
        Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      );
    }, 1000);
  };

  // Read gate: show the question with a countdown (camera live, NOT recording),
  // then start recording automatically. Used before every spoken question so
  // candidates can read and compose themselves before the clip begins.
  const enterReadGate = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (readTimerRef.current) window.clearInterval(readTimerRef.current);
    autoSubmittingRef.current = false;
    readDoneRef.current = false;
    setRecordingElapsed(0);
    setReadCountdown(READ_GATE_SECONDS);
    setPhase("reading");
    const startedAt = Date.now();
    // Compute remaining from wall-clock so a throttled tab still ends on time.
    readTimerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, READ_GATE_SECONDS - elapsed);
      setReadCountdown(remaining);
      if (remaining <= 0) beginAnswering();
    }, 250);
  };

  // Leave the read gate and start the actual recording. Guarded so the tick at
  // 0 and a manual "Start answering now" tap can never both fire it.
  const beginAnswering = () => {
    if (readDoneRef.current) return;
    readDoneRef.current = true;
    if (readTimerRef.current) {
      window.clearInterval(readTimerRef.current);
      readTimerRef.current = null;
    }
    beginQuestionRecording();
    setPhase("active");
  };

  const stopAndDiscardRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    if (timerRef.current) window.clearInterval(timerRef.current);
    chunksRef.current = [];
  };

  // Pencil: this question becomes a typed accessibility exception.
  const switchToTyped = (reason: TypedReason) => {
    stopAndDiscardRecording();
    setTypedReason(reason);
    setQuestionMode("typed");
    setReasonOpen(false);
    setCurrentAnswer("");
  };

  const switchToSpoken = () => {
    setQuestionMode("spoken");
    setReasonOpen(false);
    setCurrentAnswer("");
    enterReadGate();
  };

  // Capture the current answer quickly: stop the recorder (spoken) or read the
  // text (typed). Does NOT upload or transcribe — that runs in the background
  // (queueAnswer) so advancing to the next question is instant.
  type CapturedAnswer = {
    meta: Answer;
    mode: "spoken" | "typed";
    text?: string;
    reason?: TypedReason;
    capture?: RecordingCapture;
  };

  const captureAnswer = async (): Promise<CapturedAnswer | null> => {
    const meta: Answer = {
      question: currentQuestionText,
      questionId: currentQuestion?.id,
      source: currentQuestion?.source,
      sourceLabel: currentQuestion?.sourceLabel,
      type: currentQuestion?.type,
      targetSeconds: currentQuestion?.targetSeconds || 60,
      generatorLabel: currentQuestion?.generatorLabel,
      mcpRunId: currentQuestion?.mcpRunId,
      answer: "",
    };
    if (questionMode === "typed") {
      const text = currentAnswer.trim();
      if (!text) {
        toast.error("Type your answer, or switch back to video.");
        return null;
      }
      return { meta, mode: "typed", text, reason: typedReason };
    }
    const capture = await stopRecorder();
    if (!capture.blob || !capture.blob.size) {
      toast.error(
        "No recording was captured — try again, or tap the pencil to type."
      );
      return null;
    }
    return { meta, mode: "spoken", capture };
  };

  // Record the answer locally, then upload + transcribe in the BACKGROUND. The
  // transcript fills into answersRef[index] when it resolves; completion waits
  // for all of these tasks before sending /complete.
  const queueAnswer = (captured: CapturedAnswer, index: number) => {
    const placeholder: Answer =
      captured.mode === "typed"
        ? {
            ...captured.meta,
            answer: captured.text || "",
            mode: "typed",
            reason: captured.reason,
          }
        : { ...captured.meta, answer: "", mode: "spoken" };
    answersRef.current[index] = placeholder;
    setAnswers((current) => {
      const next = [...current];
      next[index] = placeholder;
      return next;
    });

    const task = (async () => {
      try {
        if (captured.mode === "typed") {
          await fetch(`/api/spark/interviews/${token}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionIndex: index,
              questionId: captured.meta.questionId,
              question: captured.meta.question,
              mode: "typed",
              typedAnswer: captured.text,
              reason: captured.reason,
            }),
          });
          return;
        }
        const blob = captured.capture?.blob;
        if (!blob) return;
        const upload = await uploadRecordingBlobWithRetry(
          blob,
          captured.capture?.mimeType || "video/webm"
        );
        const res = await fetch(`/api/spark/interviews/${token}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionIndex: index,
            questionId: captured.meta.questionId,
            question: captured.meta.question,
            mode: "spoken",
            recording: {
              storage: { bucket: upload.bucket, path: upload.path },
              durationSeconds: captured.capture?.durationSeconds,
              mimeType: upload.mimeType,
            },
          }),
        });
        const result = await res.json().catch(() => null);
        const transcript =
          typeof result?.answer?.transcript === "string"
            ? result.answer.transcript
            : "";
        const finalAnswer: Answer = {
          ...placeholder,
          answer: transcript,
          clipPath: upload.path,
        };
        answersRef.current[index] = finalAnswer;
        setAnswers((current) => {
          const next = [...current];
          next[index] = finalAnswer;
          return next;
        });
      } catch (error) {
        console.error("Spark answer processing failed:", error);
      }
    })();
    answerTasksRef.current.push(task);
  };

  const nextQuestion = async () => {
    setLoading(true);
    const captured = await captureAnswer();
    setLoading(false);
    if (!captured) return;
    queueAnswer(captured, questionIndex);
    setQuestionIndex((current) => current + 1);
    setCurrentAnswer("");
    setQuestionMode("spoken");
    setReasonOpen(false);
    enterReadGate();
  };

  const completeInterview = async () => {
    setLoading(true);
    const captured = await captureAnswer();
    if (!captured) {
      setLoading(false);
      return;
    }
    queueAnswer(captured, questionIndex);
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (readTimerRef.current) window.clearInterval(readTimerRef.current);
      // Wait for every per-question upload + transcription to finish.
      await Promise.allSettled(answerTasksRef.current);
      await waitForBackgroundUploads();

      const saved = answersRef.current.filter(Boolean);
      const response = await fetch(`/api/spark/interviews/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: saved,
          recording: {
            captured: saved.some((item) => item?.mode === "spoken"),
            durationSeconds: recordingElapsed,
            mimeType: getRecordingMimeType(),
            uploadStrategy: "per_question_clips",
          },
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

  // 5-minute per-question cap: when the live timer hits the cap during a spoken
  // answer, auto-submit/advance through the SAME path a manual tap uses (Next on
  // earlier questions, Submit/complete on the last). Guarded so it fires once.
  useEffect(() => {
    if (phase !== "active") return;
    if (questionMode !== "spoken") return;
    if (recordingElapsed < MAX_ANSWER_SECONDS) return;
    if (autoSubmittingRef.current || loading) return;
    autoSubmittingRef.current = true;
    const isLast = questionIndex === questions.length - 1;
    if (isLast) {
      void completeInterview();
    } else {
      void nextQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingElapsed, phase, questionMode, questionIndex, loading]);

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
            AI Screening
          </p>
          <h1 className="mt-1 text-xl font-extrabold text-[var(--sn-ink)]">
            {postingTitle}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--sn-muted)]">
            Your camera is used to confirm it&apos;s you answering.
          </p>
        </header>

        <div className="flex flex-1 flex-col justify-center px-4 py-5">
          <section className="sn-card p-4">
            <div className="relative mx-auto aspect-[9/16] max-h-[58vh] w-full max-w-sm overflow-hidden rounded-lg bg-[#111827]">
              {previewReady ? (
                <>
                  <video
                    ref={videoRef}
                    className={`h-full w-full object-cover ${
                      cameraFacing === "user" ? "scale-x-[-1]" : ""
                    }`}
                    autoPlay
                    muted
                    playsInline
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-extrabold text-white backdrop-blur">
                    {cameraFacing === "user" ? "Mirrored selfie preview" : "Rear camera preview"}
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-white">
                  <div className="text-center">
                    <Camera className="mx-auto h-10 w-10" />
                    <p className="mt-3 text-sm font-bold">Camera preview</p>
                  </div>
                </div>
              )}
            </div>
            {!previewReady && (
              <p className="mt-3 rounded-lg bg-[var(--sn-blue-50)] px-3 py-2 text-xs font-bold text-[var(--sn-blue-700)]">
                Tap Test camera to see yourself and check your setup.
              </p>
            )}
            <h2 className="mt-4 text-xl font-extrabold text-[var(--sn-ink)]">
              Hi {candidateName}
            </h2>
            {previewReady && (
              <div className="mt-4 rounded-lg border border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)] p-3">
                <p className="text-sm font-extrabold text-[var(--sn-ink)]">
                  Ready for your AI Screening? It&apos;s simple — you&apos;ll
                  answer a few questions out loud.
                </p>
                <p className="mt-2 text-sm font-extrabold text-[var(--sn-coral-600)]">
                  This session is recorded.
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--sn-coral-600)]">
                  Your camera and microphone are recorded during this screening.
                  Your spoken answers are converted to text, and your responses
                  are reviewed by StaffingNation recruiters and automated (AI)
                  tools to evaluate your fit for this role. The camera helps
                  confirm a real person is completing the screening. Recordings
                  and transcripts are stored securely. See our Privacy Policy and
                  Terms.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="sticky bottom-0 space-y-2 border-t border-[var(--sn-line)] bg-white p-4">
          {!previewReady ? (
            <Button
              type="button"
              className="sn-button-coral h-12 w-full text-base font-extrabold"
              onClick={() => startCameraTest()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Test camera
            </Button>
          ) : (
            <>
              <p className="text-[11px] leading-4 text-[var(--sn-muted)]">
                By pressing Start My AI Screening, you confirm you are the
                applicant and consent to being recorded, transcribed, and
                reviewed as described above.
              </p>
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
                Start My AI Screening
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-[var(--sn-line)] font-extrabold"
                onClick={switchCamera}
                disabled={loading}
              >
                <SwitchCamera className="h-4 w-4" />
                Flip camera
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === "reading") {
    const ringSize = 72;
    const ringRadius = 30;
    const ringCirc = 2 * Math.PI * ringRadius;
    const ringOffset = ringCirc * (1 - readCountdown / READ_GATE_SECONDS);
    return (
      <div className="flex min-h-[720px] flex-col bg-[var(--sn-soft)]">
        <header className="spark-mobile-header px-5 pb-4 pt-16">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-normal text-[var(--sn-blue-700)]">
                Get ready
              </p>
              <h1 className="mt-1 text-lg font-extrabold text-[var(--sn-ink)]">
                Question {questionIndex + 1} of {questions.length}
              </h1>
            </div>
            <span className="sn-chip sn-chip-coral">Not recording yet</span>
          </div>
        </header>

        <div className="flex-1 space-y-4 px-4 py-4">
          <section className="relative mx-auto aspect-[9/16] max-h-[52vh] w-full max-w-sm overflow-hidden rounded-lg bg-[#111827]">
            <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs font-extrabold text-white backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[var(--sn-coral)]" />
              Camera on · not recording
            </div>
            <video
              ref={videoRef}
              className={`h-full w-full object-cover ${
                cameraFacing === "user" ? "scale-x-[-1]" : ""
              }`}
              autoPlay
              muted
              playsInline
            />
          </section>

          <section className="sn-card p-4">
            <p className="text-sm font-extrabold uppercase tracking-wide text-[var(--sn-coral)]">
              Read this — then answer out loud
            </p>
            <h2 className="mt-2 text-lg font-extrabold leading-7 text-[var(--sn-ink)]">
              {currentQuestionText}
            </h2>

            <div className="mt-4 flex items-center gap-4 rounded-lg border border-[var(--sn-line)] bg-[var(--sn-soft)] p-3">
              <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
                <svg
                  width={ringSize}
                  height={ringSize}
                  viewBox={`0 0 ${ringSize} ${ringSize}`}
                  className="-rotate-90"
                >
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={ringRadius}
                    fill="none"
                    stroke="var(--sn-line)"
                    strokeWidth="6"
                  />
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={ringRadius}
                    fill="none"
                    stroke="var(--sn-coral)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={ringOffset}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-[var(--sn-ink)]">
                  {readCountdown}
                </span>
              </div>
              <div>
                <p className="text-sm font-extrabold text-[var(--sn-ink)]">
                  Recording starts in {readCountdown}s
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-[var(--sn-muted)]">
                  Take a breath and look at the camera. Ready early? Tap Start
                  answering now.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 border-t border-[var(--sn-line)] bg-white p-4">
          <Button
            type="button"
            className="sn-button-coral h-12 w-full text-base font-extrabold"
            onClick={beginAnswering}
            disabled={loading}
          >
            <Mic className="h-4 w-4" />
            Start answering now
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
              Screening prompt
            </p>
            <h1 className="mt-1 text-lg font-extrabold text-[var(--sn-ink)]">
              {postingTitle}
            </h1>
          </div>
          <span className="sn-chip sn-chip-coral">1 minute</span>
        </div>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        <section className="relative mx-auto aspect-[9/16] max-h-[62vh] w-full max-w-sm overflow-hidden rounded-lg bg-[#111827]">
          <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-[var(--sn-danger)] px-3 py-1 text-xs font-extrabold text-white shadow-sm">
            <span className="h-2 w-2 rounded-full bg-white" />
            Recording
          </div>
          <div className="absolute right-3 top-3 z-10 rounded-full bg-black/55 px-3 py-1 text-xs font-extrabold text-white backdrop-blur">
            {formatTimer(recordingElapsed)}
          </div>
          <video
            ref={videoRef}
            className={`h-full w-full object-cover ${
              cameraFacing === "user" ? "scale-x-[-1]" : ""
            }`}
            autoPlay
            muted
            playsInline
          />
        </section>

        <section className="sn-card p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-extrabold uppercase tracking-wide text-[var(--sn-coral)]">
              {questionIndex + 1} / {questions.length}
            </p>
            {questionMode === "spoken" && (
              <button
                type="button"
                onClick={() => setReasonOpen((value) => !value)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--sn-blue-700)]"
                title="Can't use video? Type this answer instead."
              >
                <Pencil className="h-3.5 w-3.5" />
                Type instead
              </button>
            )}
          </div>
          <h2 className="mt-2 text-lg font-extrabold leading-7 text-[var(--sn-ink)]">
            {currentQuestionText}
          </h2>

          {reasonOpen && questionMode === "spoken" && (
            <div className="mt-3 rounded-lg border border-[var(--sn-line)] bg-white p-3">
              <p className="text-xs font-bold text-[var(--sn-ink)]">
                Why do you need to type this answer?
              </p>
              <div className="mt-2 grid gap-2">
                {(Object.keys(TYPED_REASON_LABELS) as TypedReason[]).map(
                  (reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => switchToTyped(reason)}
                      className="rounded-md border border-[var(--sn-line)] px-3 py-2 text-left text-sm hover:bg-black/5"
                    >
                      {TYPED_REASON_LABELS[reason]}
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => setReasonOpen(false)}
                className="mt-2 text-xs text-[var(--sn-muted)]"
              >
                Cancel
              </button>
            </div>
          )}

          {questionMode === "spoken" ? (
            <p className="mt-2 text-xs font-bold text-[var(--sn-muted)]">
              Answer out loud and look at the camera. You have up to 5 minutes
              per question — we&apos;ll move you on automatically at 5:00.
            </p>
          ) : (
            <>
              <p className="mt-2 text-xs font-bold text-[var(--sn-coral-600)]">
                Typed answer ({TYPED_REASON_LABELS[typedReason]}) — recording is
                off for this question.{" "}
                <button
                  type="button"
                  onClick={switchToSpoken}
                  className="font-extrabold text-[var(--sn-blue-700)] underline"
                >
                  Use video instead
                </button>
              </p>
              <textarea
                value={currentAnswer}
                autoFocus
                onChange={(event) => setCurrentAnswer(event.target.value)}
                onPaste={(event) => {
                  event.preventDefault();
                  toast.error(
                    "Pasting is disabled — please answer in your own words."
                  );
                }}
                onDrop={(event) => event.preventDefault()}
                className="sn-input mt-3 min-h-36 w-full px-3 py-2 text-sm"
                placeholder="Type your answer in your own words."
              />
            </>
          )}
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
            {loading ? "Saving recording" : "Submit recorded screening"}
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
