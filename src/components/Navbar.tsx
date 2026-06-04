"use client";

import Link from "next/link";
import { BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";

export default function Navbar() {
  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="sticky top-0 z-30 w-full border-b border-[#ded7cc] bg-[#fdfaf4]/95 font-sans shadow-sm backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/jobs"
            className="flex items-center gap-3 select-none transition hover:opacity-90"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#176c5d] text-white">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-normal text-[#15191e]">
                StaffingNation
              </span>
              <span className="block text-xs font-medium uppercase tracking-normal text-[#86633d]">
                Spark
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-[#4f5963] hover:bg-[#f0eadf] hover:text-[#15191e] sm:inline-flex"
            >
              <Link href="/jobs">Open jobs</Link>
            </Button>

            <Button
              variant="default"
              asChild
              size="sm"
              className="cursor-pointer gap-2 bg-[#20282d] text-white transition hover:bg-[#344047]"
            >
              <Link href="/spark/recruiter">
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Recruiter review</span>
                <span className="sm:hidden">Review</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
