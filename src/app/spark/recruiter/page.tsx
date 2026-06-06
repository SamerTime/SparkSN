import { redirect } from "next/navigation";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MailCheck,
  UserRoundCheck,
  Video,
} from "lucide-react";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import {
  createInterviewRecordingSignedUrl,
  listApplicationStatuses,
  listLatestQuestionBanksByPostingIds,
  listPublishedJobs,
  listRecruiterApplications,
  SPARK_INTERVIEW_RECORDINGS_BUCKET,
} from "@/lib/spark-db";
import {
  SparkRecruiterWorkspace,
  type SparkRecruiterApplicationView,
} from "@/components/spark/SparkRecruiterWorkspace";

export const dynamic = "force-dynamic";

type RecordingReference = {
  bucket: string;
  path: string;
  mimeType: string;
  durationSeconds: number | null;
  sizeBytes: number | null;
};

type RecordingView = RecordingReference & {
  signedUrl: string;
};

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function recordingReference(value: unknown): RecordingReference | null {
  const media = jsonObject(value);
  const session = jsonObject(media.session);
  const recording = jsonObject(session.recording);
  const storage = jsonObject(recording.storage);
  const bucket = typeof storage.bucket === "string" ? storage.bucket : "";
  const path = typeof storage.path === "string" ? storage.path : "";

  if (bucket !== SPARK_INTERVIEW_RECORDINGS_BUCKET || !path) {
    return null;
  }

  return {
    bucket,
    path,
    mimeType:
      typeof recording.mimeType === "string" ? recording.mimeType : "video/webm",
    durationSeconds: numberValue(recording.durationSeconds),
    sizeBytes: numberValue(recording.sizeBytes),
  };
}

type SparkRecruiterPageProps = {
  searchParams?: Promise<{
    application?: string | string[];
  }>;
};

export default async function SparkRecruiterPage({
  searchParams,
}: SparkRecruiterPageProps) {
  const recruiterUser = await getSparkRecruiterUser();
  if (!recruiterUser) {
    redirect("/spark/login?returnTo=/spark/recruiter");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialApplicationId = Array.isArray(resolvedSearchParams.application)
    ? resolvedSearchParams.application[0]
    : resolvedSearchParams.application || null;

  const [applications, statusRows, publishedJobs] = await Promise.all([
    listRecruiterApplications(),
    listApplicationStatuses(),
    listPublishedJobs(),
  ]);
  const questionBanks = await listLatestQuestionBanksByPostingIds(
    publishedJobs.map((job) => job.id)
  );
  const recordingViewsById = new Map(
    await Promise.all(
      applications.map(async (application) => {
        const recording = recordingReference(application.interviewMedia);
        if (!recording) return [application.id, null] as const;

        try {
          const signedUrl = await createInterviewRecordingSignedUrl(
            recording.path
          );
          return [
            application.id,
            {
              ...recording,
              signedUrl,
            },
          ] as const;
        } catch (error) {
          console.error("Unable to create Spark recording playback URL:", error);
          return [application.id, null] as const;
        }
      })
    )
  );

  const totalApplications = statusRows.length;
  const waitingReview =
    statusRows.filter((item) => item.status === "Applied").length;
  const interviewInvites =
    statusRows.filter((item) => item.status === "InterviewInvited").length;
  const completedInterviews =
    statusRows.filter((item) => item.status === "InterviewCompleted").length;
  const postingCount = publishedJobs.length;
  const recruiterApplications: SparkRecruiterApplicationView[] =
    applications.map((application) => ({
      ...application,
      recordingView:
        (recordingViewsById.get(application.id) as RecordingView | null) ||
        null,
    }));

  return (
    <main className="sn-page">
      <section className="border-b border-[var(--sn-line)] bg-white/90 backdrop-blur">
        <div className="sn-container py-8 lg:py-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="sn-eyebrow flex items-center gap-2">
                <UserRoundCheck className="h-4 w-4 text-[var(--sn-coral)]" />
                Spark recruiter review
              </div>
              <h1 className="mt-3 text-4xl font-extrabold text-[var(--sn-ink)] sm:text-5xl">
                Candidate review queue
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--sn-muted)]">
                Review Spark applications, approve candidates, queue interview
                invites, and keep recruiter communication attached to the
                application record.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sn-card p-4">
              <div className="flex items-center gap-2 text-sm text-[var(--sn-muted)]">
                <MailCheck className="h-4 w-4 text-[var(--sn-blue)]" />
                Applications
              </div>
              <p className="mt-2 text-2xl font-extrabold text-[var(--sn-ink)]">
                {totalApplications}
              </p>
            </div>
            <div className="sn-card p-4">
              <div className="flex items-center gap-2 text-sm text-[var(--sn-muted)]">
                <Clock3 className="h-4 w-4 text-[var(--sn-coral)]" />
                Needs review
              </div>
              <p className="mt-2 text-2xl font-extrabold text-[var(--sn-ink)]">
                {waitingReview}
              </p>
            </div>
            <div className="sn-card p-4">
              <div className="flex items-center gap-2 text-sm text-[var(--sn-muted)]">
                <Video className="h-4 w-4 text-[var(--sn-blue)]" />
                Invites
              </div>
              <p className="mt-2 text-2xl font-extrabold text-[var(--sn-ink)]">
                {interviewInvites}
              </p>
            </div>
            <div className="sn-card p-4">
              <div className="flex items-center gap-2 text-sm text-[var(--sn-muted)]">
                <CheckCircle2 className="h-4 w-4 text-[var(--sn-success)]" />
                Completed
              </div>
              <p className="mt-2 text-2xl font-extrabold text-[var(--sn-ink)]">
                {completedInterviews}
              </p>
            </div>
            <div className="sn-card p-4">
              <div className="flex items-center gap-2 text-sm text-[var(--sn-muted)]">
                <BriefcaseBusiness className="h-4 w-4 text-[var(--sn-coral)]" />
                Jobs
              </div>
              <p className="mt-2 text-2xl font-extrabold text-[var(--sn-ink)]">
                {postingCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sn-container py-8">
        <SparkRecruiterWorkspace
          applications={recruiterApplications}
          jobs={publishedJobs}
          questionBanks={questionBanks}
          initialApplicationId={initialApplicationId}
        />
      </section>
    </main>
  );
}
