import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, MapPin, Mic, ShieldCheck } from "lucide-react";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";

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
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  if (minimum && maximum) return `${formatter.format(minimum)} - ${formatter.format(maximum)}`;
  if (minimum) return `${formatter.format(minimum)}+`;
  if (maximum) return `Up to ${formatter.format(maximum)}`;
  return "Pay listed in job details";
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await prisma.sparkJobPosting.findUnique({
    where: { slug },
  });

  if (!job || job.status !== "Published") {
    notFound();
  }

  const country =
    typeof job.country === "object" && job.country !== null && !Array.isArray(job.country) && "name" in job.country
      ? String((job.country as { name?: unknown }).name || "")
      : "";
  const responsibilities = splitText(job.responsibilities);
  const requirements = splitText(job.requirements);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#1b1f24]">
      <section className="border-b border-[#ded7cc] bg-[#fdfaf4]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" className="mb-5 px-0 text-[#5e6670] hover:bg-transparent">
            <Link href="/jobs">
              <ArrowLeft className="h-4 w-4" />
              Back to jobs
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
                {job.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#59616b]">
                {job.overview || "Review the job details and begin the Spark apply path."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-md bg-[#edf5f1] px-3 py-1.5 text-sm font-medium text-[#176c5d]">
                  {money(job.payRangeMin, job.payRangeMax, job.currency)}
                </span>
                {job.skills.map((skill) => (
                  <span key={skill} className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-[#5f5040] ring-1 ring-[#d8d1c6]">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <aside className="rounded-md border border-[#d8d1c6] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Spark apply path</h2>
              <div className="mt-4 grid gap-3 text-sm text-[#59616b]">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#176c5d]" />
                  Create candidate profile
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-[#176c5d]" />
                  Recruiter review and approval
                </div>
                <div className="flex gap-3">
                  <Camera className="mt-0.5 h-4 w-4 text-[#176c5d]" />
                  Short mobile video interview
                </div>
                <div className="flex gap-3">
                  <Mic className="mt-0.5 h-4 w-4 text-[#176c5d]" />
                  AI summary for recruiter review
                </div>
              </div>
              <Button className="mt-6 w-full bg-[#20282d] text-white hover:bg-[#344047]">
                Start application
              </Button>
              <p className="mt-3 text-xs leading-5 text-[#6e7680]">
                Candidate profile, consent, camera/microphone check, and fraud signal capture are the next build slice.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="grid gap-6">
          <section className="rounded-md border border-[#d8d1c6] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Responsibilities</h2>
            {responsibilities.length > 0 ? (
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-[#4f5963]">
                {responsibilities.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d6a85d]" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#59616b]">Responsibilities will appear here when included in the StaffingNation job description.</p>
            )}
          </section>

          <section className="rounded-md border border-[#d8d1c6] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Requirements</h2>
            {requirements.length > 0 ? (
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-[#4f5963]">
                {requirements.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#176c5d]" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#59616b]">Requirements will appear here when included in the StaffingNation job description.</p>
            )}
          </section>
        </div>

        <aside className="rounded-md border border-[#d8d1c6] bg-[#22312f] p-6 text-white shadow-sm">
          <h2 className="text-xl font-semibold">Interview preview</h2>
          <p className="mt-3 text-sm leading-6 text-[#d7e1dd]">
            Spark will generate intelligent job-specific questions from this posting and keep the interview short enough for a phone.
          </p>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="rounded-md bg-white/10 p-3">Target length: 2-3 minutes</div>
            <div className="rounded-md bg-white/10 p-3">Question target: about 10</div>
            <div className="rounded-md bg-white/10 p-3">Summary: job-related and bias-aware</div>
          </div>
        </aside>
      </section>
    </main>
  );
}
