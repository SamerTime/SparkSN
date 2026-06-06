import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "California AI Disclosure & Terms | StaffingNation Spark",
  description:
    "Candidate-facing Spark terms, AI-assisted screening disclosure, device permission notice, and manual review rights.",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="California AI Disclosure & Terms"
      title="Spark Terms and AI Screening Disclosure"
      description="How Spark uses AI-assisted workflow tools, device permissions, recruiter review, and candidate privacy choices."
    >
      <section>
        <h2>Overview</h2>
        <p>
          Spark is a candidate intake and recruiter review workflow used for job
          opportunities published by StaffingNation. Spark may use automated
          workflow tools, AI-assisted summarization, and secure cloud
          infrastructure to help recruiters review job-related application
          materials.
        </p>
        <p>
          Spark does not make final hiring, firing, termination, compensation,
          or employment eligibility decisions without human review. AI-assisted
          outputs are recruiter support tools.
        </p>
      </section>

      <section>
        <h2>AI-assisted screening</h2>
        <p>
          When a candidate chooses the standard Spark workflow, Spark may
          process candidate-provided profile information, written responses,
          interview answers, device signals, and permission-based media or
          location data to support:
        </p>
        <ul>
          <li>job-related qualification review;</li>
          <li>recruiter summaries and workflow routing;</li>
          <li>interview question and answer organization;</li>
          <li>fraud, identity, and duplicate-submission review;</li>
          <li>
            regional work-eligibility and jurisdiction checks where relevant to
            the job.
          </li>
        </ul>
      </section>

      <section>
        <h2>Device permissions</h2>
        <p>
          Spark asks for permission to access device capabilities only when
          needed for the workflow. Camera and microphone access are used for
          video interview responses after recruiter approval. Browser location
          may be requested for jurisdiction, proximity, identity, fraud, or
          compliance review where relevant.
        </p>
        <p>
          Spark may also collect limited browser and device metadata, including
          user agent, language, time zone, platform, and screen dimensions for
          security, troubleshooting, and workflow integrity.
        </p>
      </section>

      <section>
        <h2>Manual review and opt-out</h2>
        <p>
          Candidates may request a non-AI, human-reviewed application pathway.
          Choosing the manual pathway should not, by itself, penalize a
          candidate or remove the candidate from consideration.
        </p>
        <p>
          A manual pathway may involve recruiter review, written questions, a
          phone screen, or another reasonable human-led assessment. To learn
          more, visit the{" "}
          <Link href="/manual-review">manual review pathway page</Link>.
        </p>
      </section>

      <section>
        <h2>Accommodations</h2>
        <p>
          Candidates who need an accommodation because of disability, religious
          practice, accessibility needs, device constraints, or another
          protected reason may request assistance by contacting{" "}
          <a href="mailto:compliance@tcwglobal.com">
            compliance@tcwglobal.com
          </a>{" "}
          or by using the manual review pathway in Spark.
        </p>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          Spark retains candidate information only as long as needed for
          recruitment, compliance, security, fraud prevention, dispute
          resolution, and legal recordkeeping. Where permitted by law, Spark may
          retain a limited application record after deleting or de-identifying
          sensitive interview materials.
        </p>
        <p>
          Candidate video, audio, transcript, resume, and location information
          should not be used to train public AI models.
        </p>
      </section>
    </LegalPageShell>
  );
}
