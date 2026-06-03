import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, MapPin, Search, ShieldCheck, Sparkles } from "lucide-react";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";

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

export default async function JobsPage() {
  const jobs = await prisma.sparkJobPosting.findMany({
    where: { status: "Published" },
    orderBy: { lastSyncedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      overview: true,
      clientName: true,
      skills: true,
      payRangeMin: true,
      payRangeMax: true,
      currency: true,
      country: true,
      lastSyncedAt: true,
    },
  });

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#1b1f24]">
      <section className="border-b border-[#ded7cc] bg-[#fdfaf4]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <div className="flex min-h-[280px] flex-col justify-center">
            <div className="mb-5 flex items-center gap-3 text-sm font-medium text-[#86633d]">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f2ef] text-[#176c5d]">
                <Sparkles className="h-4 w-4" />
              </span>
              Spark jobs
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-[#15191e] sm:text-5xl">
              Open roles ready for review
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#59616b]">
              StaffingNation-published job descriptions flow into Spark here, where candidates can review the role and start the apply path.
            </p>
            <div className="mt-6 flex max-w-xl items-center gap-3 rounded-md border border-[#d8d1c6] bg-white px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 text-[#8b7358]" />
              <span className="text-sm text-[#59616b]">
                Showing {jobs.length} published {jobs.length === 1 ? "role" : "roles"}
              </span>
            </div>
          </div>

          <div className="relative min-h-[260px] overflow-hidden rounded-md border border-[#d8d1c6] bg-[#22312f] p-5 text-white shadow-sm">
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,#ffffff_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#d6a85d] text-[#1b1f24]">
                  <BriefcaseBusiness className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold">Candidate-facing by design</h2>
                <p className="mt-3 text-sm leading-6 text-[#d7e1dd]">
                  The next layer adds profile creation, recruiter approval, mobile interview links, and AI summaries without moving candidate data into StaffingNation.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm text-[#f1d9ad]">
                <ShieldCheck className="h-4 w-4" />
                Separate Spark candidate data boundary
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {jobs.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#cfc6b8] bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">No jobs published yet</h2>
            <p className="mt-2 text-sm text-[#66707a]">
              Publish an active job description from StaffingNation to see it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => {
              const country = typeof job.country === "object" && job.country !== null && "name" in job.country
                ? String((job.country as { name?: unknown }).name || "")
                : "";
              return (
                <article
                  key={job.id}
                  className="grid gap-4 rounded-md border border-[#d8d1c6] bg-white p-5 shadow-sm transition hover:border-[#b99a70] sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-normal text-[#8a6b47]">
                      <span>{job.clientName || "Spark client"}</span>
                      {country && (
                        <>
                          <span className="text-[#c8bda9]">/</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {country}
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="text-2xl font-semibold text-[#161a1f]">{job.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#59616b]">
                      {job.overview || "Review the job details and begin the Spark apply path."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-md bg-[#edf5f1] px-2.5 py-1 text-xs font-medium text-[#176c5d]">
                        {money(job.payRangeMin, job.payRangeMax, job.currency)}
                      </span>
                      {job.skills.slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded-md bg-[#f3efe7] px-2.5 py-1 text-xs font-medium text-[#5f5040]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center sm:justify-end">
                    <Button asChild className="bg-[#20282d] text-white hover:bg-[#344047]">
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
