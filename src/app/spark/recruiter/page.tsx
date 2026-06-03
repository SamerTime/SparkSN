import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  MailCheck,
  MapPin,
  MessageSquareText,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  if (status === "Applied") return "bg-[#edf5f1] text-[#176c5d]";
  if (status === "RecruiterApproved") return "bg-[#e8f0fa] text-[#2f5f8a]";
  if (status === "InterviewInvited") return "bg-[#f8efd8] text-[#86633d]";
  if (status === "Declined") return "bg-[#f7ece8] text-[#8a3c2f]";
  if (status === "Vetted") return "bg-[#eef7e8] text-[#407020]";
  return "bg-[#f3efe7] text-[#5f5040]";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export default async function SparkRecruiterPage() {
  const [applications, groupedStatuses, postingCount] = await Promise.all([
    prisma.sparkApplication.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        posting: {
          select: {
            title: true,
            slug: true,
            clientName: true,
          },
        },
        candidate: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            city: true,
            state: true,
          },
        },
      },
    }),
    prisma.sparkApplication.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.sparkJobPosting.count({
      where: { status: "Published" },
    }),
  ]);

  const totalApplications = groupedStatuses.reduce(
    (sum, status) => sum + status._count._all,
    0
  );
  const waitingReview =
    groupedStatuses.find((item) => item.status === "Applied")?._count._all || 0;
  const interviewInvites =
    groupedStatuses.find((item) => item.status === "InterviewInvited")?._count
      ._all || 0;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#1b1f24]">
      <section className="border-b border-[#ded7cc] bg-[#fdfaf4]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-3 text-sm font-medium text-[#86633d]">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#edf5f1] text-[#176c5d]">
                  <UserRoundCheck className="h-4 w-4" />
                </span>
                Spark recruiter review
              </div>
              <h1 className="text-4xl font-semibold tracking-normal text-[#15191e] sm:text-5xl">
                Candidate review queue
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#59616b]">
                Review Spark applications, approve candidates, queue interview
                invites, and keep communication events attached to the
                application record.
              </p>
            </div>
            <Button asChild className="bg-[#20282d] text-white hover:bg-[#344047]">
              <Link href="/jobs">View public jobs</Link>
            </Button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-[#d8d1c6] bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-[#59616b]">
                <MailCheck className="h-4 w-4 text-[#176c5d]" />
                Applications
              </div>
              <p className="mt-2 text-2xl font-semibold">{totalApplications}</p>
            </div>
            <div className="rounded-md border border-[#d8d1c6] bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-[#59616b]">
                <Clock3 className="h-4 w-4 text-[#86633d]" />
                Needs review
              </div>
              <p className="mt-2 text-2xl font-semibold">{waitingReview}</p>
            </div>
            <div className="rounded-md border border-[#d8d1c6] bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-[#59616b]">
                <MessageSquareText className="h-4 w-4 text-[#2f5f8a]" />
                Interview invites
              </div>
              <p className="mt-2 text-2xl font-semibold">{interviewInvites}</p>
            </div>
            <div className="rounded-md border border-[#d8d1c6] bg-white p-4">
              <div className="flex items-center gap-2 text-sm text-[#59616b]">
                <CheckCircle2 className="h-4 w-4 text-[#176c5d]" />
                Published jobs
              </div>
              <p className="mt-2 text-2xl font-semibold">{postingCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {applications.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#cfc6b8] bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">No Spark applications yet</h2>
            <p className="mt-2 text-sm text-[#66707a]">
              Submit the public apply form for a published job to see candidates
              here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {applications.map((application) => {
              const events = communicationEvents(application.communicationState);
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
                  className="grid gap-5 rounded-md border border-[#d8d1c6] bg-white p-5 shadow-sm lg:grid-cols-[1fr_360px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={statusClass(application.status)}>
                        {application.status}
                      </Badge>
                      <span className="text-xs text-[#6e7680]">
                        Updated {formatDate(application.updatedAt)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-2xl font-semibold text-[#15191e]">
                      {candidateName}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#59616b]">
                      <span>{application.candidateEmail}</span>
                      {application.candidatePhone && (
                        <span>{application.candidatePhone}</span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {locationSummary(application.locationSignals)}
                      </span>
                    </div>

                    <div className="mt-4 rounded-md bg-[#f7f4ef] p-4">
                      <div className="text-sm font-medium text-[#15191e]">
                        {application.posting.title}
                      </div>
                      <div className="mt-1 text-sm text-[#59616b]">
                        {application.posting.clientName || "Spark client"}
                      </div>
                      <Link
                        href={`/jobs/${application.posting.slug}`}
                        className="mt-2 inline-flex text-sm font-medium text-[#176c5d] hover:text-[#14594d]"
                      >
                        View public posting
                      </Link>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#15191e]">
                        <MessageSquareText className="h-4 w-4 text-[#86633d]" />
                        Communication events
                      </div>
                      {events.length === 0 ? (
                        <p className="text-sm text-[#6e7680]">
                          No communication events recorded yet.
                        </p>
                      ) : (
                        <div className="grid gap-2">
                          {events.map((event, index) => (
                            <div
                              key={`${event.type}-${event.at}-${index}`}
                              className="rounded-md border border-[#ece4d8] bg-[#fdfaf4] p-3 text-sm"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-[#15191e]">
                                  {event.label || event.type || "Event"}
                                </span>
                                {event.channel && (
                                  <span className="rounded-md bg-white px-2 py-0.5 text-xs text-[#6e7680]">
                                    {event.channel}
                                  </span>
                                )}
                              </div>
                              {event.messagePreview && (
                                <p className="mt-1 text-[#59616b]">
                                  {event.messagePreview}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {locationSummary(application.locationSignals) ===
                      "Location needs review" && (
                      <div className="mt-4 flex items-center gap-2 rounded-md bg-[#f7ece8] p-3 text-sm text-[#8a3c2f]">
                        <ShieldAlert className="h-4 w-4" />
                        Location signal needs recruiter review before interview.
                      </div>
                    )}
                  </div>

                  <aside className="rounded-md border border-[#d8d1c6] bg-[#fdfaf4] p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-normal text-[#86633d]">
                      Recruiter actions
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#59616b]">
                      These actions update Spark status and queue communication
                      events. Courier delivery hooks can attach here next.
                    </p>
                    <div className="mt-4">
                      <SparkRecruiterActions
                        applicationId={application.id}
                        initialNotes={application.recruiterNotes || ""}
                      />
                    </div>
                  </aside>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
