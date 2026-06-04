import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  LocateFixed,
  MapPin,
  Mic,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getPublishedJobBySlug } from "@/lib/spark-db";
import { Button } from "@/components/ui/button";
import { SparkApplyForm } from "@/components/spark/SparkApplyForm";

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

export default async function SparkApplyPage({
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
  const payLabel = money(job.payRangeMin, job.payRangeMax, job.currency);

  return (
    <main className="sn-page">
      <section className="sn-container py-6 lg:py-8">
        <Button
          asChild
          variant="ghost"
          className="mb-5 px-0 text-[var(--sn-muted)] hover:bg-transparent hover:text-[var(--sn-blue-700)]"
        >
          <Link href={`/jobs/${job.slug}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to job details
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[430px_1fr] lg:items-start">
          <div className="mx-auto w-full max-w-[402px] lg:mx-0">
            <div className="spark-phone">
              <div className="spark-phone-screen overflow-y-auto">
                <SparkApplyForm
                  postingSlug={job.slug}
                  postingTitle={job.title}
                  clientName={job.clientName}
                  locationLabel={country || undefined}
                  payLabel={payLabel}
                />
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="sn-eyebrow flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--sn-coral)]" />
              Mobile Spark intake
            </div>
            <h1 className="mt-3 max-w-3xl text-4xl font-extrabold text-[var(--sn-ink)] sm:text-5xl">
              Apply for {job.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--sn-muted)]">
              {job.overview ||
                "Create a Spark profile so a recruiter can review your fit for this role."}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {job.clientName && <span className="sn-chip sn-chip-blue">{job.clientName}</span>}
              <span className="sn-chip sn-chip-success">{payLabel}</span>
              {country && (
                <span className="sn-chip">
                  <MapPin className="h-3.5 w-3.5 text-[var(--sn-blue)]" />
                  {country}
                </span>
              )}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <section className="sn-card p-5">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-[var(--sn-ink)]">
                  <CheckCircle2 className="h-5 w-5 text-[var(--sn-success)]" />
                  What happens next
                </h2>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-[var(--sn-ink-2)]">
                  <p>Spark creates a separate candidate profile and application.</p>
                  <p>A recruiter reviews the candidate before the video screen.</p>
                  <p>Approved candidates receive a phone-ready interview link.</p>
                </div>
              </section>

              <section className="sn-card p-5">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-[var(--sn-ink)]">
                  <ShieldCheck className="h-5 w-5 text-[var(--sn-blue)]" />
                  Fraud signals
                </h2>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-[var(--sn-ink-2)]">
                  <p>Location consent is captured before browser location review.</p>
                  <p>Device and browser details are stored with the application.</p>
                  <p>Recruiters can review signals before interview invitations.</p>
                </div>
              </section>
            </div>

            <section className="sn-card mt-5 bg-[#131c29] p-5 text-white">
              <h2 className="text-lg font-extrabold">
                Future video screen readiness
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white/10 p-3 text-sm">
                  <Camera className="mb-2 h-5 w-5 text-[var(--sn-coral)]" />
                  Camera permission
                </div>
                <div className="rounded-lg bg-white/10 p-3 text-sm">
                  <Mic className="mb-2 h-5 w-5 text-[var(--sn-blue-400)]" />
                  Microphone permission
                </div>
                <div className="rounded-lg bg-white/10 p-3 text-sm">
                  <LocateFixed className="mb-2 h-5 w-5 text-[var(--sn-success)]" />
                  Location review
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
