import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Request Non-AI Alternative Pathway | StaffingNation Spark",
  description:
    "How candidates can request manual recruiter review instead of Spark's standard AI-assisted workflow.",
};

export default function ManualReviewPage() {
  return (
    <LegalPageShell
      eyebrow="Request Non-AI Alternative Pathway"
      title="Manual Recruiter Review Pathway"
      description="Candidates can request a human-led review pathway instead of the standard AI-assisted Spark workflow."
    >
      <section>
        <h2>What manual review means</h2>
        <p>
          Manual review routes your application to recruiter handling without
          requiring the standard AI-assisted screening acknowledgements, camera
          permission, microphone permission, or browser geolocation capture at
          initial submission.
        </p>
        <p>
          A recruiter may review your profile, ask written follow-up questions,
          schedule a phone screen, or use another reasonable human-led
          assessment method.
        </p>
      </section>

      <section>
        <h2>How to request it</h2>
        <p>
          If you are applying to a specific Spark job, choose{" "}
          <strong>Manual recruiter review</strong> in the apply form before you
          submit. If you already submitted an application or need help, email{" "}
          <a href="mailto:compliance@tcwglobal.com">
            compliance@tcwglobal.com
          </a>{" "}
          with the subject line <strong>Spark Manual Review Request</strong>.
        </p>
        <p>
          You can return to <Link href="/jobs">open jobs</Link> to select a
          role and start the application flow.
        </p>
      </section>

      <section>
        <h2>No penalty for choosing manual review</h2>
        <p>
          Choosing manual review should not, by itself, penalize your
          application or remove you from consideration. The timing and method of
          review may differ because a human-led workflow requires recruiter
          handling.
        </p>
      </section>
    </LegalPageShell>
  );
}
