import Link from "next/link";
import { BriefcaseBusiness, ShieldCheck, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-[#ded7cc] bg-[#fdfaf4]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-3 select-none">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#176c5d] text-white">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base font-semibold text-[#15191e]">
                  StaffingNation Spark
                </p>
                <p className="text-xs font-medium uppercase tracking-normal text-[#86633d]">
                  Candidate review module
                </p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#59616b]">
              Published StaffingNation roles, Spark candidate profiles,
              recruiter review, and short AI interview workflows.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#59616b]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#176c5d]" />
              <span>Candidate data stays in Spark until a future handoff is approved.</span>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-[#15191e]">
              Spark
            </h3>
            <ul className="space-y-2 text-sm text-[#59616b]">
              <li>
                <Link href="/jobs" className="transition hover:text-[#15191e]">
                  Open jobs
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition hover:text-[#15191e]">
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/companies"
                  className="transition hover:text-[#15191e]"
                >
                  Recruiter workspace
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-[#15191e]">
              Build focus
            </h3>
            <ul className="space-y-2 text-sm text-[#59616b]">
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#d6a85d]" />
                Public job postings
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#d6a85d]" />
                Mobile interview links
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#d6a85d]" />
                Recruiter-ready AI summaries
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-[#ded7cc] pt-6 text-xs text-[#6e7680] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} StaffingNation. All rights reserved.</p>
          <p>Powered by Spark.</p>
        </div>
      </div>
    </footer>
  );
}
