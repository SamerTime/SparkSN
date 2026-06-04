import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MailCheck,
  MapPin,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  UserRoundCheck,
  Video,
} from "lucide-react";
import {
  countPublishedJobs,
  listApplicationStatuses,
  listRecruiterApplications,
} from "@/lib/spark-db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SparkInitials } from "@/components/spark/SparkBrand";
import { SparkRecruiterActions } from "@/components/spark/SparkRecruiterActions";

export const dynamic = "force-dynamic";

type CommunicationEvent = {
  type?: string;
  label?: string;
  at?: string;
  channel?: string;
  messagePreview?: string;
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

function locationSummary(value: unknown) {
  const signals = jsonObject(value);
  const browserLocation = jsonObject(signals.browserGeolocation);
  const providedLocation = jsonObject(signals.candidateProvidedLocation);

  if (typeof browserLocation.latitude === "number") {
    return "Browser location captured";
  }

  const city = typeof providedLocation.city === "string" ? providedLocation.city : "";
  const state = typeof providedLocation.state === "string" ? providedLocation.state : "";
  const place = [city, state].filter(Boolean).join(", ");
  return place ? `Candidate entered ${place}` : "Location needs review";
}

function statusClass(status: string) {
  if (status === "Applied") {
    return "border-[var(--sn-blue-200)] bg-[var(--sn-blue-50)] text-[var(--sn-blue-700)]";
  }
  if (status === "RecruiterApproved") {
    return "border-[var(--sn-success)] bg-[var(--sn-success-50)] text-[var(--sn-success)]";
  }
  if (status === "InterviewInvited") {
    return "border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)] text-[var(--sn-coral-600)]";
  }
  if (status === "Declined") {
    return "border-[var(--sn-danger)] bg-[var(--sn-danger-50)] text-[var(--sn-danger)]";
  }
  if (status === "Vetted") {
    return "border-[var(--sn-success)] bg-[var(--sn-success-50)] text-[var(--sn-success)]";
  }
  return "border-[var(--sn-line)] bg-white text-[var(--sn-ink-2)]";
}

function formatStatus(status: string) {
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

function summaryPreview(value: unknown) {
  const summary = jsonObject(value);
  const text =
    typeof summary.summary === "string"
      ? summary.summary
      : typeof summary.recruiterSummary === "string"
        ? summary.recruiterSummary
        : "";

  return text || "AI interview summary will appear here after the video screen is complete.";
}

export default async function SparkRecruiterPage() {
  const [applications, statusRows, postingCount] = await Promise.all([
    listRecruiterApplications(),
    listApplicationStatuses(),
    countPublishedJobs(),
  ]);

  const totalApplications = statusRows.length;
  const waitingReview =
    statusRows.filter((item) => item.status === "Applied").length;
  const interviewInvites =
    statusRows.filter((item) => item.status === "InterviewInvited").length;
  const vetted = statusRows.filter((item) => item.status === "Vetted").length;

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
            <Button asChild className="sn-button-primary gap-2">
              <Link href="/jobs">
                View public jobs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
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
                Vetted
              </div>
              <p className="mt-2 text-2xl font-extrabold text-[var(--sn-ink)]">
                {vetted}
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
        {applications.length === 0 ? (
          <div className="sn-card border-dashed p-8 text-center">
            <h2 className="text-xl font-extrabold text-[var(--sn-ink)]">
              No Spark applications yet
            </h2>
            <p className="mt-2 text-sm text-[var(--sn-muted)]">
              Submit the public apply form for a published job to see candidates
              here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {applications.map((application) => {
              const events = communicationEvents(application.communicationState);
              const location = locationSummary(application.locationSignals);
              const needsLocationReview = location === "Location needs review";
              const candidateName =
                application.candidateName ||
                [
                  application.candidate?.firstName,
                  application.candidate?.lastName,
                ]
                  .filter(Boolean)
                  .join(" ") ||
                "Unnamed candidate";

              return (
                <article
                  key={application.id}
                  className="sn-card overflow-hidden"
                >
                  <div className="border-b border-[var(--sn-line)] bg-white p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <SparkInitials label={candidateName} />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-2xl font-extrabold text-[var(--sn-ink)]">
                          {candidateName}
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm">
                          {application.candidateEmail && (
                            <span className="sn-chip">{application.candidateEmail}</span>
                          )}
                          {application.candidatePhone && (
                            <span className="sn-chip">{application.candidatePhone}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Badge className={`border ${statusClass(application.status)}`}>
                          {formatStatus(application.status)}
                        </Badge>
                        <span className="text-xs text-[var(--sn-muted)]">
                          Updated {formatDate(application.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 bg-[var(--sn-soft)] p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="min-w-0">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
                          <div className="text-xs font-extrabold uppercase text-[var(--sn-muted)]">
                            Role
                          </div>
                          <div className="mt-2 text-sm font-extrabold text-[var(--sn-ink)]">
                            {application.posting.title}
                          </div>
                          <div className="mt-1 text-sm text-[var(--sn-muted)]">
                            {application.posting.clientName || "Spark client"}
                          </div>
                          <Link
                            href={`/jobs/${application.posting.slug}`}
                            className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--sn-blue-700)] hover:text-[var(--sn-blue)]"
                          >
                            View public posting
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </section>

                        <section className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
                          <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[var(--sn-muted)]">
                            <Sparkles className="h-4 w-4 text-[var(--sn-coral)]" />
                            AI summary
                          </div>
                          <p className="mt-2 line-clamp-5 text-sm leading-6 text-[var(--sn-muted)]">
                            {summaryPreview(application.aiSummary)}
                          </p>
                        </section>

                        <section
                          className={
                            needsLocationReview
                              ? "rounded-lg border border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)] p-4"
                              : "rounded-lg border border-[#bde8ce] bg-[var(--sn-success-50)] p-4"
                          }
                        >
                          <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[var(--sn-muted)]">
                            {needsLocationReview ? (
                              <ShieldAlert className="h-4 w-4 text-[var(--sn-coral-600)]" />
                            ) : (
                              <MapPin className="h-4 w-4 text-[var(--sn-success)]" />
                            )}
                            Location signal
                          </div>
                          <p
                            className={
                              needsLocationReview
                                ? "mt-2 text-sm font-bold leading-6 text-[var(--sn-coral-600)]"
                                : "mt-2 text-sm font-bold leading-6 text-[var(--sn-success)]"
                            }
                          >
                            {location}
                          </p>
                          {needsLocationReview && (
                            <p className="mt-2 text-xs leading-5 text-[var(--sn-coral-600)]">
                              Review before sending an interview link.
                            </p>
                          )}
                        </section>
                      </div>

                      <section className="mt-4 rounded-lg border border-[var(--sn-line)] bg-white p-4">
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

                    <aside className="rounded-lg border border-[var(--sn-line)] bg-white p-4">
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
                    </aside>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
