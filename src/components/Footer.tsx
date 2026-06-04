import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import { SparkLogo } from "@/components/spark/SparkBrand";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--sn-line)] bg-[#131c29] text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <SparkLogo inverse />
            <p className="max-w-md text-sm leading-6 text-white/60">
              Published StaffingNation roles, Spark candidate profiles,
              recruiter review, and short AI interview workflows.
            </p>
            <div className="flex items-center gap-2 text-xs text-white/55">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--sn-blue-400)]" />
              <span>Candidate data stays in Spark until a future handoff is approved.</span>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-extrabold uppercase tracking-normal text-white">
              Spark
            </h3>
            <ul className="space-y-2 text-sm text-white/65">
              <li>
                <Link href="/jobs" className="transition hover:text-white">
                  Open jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/spark/recruiter"
                  className="transition hover:text-white"
                >
                  Recruiter review
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs"
                  className="transition hover:text-white"
                >
                  Publish-ready feed
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-extrabold uppercase tracking-normal text-white">
              Build focus
            </h3>
            <ul className="space-y-2 text-sm text-white/65">
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--sn-coral)]" />
                Public job postings
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--sn-coral)]" />
                Mobile interview links
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--sn-coral)]" />
                Recruiter-ready AI summaries
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} StaffingNation. All rights reserved.</p>
          <p>Powered by Spark.</p>
        </div>
      </div>
    </footer>
  );
}
