import { redirect } from "next/navigation";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import {
  getQuestionFeedbackSummary,
  listQuestionRepositoryRows,
} from "@/lib/spark-db";
import { SparkQuestionRepository } from "@/components/spark/SparkQuestionRepository";

export const dynamic = "force-dynamic";

export default async function QuestionRepositoryPage() {
  const recruiter = await getSparkRecruiterUser();
  if (!recruiter) {
    redirect("/spark/login");
  }

  const [rows, feedback] = await Promise.all([
    listQuestionRepositoryRows(),
    getQuestionFeedbackSummary(),
  ]);

  return (
    <main className="sn-page">
      <section className="sn-container py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="sn-eyebrow">Spark screening</p>
            <h1 className="mt-1 text-3xl font-bold text-[var(--sn-ink)]">
              Question repository
            </h1>
            <p className="mt-1 text-sm text-[var(--sn-muted)]">
              Every screening question across all job orders (including retired
              banks), with its metadata, generator, intent, and how many
              candidate answers it has collected.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-md border border-[var(--sn-line)] bg-white px-4 py-2 text-sm">
              <span className="font-semibold text-[var(--sn-ink)]">Roger learning</span>
              <span className="ml-3 text-[var(--sn-muted)]">
                {feedback.signals} signals · {feedback.lessons} lessons ·{" "}
                {feedback.proposed} in Roger&apos;s queue
              </span>
            </div>
          </div>
        </div>

        <SparkQuestionRepository rows={rows} />
      </section>
    </main>
  );
}
