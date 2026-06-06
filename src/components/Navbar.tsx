"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { SparkLogo } from "@/components/spark/SparkBrand";

export default function Navbar() {
  const pathname = usePathname();
  // Recruiter pages render their own consolidated header (SparkRecruiterNav).
  if (pathname?.startsWith("/spark/recruiter")) {
    return null;
  }

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="sticky top-0 z-30 w-full border-b border-[var(--sn-line)] bg-white/95 font-sans shadow-sm backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <SparkLogo />

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-[var(--sn-ink-2)] hover:bg-[var(--sn-blue-50)] hover:text-[var(--sn-blue-700)] sm:inline-flex"
            >
              <Link href="/jobs">Open jobs</Link>
            </Button>

            <Button
              variant="default"
              asChild
              size="sm"
              className="sn-button-coral cursor-pointer gap-2"
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
