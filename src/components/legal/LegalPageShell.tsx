import Link from "next/link";
import { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function LegalPageShell({
  eyebrow,
  title,
  description,
  children,
}: LegalPageShellProps) {
  return (
    <main className="sn-page">
      <section className="sn-container py-8 lg:py-12">
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

        <article className="sn-card overflow-hidden">
          <header className="border-b border-[var(--sn-line)] bg-white px-5 py-6 sm:px-8 lg:px-10">
            <div className="sn-eyebrow flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--sn-coral)]" />
              {eyebrow}
            </div>
            <h1 className="mt-3 max-w-4xl text-3xl font-extrabold text-[var(--sn-ink)] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--sn-muted)]">
              {description}
            </p>
            <p className="mt-4 max-w-3xl rounded-lg border border-[var(--sn-warning)]/30 bg-[var(--sn-warning-50)] px-4 py-3 text-sm leading-6 text-[var(--sn-ink-2)]">
              This page is a transparency notice for candidates and applicants.
              It is not a standalone employment contract or individualized legal
              advice.
            </p>
          </header>

          <div className="legal-content px-5 py-6 sm:px-8 lg:px-10">
            {children}
          </div>
        </article>
      </section>
    </main>
  );
}
