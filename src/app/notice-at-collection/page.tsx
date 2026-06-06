import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Notice at Collection | StaffingNation Spark",
  description:
    "Spark candidate notice describing data categories, purposes, retention, and privacy choices before application submission.",
};

const rows = [
  [
    "Identifiers",
    "Candidate form fields",
    "Create the application profile, contact the candidate, and support recruiter review.",
  ],
  [
    "Contact details",
    "Candidate form fields",
    "Communicate about the selected role and recruiter workflow.",
  ],
  [
    "Application content",
    "Candidate form fields, uploaded or recorded materials",
    "Evaluate job-related qualifications and experience.",
  ],
  [
    "Audio data",
    "Device microphone, if the candidate proceeds to interview",
    "Record spoken answers and generate transcripts for recruiter review.",
  ],
  [
    "Video likeness",
    "Device camera, if the candidate proceeds to interview",
    "Record interview answers and support integrity review.",
  ],
  [
    "Precise geolocation",
    "Browser geolocation prompt, if candidate consents",
    "Support regional compliance, fraud review, and job-specific location checks.",
  ],
  [
    "Device and browser metadata",
    "Browser request headers and runtime signals",
    "Security, fraud review, troubleshooting, and workflow integrity.",
  ],
  [
    "Application history",
    "Spark database records",
    "Track application status, communications, recruiter actions, and duplicate submissions.",
  ],
  [
    "AI-assisted outputs",
    "Secure workflow processing",
    "Generate recruiter support summaries, routing notes, and job-related review aids.",
  ],
];

export default function NoticeAtCollectionPage() {
  return (
    <LegalPageShell
      eyebrow="Candidate Notice at Collection"
      title="Notice at Collection and Screening Pathway Choices"
      description="Review the categories of information Spark collects before you submit an application or choose a screening pathway."
    >
      <section>
        <h2>Before Spark collects application data</h2>
        <p>
          Spark provides this notice before application submission so candidates
          can understand what is collected, why it is collected, how it is used,
          and how to exercise privacy choices. Spark does not sell candidate
          personal information.
        </p>
      </section>

      <section>
        <h2>Categories and purposes</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--sn-line)]">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--sn-sunken)] text-[var(--sn-ink)]">
              <tr>
                <th className="border-b border-[var(--sn-line)] px-4 py-3">
                  Category
                </th>
                <th className="border-b border-[var(--sn-line)] px-4 py-3">
                  Collection method
                </th>
                <th className="border-b border-[var(--sn-line)] px-4 py-3">
                  Purpose
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([category, method, purpose]) => (
                <tr key={category} className="align-top">
                  <td className="border-b border-[var(--sn-line)] px-4 py-3 font-bold text-[var(--sn-ink)]">
                    {category}
                  </td>
                  <td className="border-b border-[var(--sn-line)] px-4 py-3 text-[var(--sn-ink-2)]">
                    {method}
                  </td>
                  <td className="border-b border-[var(--sn-line)] px-4 py-3 text-[var(--sn-muted)]">
                    {purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Your screening pathway choices</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-[var(--sn-blue-200)] bg-[var(--sn-blue-50)] p-4">
            <h3>Standard AI-assisted workflow</h3>
            <p>
              You choose Spark&apos;s standard workflow. Spark may use AI-assisted
              tools and permission-based camera, microphone, location, device,
              and browser signals to support recruiter review, fraud prevention,
              and job-related compliance checks. Human reviewers make final
              hiring decisions.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)] p-4">
            <h3>Manual recruiter review</h3>
            <p>
              You request manual recruiter review instead of the standard
              AI-assisted workflow. A recruiter may review your application
              through a human-led process and may contact you for written
              questions, a phone screen, or another reasonable assessment.
            </p>
          </div>
        </div>
        <p>
          You can also review{" "}
          <Link href="/privacy-choices">privacy choices</Link> or the{" "}
          <Link href="/terms">California AI Disclosure & Terms</Link>.
        </p>
      </section>
    </LegalPageShell>
  );
}
