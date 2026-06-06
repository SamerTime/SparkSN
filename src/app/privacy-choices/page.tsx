import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Your Privacy Choices | StaffingNation Spark",
  description:
    "Privacy rights, sale/share choices, sensitive information choices, deletion requests, and manual review requests for Spark candidates.",
};

export default function PrivacyChoicesPage() {
  return (
    <LegalPageShell
      eyebrow="Your Privacy Choices"
      title="Your Privacy Choices / Do Not Sell or Share My Info"
      description="Use this page to understand and exercise privacy choices for Spark candidate data."
    >
      <section>
        <h2>Sale and sharing</h2>
        <p>
          Spark is designed for candidate intake and recruiter review. Spark
          does not sell candidate personal information. Spark also should not
          share candidate personal information for cross-context behavioral
          advertising.
        </p>
      </section>

      <section>
        <h2>Available privacy requests</h2>
        <p>
          Depending on your location and applicable law, you may be able to
          request access, correction, deletion, a copy of your data, restriction
          of processing, limitation of sensitive personal information, objection
          to processing or profiling, or review of an automated-processing
          concern.
        </p>
        <p>
          To submit a request, email{" "}
          <a href="mailto:compliance@tcwglobal.com">
            compliance@tcwglobal.com
          </a>{" "}
          with the subject line <strong>Spark Privacy Request</strong>. Include
          the job title or Spark application email address so the team can
          locate the correct record.
        </p>
      </section>

      <section>
        <h2>Manual review</h2>
        <p>
          Candidates may choose manual recruiter review instead of the standard
          AI-assisted workflow. If you are on a Spark apply page, select the
          manual review pathway before submitting. You can also read the{" "}
          <Link href="/manual-review">manual review pathway</Link> page.
        </p>
      </section>

      <section>
        <h2>International privacy rights</h2>
        <p>
          Where GDPR, UK GDPR, Canadian, US state, or other privacy laws apply,
          Spark should honor applicable rights and provide a practical way to
          exercise them. Some rights may depend on residency, location, identity
          verification, legal basis, recordkeeping duties, and recruitment
          obligations.
        </p>
      </section>
    </LegalPageShell>
  );
}
