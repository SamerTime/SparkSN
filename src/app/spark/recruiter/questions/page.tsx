import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import { listQuestionRepositoryRows } from "@/lib/spark-db";
import { SparkQuestionRepository } from "@/components/spark/SparkQuestionRepository";

export const dynamic = "force-dynamic";

export default async function QuestionRepositoryPage() {
  const recruiter = await getSparkRecruiterUser();
  if (!recruiter) {
    redirect("/spark/login");
  }

  const rows = await listQuestionRepositoryRows();

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
          <Link
            href="/spark/recruiter"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--sn-ink)] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to recruiter workspace
          </Link>
        </div>

        <SparkQuestionRepository rows={rows} />
      </section>
    </main>
  );
}
