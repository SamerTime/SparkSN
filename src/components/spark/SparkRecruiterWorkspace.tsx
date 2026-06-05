"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  MoreVertical,
  PanelRightOpen,
  Phone,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SparkInitials } from "@/components/spark/SparkBrand";
import { SparkRecruiterActions } from "@/components/spark/SparkRecruiterActions";
import type {
  SparkApplicationWithRelations,
  SparkPublishedJobListItem,
} from "@/lib/spark-db";

type CommunicationEvent = {
  type?: string;
  label?: string;
  at?: string;
  channel?: string;
  messagePreview?: string;
};

type InterviewAnswer = {
  question: string;
  answer: string;
};

type RecordingView = {
  bucket: string;
  path: string;
  mimeType: string;
  durationSeconds: number | null;
  sizeBytes: number | null;
  signedUrl: string;
};

export type SparkRecruiterApplicationView = SparkApplicationWithRelations & {
  recordingView: RecordingView | null;
};

type SparkRecruiterWorkspaceProps = {
  applications: SparkRecruiterApplicationView[];
  jobs: SparkPublishedJobListItem[];
  initialApplicationId?: string | null;
};

type WorkflowStatusOption = {
  label: string;
  status?: string;
  action?: string;
  tone: "default" | "primary" | "success" | "warning" | "danger";
};

const WORKFLOW_STATUS_OPTIONS: WorkflowStatusOption[] = [
  {
    label: "In Process",
    status: "InProcess",
    tone: "primary",
  },
  {
    label: "Complete",
    status: "Complete",
    tone: "success",
  },
  {
    label: "Reviewing",
    status: "Reviewing",
    tone: "warning",
  },
  {
    label: "Shortlist",
    status: "Shortlisted",
    tone: "success",
  },
  {
    label: "Reject",
    status: "Declined",
    tone: "danger",
  },
  {
    label: "Offer",
    status: "Offer",
    tone: "success",
  },
];

type JobOrderView = {
  id: string;
  title: string;
  slug: string;
  clientName: string | null;
  lastSyncedAt: string | null;
  applicantCount: number;
  needsReviewCount: number;
  completedCount: number;
};

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function communicationEvents(value: unknown): CommunicationEvent[] {
  const state = jsonObject(value);
  return Array.isArray(state.events)
    ? (state.events as CommunicationEvent[]).slice(-4).reverse()
    : [];
}

function interviewAnswers(value: unknown): InterviewAnswer[] {
  const transcript = jsonObject(value);
  if (!Array.isArray(transcript.answers)) return [];

  return transcript.answers
    .map((item) => jsonObject(item))
    .map((item) => ({
      question: typeof item.question === "string" ? item.question.trim() : "",
      answer: typeof item.answer === "string" ? item.answer.trim() : "",
    }))
    .filter((item) => item.question && item.answer);
}

function locationSummary(value: unknown) {
  const signals = jsonObject(value);
  const browserLocation = jsonObject(signals.browserGeolocation);
  const providedLocation = jsonObject(signals.candidateProvidedLocation);
  const capture = jsonObject(signals.capture);
  const captureStatus =
    typeof capture.status === "string" ? capture.status : "";

  if (typeof browserLocation.latitude === "number") {
    return {
      label: "Browser location captured",
      needsReview: false,
    };
  }

  if (captureStatus === "denied") {
    return {
      label: "Candidate consented; browser location permission was denied",
      needsReview: true,
    };
  }

  if (captureStatus === "unsupported") {
    return {
      label: "Browser does not support location capture",
      needsReview: true,
    };
  }

  if (captureStatus === "error") {
    return {
      label: "Browser location capture failed",
      needsReview: true,
    };
  }

  const city = typeof providedLocation.city === "string" ? providedLocation.city : "";
  const state = typeof providedLocation.state === "string" ? providedLocation.state : "";
  const place = [city, state].filter(Boolean).join(", ");
  return place
    ? {
        label: `Candidate entered ${place}; browser location not captured`,
        needsReview: true,
      }
    : {
        label: "Location needs review",
        needsReview: true,
      };
}

function statusClass(status: string) {
  if (status === "Applied") {
    return "border-[var(--sn-blue-200)] bg-[var(--sn-blue-50)] text-[var(--sn-blue-700)]";
  }
  if (status === "Invited" || status === "InterviewInvited") {
    return "border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)] text-[var(--sn-coral-600)]";
  }
  if (status === "InProcess" || status === "InterviewStarted") {
    return "border-[var(--sn-blue-200)] bg-[var(--sn-blue-50)] text-[var(--sn-blue-700)]";
  }
  if (
    status === "Complete" ||
    status === "InterviewCompleted" ||
    status === "RecruiterApproved" ||
    status === "Shortlisted" ||
    status === "Vetted" ||
    status === "Offer"
  ) {
    return "border-[var(--sn-success)] bg-[var(--sn-success-50)] text-[var(--sn-success)]";
  }
  if (status === "Declined") {
    return "border-[var(--sn-danger)] bg-[var(--sn-danger-50)] text-[var(--sn-danger)]";
  }
  if (status === "Reviewing" || status === "RecruiterReview") {
    return "border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)] text-[var(--sn-coral-600)]";
  }
  return "border-[var(--sn-line)] bg-white text-[var(--sn-ink-2)]";
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    ProfileStarted: "Profile Started",
    RecruiterApproved: "Approved",
    InterviewInvited: "Interview Invited",
    InProcess: "In Process",
    InterviewStarted: "In Process",
    Complete: "Complete",
    InterviewCompleted: "Complete",
    RecruiterReview: "Reviewing",
    Reviewing: "Reviewing",
    Vetted: "Shortlist",
    Shortlisted: "Shortlist",
    Declined: "Reject",
    Offer: "Offer",
  };

  if (labels[status]) return labels[status];
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatEventDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return formatDate(value);
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (!minutes) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function summaryPreview(value: unknown) {
  const summary = jsonObject(value);
  const text =
    typeof summary.summary === "string"
      ? summary.summary
      : typeof summary.recruiterSummary === "string"
        ? summary.recruiterSummary
        : "";

  return text || "AI interview summary will appear after the video screen is complete.";
}

function candidateName(application: SparkRecruiterApplicationView) {
  return (
    application.candidateName ||
    [
      application.candidate?.firstName,
      application.candidate?.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Unnamed candidate"
  );
}

function candidateLocation(application: SparkRecruiterApplicationView) {
  return [application.candidate?.city, application.candidate?.state]
    .filter(Boolean)
    .join(", ");
}

function interviewLabel(application: SparkRecruiterApplicationView) {
  if (application.status === "Complete" || application.status === "InterviewCompleted") return "Complete";
  if (application.status === "InProcess" || application.status === "InterviewStarted") return "In process";
  if (application.status === "InterviewInvited") return "Interview invited";
  if (application.status === "Invited") return "Invited to apply";
  if (application.status === "Reviewing" || application.status === "RecruiterReview") return "Reviewing";
  if (application.status === "Shortlisted" || application.status === "Vetted") return "Shortlist";
  if (application.status === "Offer") return "Offer";
  if (application.status === "RecruiterApproved") return "Approved";
  if (application.status === "Declined") return "Declined";
  return "Needs review";
}

function buildJobOrders(
  jobs: SparkPublishedJobListItem[],
  applications: SparkRecruiterApplicationView[]
) {
  const jobMap = new Map<string, JobOrderView>();

  jobs.forEach((job) => {
    jobMap.set(job.id, {
      id: job.id,
      title: job.title,
      slug: job.slug,
      clientName: job.clientName,
      lastSyncedAt: job.lastSyncedAt,
      applicantCount: 0,
      needsReviewCount: 0,
      completedCount: 0,
    });
  });

  applications.forEach((application) => {
    if (!jobMap.has(application.postingId)) {
      jobMap.set(application.postingId, {
        id: application.postingId,
        title: application.posting.title,
        slug: application.posting.slug,
        clientName: application.posting.clientName,
        lastSyncedAt: null,
        applicantCount: 0,
        needsReviewCount: 0,
        completedCount: 0,
      });
    }

    const job = jobMap.get(application.postingId);
    if (!job) return;
    job.applicantCount += 1;
    if (application.status === "Applied" || application.status === "Reviewing" || application.status === "RecruiterReview") {
      job.needsReviewCount += 1;
    }
    if (application.status === "Complete" || application.status === "InterviewCompleted") {
      job.completedCount += 1;
    }
  });

  return [...jobMap.values()].sort((first, second) => {
    if (second.applicantCount !== first.applicantCount) {
      return second.applicantCount - first.applicantCount;
    }
    return first.title.localeCompare(second.title);
  });
}

export function SparkRecruiterWorkspace({
  applications,
  jobs,
  initialApplicationId,
}: SparkRecruiterWorkspaceProps) {
  const router = useRouter();
  const jobOrders = useMemo(
    () => buildJobOrders(jobs, applications),
    [applications, jobs]
  );
  const initialApplication = applications.find(
    (application) => application.id === initialApplicationId
  );
  const [selectedPostingId, setSelectedPostingId] = useState(
    initialApplication?.postingId || jobOrders[0]?.id || ""
  );
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(
    initialApplication?.id || null
  );
  const [openMenuApplicationId, setOpenMenuApplicationId] = useState<string | null>(
    null
  );
  const [loadingWorkflowId, setLoadingWorkflowId] = useState<string | null>(null);
  const [jobInviteOpen, setJobInviteOpen] = useState(false);
  const [jobInviteEmail, setJobInviteEmail] = useState("");
  const [jobInviteSending, setJobInviteSending] = useState(false);

  useEffect(() => {
    if (!selectedPostingId && jobOrders[0]) {
      setSelectedPostingId(jobOrders[0].id);
    }
  }, [jobOrders, selectedPostingId]);

  useEffect(() => {
    setJobInviteOpen(false);
    setJobInviteEmail("");
  }, [selectedPostingId]);

  const selectedJob =
    jobOrders.find((job) => job.id === selectedPostingId) || jobOrders[0];
  const selectedApplications = applications.filter(
    (application) => application.postingId === selectedJob?.id
  );
  const activeApplication =
    applications.find((application) => application.id === activeApplicationId) ||
    null;

  const openApplication = (applicationId: string) => {
    setActiveApplicationId(applicationId);
    const url = new URL(window.location.href);
    url.searchParams.set("application", applicationId);
    window.history.replaceState(null, "", url.toString());
  };

  const closeApplication = () => {
    setActiveApplicationId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("application");
    window.history.replaceState(null, "", url.toString());
  };

  const runWorkflowAction = async (
    application: SparkRecruiterApplicationView,
    option: WorkflowStatusOption
  ) => {
    const workflowId = `${application.id}:${option.status || option.action}`;
    setLoadingWorkflowId(workflowId);

    try {
      const response = await fetch(`/api/spark/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: option.action || "set_status",
          status: option.status,
          recruiterNotes: application.recruiterNotes || "",
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to update candidate status.");
      }

      toast.success(`${option.label} recorded.`);
      setOpenMenuApplicationId(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update candidate status."
      );
    } finally {
      setLoadingWorkflowId(null);
    }
  };

  const sendJobApplyInvite = async () => {
    if (!selectedJob) return;

    const email = jobInviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }

    setJobInviteSending(true);

    try {
      const response = await fetch(
        `/api/spark/job-postings/${selectedJob.id}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to send the job invitation.");
      }

      toast.success(`Invitation sent to ${email}.`);
      setJobInviteEmail("");
      setJobInviteOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send the job invitation."
      );
    } finally {
      setJobInviteSending(false);
    }
  };

  if (!jobOrders.length) {
    return (
      <div className="sn-card border-dashed p-8 text-center">
        <h2 className="text-xl font-extrabold text-[var(--sn-ink)]">
          No Spark applications yet
        </h2>
        <p className="mt-2 text-sm text-[var(--sn-muted)]">
          Submit the public apply form for a published job to see candidates
          here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="sn-card overflow-hidden self-start lg:sticky lg:top-4">
          <div className="border-b border-[var(--sn-line)] p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--sn-ink)]">
              <BriefcaseBusiness className="h-4 w-4 text-[var(--sn-blue)]" />
              Job orders
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--sn-muted)]">
              Select a job order to review its Spark candidates.
            </p>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {jobOrders.map((job) => {
              const selected = job.id === selectedJob?.id;

              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedPostingId(job.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selected
                      ? "border-[var(--sn-blue-200)] bg-[var(--sn-blue-50)]"
                      : "border-transparent bg-white hover:border-[var(--sn-line)] hover:bg-[var(--sn-soft)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-extrabold leading-5 text-[var(--sn-ink)]">
                        {job.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--sn-muted)]">
                        {job.clientName || "Spark client"}
                      </p>
                    </div>
                    <span className="sn-chip py-1 text-xs">
                      {job.applicantCount}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {job.needsReviewCount > 0 && (
                      <span className="sn-chip sn-chip-coral py-1 text-[11px]">
                        {job.needsReviewCount} review
                      </span>
                    )}
                    {job.completedCount > 0 && (
                      <span className="sn-chip sn-chip-success py-1 text-[11px]">
                        {job.completedCount} complete
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="sn-card overflow-hidden">
            <div className="border-b border-[var(--sn-line)] bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="sn-eyebrow">Selected job order</p>
                  <h2 className="mt-2 text-2xl font-extrabold text-[var(--sn-ink)]">
                    {selectedJob?.title || "Job order"}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="sn-chip">
                      {selectedJob?.clientName || "Spark client"}
                    </span>
                    <span className="sn-chip">
                      {selectedApplications.length} candidates
                    </span>
                    {selectedJob?.lastSyncedAt && (
                      <span className="sn-chip">
                        Synced {formatDate(selectedJob.lastSyncedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="border-[var(--sn-line)]"
                      title="Invite by email"
                      onClick={() => setJobInviteOpen((open) => !open)}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    {selectedJob?.slug && (
                      <Button asChild variant="outline" className="border-[var(--sn-line)]">
                        <Link href={`/jobs/${selectedJob.slug}`}>
                          Public job
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                  {jobInviteOpen && (
                    <form
                      className="w-full rounded-lg border border-[var(--sn-line)] bg-[var(--sn-soft)] p-3 md:w-[360px]"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void sendJobApplyInvite();
                      }}
                    >
                      <label
                        htmlFor="spark-job-invite-email"
                        className="text-xs font-extrabold uppercase text-[var(--sn-muted)]"
                      >
                        Invite to apply
                      </label>
                      <div className="mt-2 flex gap-2">
                        <Input
                          id="spark-job-invite-email"
                          type="email"
                          value={jobInviteEmail}
                          onChange={(event) => setJobInviteEmail(event.target.value)}
                          placeholder="candidate@email.com"
                          className="bg-white"
                          disabled={jobInviteSending}
                        />
                        <Button
                          type="submit"
                          size="icon"
                          disabled={jobInviteSending}
                          title="Send invitation"
                        >
                          {jobInviteSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {selectedApplications.length === 0 ? (
              <div className="p-8 text-center">
                <UserRound className="mx-auto h-9 w-9 text-[var(--sn-muted)]" />
                <h3 className="mt-3 text-lg font-extrabold text-[var(--sn-ink)]">
                  No candidates yet
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--sn-muted)]">
                  Candidates will appear here when they apply from the public
                  Spark job page.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--sn-line)]">
                {selectedApplications.map((application) => {
                  const name = candidateName(application);
                  const location = locationSummary(application.locationSignals);
                  const profileLocation = candidateLocation(application);
                  const events = communicationEvents(application.communicationState);
                  const latestEvent = events[0];
                  const eventDate = formatEventDate(latestEvent?.at);

                  return (
                    <div
                      key={application.id}
                      className="relative bg-white transition hover:bg-[var(--sn-soft)]"
                    >
                      <button
                        type="button"
                        onClick={() => openApplication(application.id)}
                        className="block w-full p-4 pr-16 text-left"
                      >
                        <div className="grid gap-4 xl:grid-cols-[minmax(220px,1.2fr)_minmax(260px,1.5fr)_minmax(210px,0.9fr)]">
                        <div className="flex min-w-0 gap-3">
                          <SparkInitials label={name} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-extrabold text-[var(--sn-ink)]">
                                {name}
                              </h3>
                              <Badge className={`border ${statusClass(application.status)}`}>
                                {formatStatus(application.status)}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[var(--sn-muted)]">
                              {application.candidateEmail && (
                                <span className="inline-flex items-center gap-1">
                                  <Mail className="h-3.5 w-3.5" />
                                  {application.candidateEmail}
                                </span>
                              )}
                              {application.candidatePhone && (
                                <span className="inline-flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5" />
                                  {application.candidatePhone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-[var(--sn-line)] bg-white px-3 py-2">
                            <p className="text-[11px] font-extrabold uppercase text-[var(--sn-muted)]">
                              Applied
                            </p>
                            <p className="mt-1 text-sm font-bold text-[var(--sn-ink)]">
                              {formatDate(application.createdAt)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-[var(--sn-line)] bg-white px-3 py-2">
                            <p className="text-[11px] font-extrabold uppercase text-[var(--sn-muted)]">
                              Interview
                            </p>
                            <p className="mt-1 text-sm font-bold text-[var(--sn-ink)]">
                              {interviewLabel(application)}
                            </p>
                          </div>
                          <div
                            className={`rounded-lg border px-3 py-2 sm:col-span-2 ${
                              location.needsReview
                                ? "border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)]"
                                : "border-[#bde8ce] bg-[var(--sn-success-50)]"
                            }`}
                          >
                            <p className="text-[11px] font-extrabold uppercase text-[var(--sn-muted)]">
                              Location
                            </p>
                            <p
                              className={`mt-1 line-clamp-1 text-sm font-bold ${
                                location.needsReview
                                  ? "text-[var(--sn-coral-600)]"
                                  : "text-[var(--sn-success)]"
                              }`}
                            >
                              {profileLocation || location.label}
                            </p>
                          </div>
                        </div>

                        <div className="flex min-w-0 flex-col justify-between gap-3">
                          <p className="line-clamp-3 text-sm leading-6 text-[var(--sn-muted)]">
                            {summaryPreview(application.aiSummary)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {application.recordingView && (
                              <span className="sn-chip sn-chip-blue py-1 text-xs">
                                <Video className="h-3.5 w-3.5" />
                                Recording
                              </span>
                            )}
                            {latestEvent && (
                              <span className="sn-chip py-1 text-xs">
                                {latestEvent.label || latestEvent.type || "Event"}
                                {eventDate ? ` ${eventDate}` : ""}
                              </span>
                            )}
                            <span className="ml-auto inline-flex items-center gap-1 text-xs font-extrabold text-[var(--sn-blue-700)]">
                              Details
                              <PanelRightOpen className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                      </button>
                      <WorkflowStatusMenu
                        application={application}
                        isOpen={openMenuApplicationId === application.id}
                        loadingWorkflowId={loadingWorkflowId}
                        onToggle={() =>
                          setOpenMenuApplicationId((current) =>
                            current === application.id ? null : application.id
                          )
                        }
                        onClose={() => setOpenMenuApplicationId(null)}
                        onRun={(option) => runWorkflowAction(application, option)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {activeApplication && (
        <CandidateDetailDrawer
          application={activeApplication}
          onClose={closeApplication}
        />
      )}
    </>
  );
}

function workflowOptionActive(status: string, option: WorkflowStatusOption) {
  if (option.status === "InProcess") {
    return status === "InProcess" || status === "InterviewStarted";
  }

  if (option.status === "Complete") {
    return status === "Complete" || status === "InterviewCompleted";
  }

  if (option.status === "Reviewing") {
    return status === "Reviewing" || status === "RecruiterReview";
  }

  if (option.status === "Shortlisted") {
    return status === "Shortlisted" || status === "Vetted";
  }

  return status === option.status;
}

function workflowToneClass(option: WorkflowStatusOption, active: boolean) {
  if (active) {
    if (option.tone === "danger") {
      return "bg-[var(--sn-danger-50)] text-[var(--sn-danger)]";
    }
    if (option.tone === "success") {
      return "bg-[var(--sn-success-50)] text-[var(--sn-success)]";
    }
    if (option.tone === "warning") {
      return "bg-[var(--sn-coral-50)] text-[var(--sn-coral-600)]";
    }
    return "bg-[var(--sn-blue-50)] text-[var(--sn-blue-700)]";
  }

  if (option.tone === "danger") {
    return "text-[var(--sn-danger)] hover:bg-[var(--sn-danger-50)]";
  }

  return "text-[var(--sn-ink)] hover:bg-[var(--sn-soft)]";
}

function WorkflowStatusMenu({
  application,
  isOpen,
  loadingWorkflowId,
  onToggle,
  onClose,
  onRun,
}: {
  application: SparkRecruiterApplicationView;
  isOpen: boolean;
  loadingWorkflowId: string | null;
  onToggle: () => void;
  onClose: () => void;
  onRun: (option: WorkflowStatusOption) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    const positionMenu = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const menuWidth = 192;
      const menuHeight = WORKFLOW_STATUS_OPTIONS.length * 40 + 8;
      const left = Math.min(
        Math.max(margin, rect.right - menuWidth),
        window.innerWidth - menuWidth - margin
      );
      const opensDown =
        rect.bottom + gap + menuHeight <= window.innerHeight - margin;
      const top = opensDown
        ? rect.bottom + gap
        : Math.max(margin, rect.top - menuHeight - gap);

      setMenuPosition({ left, top });
    };

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);

    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const menu =
    isOpen && menuPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="z-[80] max-h-[min(70vh,320px)] w-48 overflow-y-auto rounded-lg border border-[var(--sn-line)] bg-white p-1 shadow-xl"
            style={{
              left: menuPosition.left,
              position: "fixed",
              top: menuPosition.top,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {WORKFLOW_STATUS_OPTIONS.map((option) => {
              const active = workflowOptionActive(application.status, option);
              const workflowId = `${application.id}:${option.status || option.action}`;
              const loading = loadingWorkflowId === workflowId;

              return (
                <button
                  key={option.label}
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-bold ${workflowToneClass(
                    option,
                    active
                  )}`}
                  disabled={Boolean(loadingWorkflowId) || active}
                  onClick={() => {
                    if (!active) onRun(option);
                  }}
                >
                  <span>{option.label}</span>
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : active ? (
                    <span className="h-2 w-2 rounded-full bg-current" />
                  ) : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="absolute right-4 top-4 z-20">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 border-[var(--sn-line)] bg-white"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        title="Candidate status menu"
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {menu}
    </div>
  );
}

function CandidateDetailDrawer({
  application,
  onClose,
}: {
  application: SparkRecruiterApplicationView;
  onClose: () => void;
}) {
  const name = candidateName(application);
  const location = locationSummary(application.locationSignals);
  const events = communicationEvents(application.communicationState);
  const answers = interviewAnswers(application.interviewTranscript);
  const recordingView = application.recordingView;
  const profileLocation = candidateLocation(application);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close candidate details"
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${name} candidate details`}
        className="absolute right-0 top-0 flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:w-[min(92vw,920px)]"
      >
        <header className="border-b border-[var(--sn-line)] bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <SparkInitials label={name} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-extrabold text-[var(--sn-ink)]">
                    {name}
                  </h2>
                  <Badge className={`border ${statusClass(application.status)}`}>
                    {formatStatus(application.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--sn-muted)]">
                  {application.posting.title}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {application.candidateEmail && (
                    <span className="sn-chip">
                      <Mail className="h-3.5 w-3.5" />
                      {application.candidateEmail}
                    </span>
                  )}
                  {application.candidatePhone && (
                    <span className="sn-chip">
                      <Phone className="h-3.5 w-3.5" />
                      {application.candidatePhone}
                    </span>
                  )}
                  <span className="sn-chip">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Applied {formatDate(application.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 border-[var(--sn-line)]"
              onClick={onClose}
              title="Close candidate details"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--sn-soft)] p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--sn-ink)]">
                  <Sparkles className="h-4 w-4 text-[var(--sn-coral)]" />
                  AI summary
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--sn-muted)]">
                  {summaryPreview(application.aiSummary)}
                </p>
              </section>

              <section
                className={
                  location.needsReview
                    ? "rounded-lg border border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)] p-4"
                    : "rounded-lg border border-[#bde8ce] bg-[var(--sn-success-50)] p-4"
                }
              >
                <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--sn-ink)]">
                  {location.needsReview ? (
                    <ShieldAlert className="h-4 w-4 text-[var(--sn-coral-600)]" />
                  ) : (
                    <MapPin className="h-4 w-4 text-[var(--sn-success)]" />
                  )}
                  Location and identity signal
                </div>
                <p
                  className={
                    location.needsReview
                      ? "mt-3 text-sm font-bold leading-6 text-[var(--sn-coral-600)]"
                      : "mt-3 text-sm font-bold leading-6 text-[var(--sn-success)]"
                  }
                >
                  {profileLocation ? `${profileLocation}. ${location.label}` : location.label}
                </p>
              </section>

              {recordingView && (
                <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--sn-ink)]">
                      <Video className="h-4 w-4 text-[var(--sn-blue)]" />
                      Interview recording
                    </div>
                    <span className="sn-chip py-1 text-xs">
                      {[formatDuration(recordingView.durationSeconds), formatBytes(recordingView.sizeBytes)]
                        .filter(Boolean)
                        .join(" / ") || "Video captured"}
                    </span>
                  </div>
                  <video
                    controls
                    preload="metadata"
                    src={recordingView.signedUrl}
                    className="mt-3 aspect-video w-full rounded-lg bg-black"
                  />
                </section>
              )}

              <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--sn-ink)]">
                    <ClipboardList className="h-4 w-4 text-[var(--sn-blue)]" />
                    Interview answers
                  </div>
                  <span className="sn-chip py-1 text-xs">
                    {answers.length} {answers.length === 1 ? "answer" : "answers"}
                  </span>
                </div>

                {answers.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--sn-muted)]">
                    Answers will appear after the candidate completes the
                    recorded screening.
                  </p>
                ) : (
                  <ol className="mt-3 divide-y divide-[var(--sn-line)]">
                    {answers.map((item, index) => (
                      <li
                        key={`${item.question}-${index}`}
                        className="py-3 first:pt-0 last:pb-0"
                      >
                        <p className="text-sm font-extrabold leading-6 text-[var(--sn-ink)]">
                          {index + 1}. {item.question}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--sn-muted)]">
                          {item.answer}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--sn-ink)]">
                    <MessageSquareText className="h-4 w-4 text-[var(--sn-blue)]" />
                    Communication log
                  </div>
                  <span className="sn-chip py-1 text-xs">
                    {events.length} {events.length === 1 ? "event" : "events"}
                  </span>
                </div>

                {events.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--sn-muted)]">
                    No communication events recorded yet.
                  </p>
                ) : (
                  <ol className="mt-3 divide-y divide-[var(--sn-line)]">
                    {events.map((event, index) => {
                      const eventDate = formatEventDate(event.at);

                      return (
                        <li
                          key={`${event.type}-${event.at}-${index}`}
                          className="grid gap-1 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[var(--sn-ink)]">
                              {event.label || event.type || "Event"}
                            </span>
                            {event.channel && (
                              <span className="sn-chip py-1 text-xs">
                                {event.channel}
                              </span>
                            )}
                            {eventDate && (
                              <span className="text-xs text-[var(--sn-muted)]">
                                {eventDate}
                              </span>
                            )}
                          </div>
                          {event.messagePreview && (
                            <p className="text-sm leading-6 text-[var(--sn-muted)]">
                              {event.messagePreview}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
                <h3 className="text-base font-extrabold text-[var(--sn-ink)]">
                  Recruiter actions
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--sn-muted)]">
                  Save notes, update status, and prepare the next candidate
                  communication.
                </p>
                <div className="mt-4">
                  <SparkRecruiterActions
                    applicationId={application.id}
                    initialNotes={application.recruiterNotes || ""}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
                <h3 className="text-base font-extrabold text-[var(--sn-ink)]">
                  Candidate snapshot
                </h3>
                <dl className="mt-3 grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-extrabold uppercase text-[var(--sn-muted)]">
                      Status
                    </dt>
                    <dd className="mt-1 font-bold text-[var(--sn-ink)]">
                      {formatStatus(application.status)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-extrabold uppercase text-[var(--sn-muted)]">
                      Applied
                    </dt>
                    <dd className="mt-1 font-bold text-[var(--sn-ink)]">
                      {formatDate(application.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-extrabold uppercase text-[var(--sn-muted)]">
                      Last updated
                    </dt>
                    <dd className="mt-1 font-bold text-[var(--sn-ink)]">
                      {formatDate(application.updatedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-extrabold uppercase text-[var(--sn-muted)]">
                      Interview
                    </dt>
                    <dd className="mt-1 font-bold text-[var(--sn-ink)]">
                      {interviewLabel(application)}
                    </dd>
                  </div>
                  {profileLocation && (
                    <div>
                      <dt className="text-xs font-extrabold uppercase text-[var(--sn-muted)]">
                        Profile location
                      </dt>
                      <dd className="mt-1 font-bold text-[var(--sn-ink)]">
                        {profileLocation}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            </aside>
          </div>
        </div>
      </aside>
    </div>
  );
}
