"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
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

type InterviewPhase = "ready" | "active" | "completed";
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
      width: { ideal: 720 },
      height: { ideal: 1280 },
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

  const [phase, setPhase] = useState<InterviewPhase>(
    initialStatus === "completed" || initialStatus === "InterviewCompleted"
      ? "completed"
      : "ready"
  );
  const [loading, setLoading] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("user");
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [backgroundUpload, setBackgroundUpload] = useState({
    uploadedChunks: 0,
    pendingChunks: 0,
    failedChunks: 0,
  });
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
  const currentQuestionText = currentQuestion?.text || "";

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
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
      videoBitsPerSecond: 550_000,
      audioBitsPerSecond: 64_000,
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
      const stream = streamRef.current || (await requestMediaStream(cameraFacing));
      startRecording(stream);
      const startedAt = Date.now();
      startedAtRef.current = startedAt;
      setRecordingElapsed(0);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setRecordingElapsed(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      }, 1000);

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
      if (timerRef.current) window.clearInterval(timerRef.current);
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
    const upload = await uploadRecordingBlob(capture.blob, contentType);

    return {
      captured: true,
      durationSeconds: capture.durationSeconds,
      mimeType: contentType,
      sizeBytes: capture.sizeBytes,
      uploadStrategy: "final_recording_with_background_chunks",
      storage: {
        bucket: upload.bucket,
        path: upload.path,
        uploadedAt: new Date().toISOString(),
      },
      chunks: chunkUploadsRef.current,
      chunkUploadSummary: {
        uploadedChunks: chunkUploadsRef.current.length,
        failedChunks: failedChunkUploadsRef.current,
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
      question: currentQuestionText,
      answer,
      questionId: currentQuestion?.id,
      source: currentQuestion?.source,
      sourceLabel: currentQuestion?.sourceLabel,
      type: currentQuestion?.type,
      targetSeconds: currentQuestion?.targetSeconds || 60,
      generatorLabel: currentQuestion?.generatorLabel,
      mcpRunId: currentQuestion?.mcpRunId,
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
      if (timerRef.current) window.clearInterval(timerRef.current);
      await waitForBackgroundUploads();
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
          <div className="absolute bottom-3 left-3 right-3 z-10 rounded-lg bg-black/55 px-3 py-2 text-[11px] font-bold text-white backdrop-blur">
            {backgroundUpload.pendingChunks > 0
              ? `Saving backup clip${backgroundUpload.pendingChunks > 1 ? "s" : ""}`
              : backgroundUpload.uploadedChunks > 0
                ? `${backgroundUpload.uploadedChunks} backup clip${
                    backgroundUpload.uploadedChunks > 1 ? "s" : ""
                  } saved`
                : "Recording locally"}
            {backgroundUpload.failedChunks > 0 &&
              `, ${backgroundUpload.failedChunks} backup clip${
                backgroundUpload.failedChunks > 1 ? "s" : ""
              } failed`}
          </div>
        </section>

        <section className="sn-card p-4">
          <p className="text-xs font-extrabold uppercase text-[var(--sn-blue-700)]">
            You have 1 minute to answer. Please look at the camera.
          </p>
          <h2 className="mt-2 text-lg font-extrabold leading-7 text-[var(--sn-ink)]">
            The question is: {currentQuestionText}
          </h2>
          <textarea
            value={currentAnswer}
            onChange={(event) => setCurrentAnswer(event.target.value)}
            className="sn-input mt-4 min-h-36 w-full px-3 py-2 text-sm"
            placeholder="Answer in your own words. Your typed answer is saved with the recorded screening."
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
