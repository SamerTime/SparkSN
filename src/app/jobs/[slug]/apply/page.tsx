import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { SparkApplyForm } from "@/components/spark/SparkApplyForm";

export const dynamic = "force-dynamic";

function money(min: unknown, max: unknown, currency = "USD") {
  const minimum = min == null ? null : Number(min);
  const maximum = max == null ? null : Number(max);
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  if (minimum && maximum) {
    return `${formatter.format(minimum)} - ${formatter.format(maximum)}`;
  }
  if (minimum) return `${formatter.format(minimum)}+`;
  if (maximum) return `Up to ${formatter.format(maximum)}`;
  return "Pay listed in job details";
}

export default async function SparkApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await prisma.sparkJobPosting.findUnique({
    where: { slug },
    select: {
      title: true,
      slug: true,
      clientName: true,
      overview: true,
      payRangeMin: true,
      payRangeMax: true,
      currency: true,
      country: true,
      status: true,
    },
  });

  if (!job || job.status !== "Published") {
    notFound();
  }

  const country =
    typeof job.country === "object" &&
    job.country !== null &&
    !Array.isArray(job.country) &&
    "name" in job.country
      ? String((job.country as { name?: unknown }).name || "")
      : "";

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#1b1f24]">
      <section className="border-b border-[#ded7cc] bg-[#fdfaf4]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Button
            asChild
            variant="ghost"
            className="mb-5 px-0 text-[#5e6670] hover:bg-transparent"
          >
            <Link href={`/jobs/${job.slug}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to job details
            </Link>
          </Button>

          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#86633d]">
                <span>{job.clientName || "Spark client"}</span>
                {country && (
                  <>
                    <span className="text-[#c8bda9]">/</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {country}
                    </span>
                  </>
                )}
              </div>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-normal text-[#15191e] sm:text-5xl">
                Apply for {job.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#59616b]">
                {job.overview ||
                  "Create a Spark profile so a recruiter can review your fit for this role."}
              </p>
              <div className="mt-5 inline-flex rounded-md bg-[#edf5f1] px-3 py-1.5 text-sm font-medium text-[#176c5d]">
                {money(job.payRangeMin, job.payRangeMax, job.currency)}
              </div>
            </div>

            <aside className="rounded-md border border-[#d8d1c6] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">What happens next</h2>
              <div className="mt-4 grid gap-3 text-sm text-[#59616b]">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#176c5d]" />
                  Spark stores your profile separately from StaffingNation.
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-[#176c5d]" />
                  A recruiter reviews and approves the next step.
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#176c5d]" />
                  If invited, you receive a short mobile interview link.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <SparkApplyForm postingSlug={job.slug} postingTitle={job.title} />

        <aside className="rounded-md border border-[#d8d1c6] bg-[#22312f] p-6 text-white shadow-sm">
          <h2 className="text-xl font-semibold">Phone-ready intake</h2>
          <p className="mt-3 text-sm leading-6 text-[#d7e1dd]">
            This page is built for the same phone flow that will later handle
            camera, microphone, interview consent, and short AI questions.
          </p>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="rounded-md bg-white/10 p-3">
              Profile and application record
            </div>
            <div className="rounded-md bg-white/10 p-3">
              Consent timestamps
            </div>
            <div className="rounded-md bg-white/10 p-3">
              Location and device signals
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
