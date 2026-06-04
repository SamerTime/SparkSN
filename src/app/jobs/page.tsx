import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  DollarSign,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { listPublishedJobs } from "@/lib/spark-db";
import { Button } from "@/components/ui/button";
import { SparkInitials } from "@/components/spark/SparkBrand";

export const dynamic = "force-dynamic";

function money(min: unknown, max: unknown, currency = "USD") {
  const minimum = min == null ? null : Number(min);
  const maximum = max == null ? null : Number(max);
  const hasMin = minimum !== null && Number.isFinite(minimum);
  const hasMax = maximum !== null && Number.isFinite(maximum);
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  if (hasMin && hasMax) return `${formatter.format(minimum)} - ${formatter.format(maximum)}`;
  if (hasMin) return `${formatter.format(minimum)}+`;
  if (hasMax) return `Up to ${formatter.format(maximum)}`;
  return "Pay in job details";
}

function countryName(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "name" in value
  ) {
    return String((value as { name?: unknown }).name || "");
  }

  return "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function JobsPage() {
  const jobs = await listPublishedJobs();

  return (
    <main className="sn-page">
      <section className="border-b border-[var(--sn-line)] bg-white/90 backdrop-blur">
        <div className="sn-container grid gap-6 py-8 lg:grid-cols-[1fr_360px] lg:py-10">
          <div className="flex min-h-[240px] flex-col justify-center">
            <div className="sn-eyebrow flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--sn-coral)]" />
              StaffingNation Spark
            </div>
            <h1 className="mt-3 max-w-3xl text-4xl font-extrabold text-[var(--sn-ink)] sm:text-5xl">
              Open roles ready for Spark review
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--sn-muted)]">
              Published job orders flow from StaffingNation into Spark so
              candidates can review the role, apply, and move into recruiter-led
              screening without mixing candidate data back into the source system.
            </p>

            <div className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
              <div className="sn-card p-4">
                <div className="flex items-center gap-2 text-sm text-[var(--sn-muted)]">
                  <BriefcaseBusiness className="h-4 w-4 text-[var(--sn-blue)]" />
                  Published
                </div>
                <p className="mt-2 text-2xl font-extrabold text-[var(--sn-ink)]">
                  {jobs.length}
                </p>
              </div>
              <div className="sn-card p-4">
                <div className="flex items-center gap-2 text-sm text-[var(--sn-muted)]">
                  <UsersRound className="h-4 w-4 text-[var(--sn-coral)]" />
                  Candidate flow
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--sn-ink)]">
                  Profile, consent, review
                </p>
              </div>
              <div className="sn-card p-4">
                <div className="flex items-center gap-2 text-sm text-[var(--sn-muted)]">
                  <ShieldCheck className="h-4 w-4 text-[var(--sn-success)]" />
                  Data boundary
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--sn-ink)]">
                  Spark-owned intake
                </p>
              </div>
            </div>
          </div>

          <aside className="sn-card overflow-hidden bg-[#131c29] p-5 text-white">
            <div className="flex h-full min-h-[260px] flex-col justify-between">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--sn-coral)] text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-2xl font-extrabold">
                  Phone-ready candidate entry
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  The apply path is shaped for a mobile link: profile first,
                  permission checks, location consent, then recruiter approval
                  before the short video interview.
                </p>
              </div>
              <div className="mt-6 grid gap-2 text-sm">
                <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--sn-success)]" />
                  Public page at the job level
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--sn-blue-400)]" />
                  Recruiter queue stays in Spark
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="sn-container py-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-[var(--sn-ink)]">
              Published jobs
            </h2>
            <p className="mt-1 text-sm text-[var(--sn-muted)]">
              These are the roles available through the Spark public intake.
            </p>
          </div>
          <div className="flex min-h-11 items-center gap-3 rounded-lg border border-[var(--sn-line)] bg-white px-3 text-sm text-[var(--sn-muted)] shadow-sm">
            <Search className="h-4 w-4 text-[var(--sn-blue)]" />
            Showing {jobs.length} {jobs.length === 1 ? "role" : "roles"}
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="sn-card border-dashed p-8 text-center">
            <h2 className="text-xl font-extrabold text-[var(--sn-ink)]">
              No jobs published yet
            </h2>
            <p className="mt-2 text-sm text-[var(--sn-muted)]">
              Publish a job order from StaffingNation to see it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => {
              const country = countryName(job.country);
              return (
                <article
                  key={job.id}
                  className="sn-card sn-card-hover grid gap-4 p-4 sm:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto]"
                >
                  <SparkInitials label={job.clientName || job.title} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="sn-chip sn-chip-blue">
                        {job.clientName || "Spark client"}
                      </span>
                      {country && (
                        <span className="sn-chip">
                          <MapPin className="h-3.5 w-3.5 text-[var(--sn-blue)]" />
                          {country}
                        </span>
                      )}
                      <span className="sn-chip">
                        <CalendarClock className="h-3.5 w-3.5 text-[var(--sn-coral)]" />
                        Synced {formatDate(job.lastSyncedAt)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-2xl font-extrabold text-[var(--sn-ink)]">
                      {job.title}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sn-muted)]">
                      {job.overview || "Review the job details and begin the Spark apply path."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="sn-chip sn-chip-success">
                        <DollarSign className="h-3.5 w-3.5" />
                        {money(job.payRangeMin, job.payRangeMax, job.currency)}
                      </span>
                      {job.skills.slice(0, 4).map((skill) => (
                        <span key={skill} className="sn-chip">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center sm:col-start-2 lg:col-start-auto lg:justify-end">
                    <Button asChild className="sn-button-primary w-full gap-2 sm:w-auto">
                      <Link href={`/jobs/${job.slug}`}>
                        View role
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
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
