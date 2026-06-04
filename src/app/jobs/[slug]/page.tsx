import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  MapPin,
  Mic,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getPublishedJobBySlug } from "@/lib/spark-db";
import { Button } from "@/components/ui/button";
import { SparkInitials } from "@/components/spark/SparkBrand";

export const dynamic = "force-dynamic";

function splitText(value: string | null) {
  if (!value) return [];
  return value
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

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

function DetailSection({
  title,
  items,
  fallback,
  accent = "var(--sn-blue)",
}: {
  title: string;
  items: string[];
  fallback: string;
  accent?: string;
}) {
  return (
    <section className="sn-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-extrabold text-[var(--sn-ink)]">
        <FileText className="h-5 w-5 text-[var(--sn-blue)]" />
        {title}
      </h2>
      {items.length > 0 ? (
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-[var(--sn-ink-2)]">
          {items.map((item) => (
            <li key={item} className="flex gap-3">
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: accent }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[var(--sn-muted)]">
          {fallback}
        </p>
      )}
    </section>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getPublishedJobBySlug(slug);

  if (!job) {
    notFound();
  }

  const country = countryName(job.country);
  const responsibilities = splitText(job.responsibilities);
  const requirements = splitText(job.requirements);
  const qualifications = splitText(job.qualifications);

  return (
    <main className="sn-page">
      <section className="border-b border-[var(--sn-line)] bg-white/90 backdrop-blur">
        <div className="sn-container py-6 lg:py-8">
          <Button
            asChild
            variant="ghost"
            className="mb-5 px-0 text-[var(--sn-muted)] hover:bg-transparent hover:text-[var(--sn-blue-700)]"
          >
            <Link href="/jobs">
              <ArrowLeft className="h-4 w-4" />
              Back to jobs
            </Link>
          </Button>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <SparkInitials label={job.clientName || job.title} size="lg" />
                <div>
                  <div className="sn-eyebrow">Published role</div>
                  <p className="mt-1 text-sm font-bold text-[var(--sn-ink-2)]">
                    {job.clientName || "Spark client"}
                  </p>
                </div>
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-extrabold text-[var(--sn-ink)] sm:text-5xl">
                {job.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--sn-muted)]">
                {job.overview || "Review the job details and begin the Spark apply path."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="sn-chip sn-chip-success">
                  <DollarSign className="h-3.5 w-3.5" />
                  {money(job.payRangeMin, job.payRangeMax, job.currency)}
                </span>
                {country && (
                  <span className="sn-chip sn-chip-blue">
                    <MapPin className="h-3.5 w-3.5" />
                    {country}
                  </span>
                )}
                {job.skills.slice(0, 5).map((skill) => (
                  <span key={skill} className="sn-chip">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <aside className="sn-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-[var(--sn-ink)]">
                  Spark apply path
                </h2>
                <span className="sn-chip sn-chip-coral">2-3 min screen</span>
              </div>
              <div className="mt-5 grid grid-cols-3 items-center gap-2">
                <span className="spark-stage-line is-done" />
                <span className="spark-stage-line is-current" />
                <span className="spark-stage-line" />
              </div>
              <div className="mt-5 grid gap-3 text-sm text-[var(--sn-ink-2)]">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--sn-success)]" />
                  Create a Spark profile for this role.
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--sn-blue)]" />
                  Recruiter reviews fit and consents.
                </div>
                <div className="flex gap-3">
                  <Camera className="mt-0.5 h-4 w-4 text-[var(--sn-coral)]" />
                  Approved candidates get a mobile video link.
                </div>
                <div className="flex gap-3">
                  <Mic className="mt-0.5 h-4 w-4 text-[var(--sn-blue)]" />
                  Spark will prepare a recruiter-ready AI summary.
                </div>
              </div>
              <Button asChild className="sn-button-coral mt-6 w-full gap-2">
                <Link href={`/jobs/${job.slug}/apply`}>
                  Start application
                  <Sparkles className="h-4 w-4" />
                </Link>
              </Button>
            </aside>
          </div>
        </div>
      </section>

      <section className="sn-container grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          <DetailSection
            title="Responsibilities"
            items={responsibilities}
            fallback="Responsibilities will appear here when included in the StaffingNation job order."
            accent="var(--sn-coral)"
          />
          <DetailSection
            title="Requirements"
            items={requirements}
            fallback="Requirements will appear here when included in the StaffingNation job order."
          />
          <DetailSection
            title="Qualifications"
            items={qualifications}
            fallback="Qualifications will appear here when included in the StaffingNation job order."
            accent="var(--sn-success)"
          />
        </div>

        <aside className="grid content-start gap-5">
          <section className="sn-card bg-[#131c29] p-5 text-white">
            <h2 className="flex items-center gap-2 text-xl font-extrabold">
              <Sparkles className="h-5 w-5 text-[var(--sn-coral)]" />
              Interview preview
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Once the recruiter approves the candidate, Spark will create
              intelligent job-specific prompts and keep the video screen short.
            </p>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="rounded-lg bg-white/10 p-3">
                Target length: 2-3 minutes
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                Question target: about 10
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                Summary: job-related and bias-aware
              </div>
            </div>
          </section>

          <section className="sn-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[var(--sn-ink)]">
              <Clock3 className="h-5 w-5 text-[var(--sn-blue)]" />
              Recruiter handoff
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--sn-muted)]">
              Candidate data remains in Spark for this build. A future handoff
              can send vetted candidates back into StaffingNation after approval.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}
