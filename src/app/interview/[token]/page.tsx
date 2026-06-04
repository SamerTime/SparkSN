import { notFound } from "next/navigation";
import { SparkLogoMark } from "@/components/spark/SparkBrand";
import { SparkInterviewSession } from "@/components/spark/SparkInterviewSession";
import { getApplicationByInterviewToken } from "@/lib/spark-db";

export const dynamic = "force-dynamic";

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function candidateName(application: Awaited<ReturnType<typeof getApplicationByInterviewToken>>) {
  if (!application) return "Candidate";
  const profileName = [
    application.candidate?.firstName,
    application.candidate?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return profileName || application.candidateName || "Candidate";
}

function interviewStatus(interviewMedia: unknown, fallbackStatus: string) {
  const session = jsonObject(jsonObject(interviewMedia).session);
  return stringValue(session.status) || fallbackStatus;
}

function buildQuestions(title: string, clientName?: string | null) {
  const client = clientName ? ` at ${clientName}` : "";

  return [
    `Please introduce yourself and summarize the experience that best fits the ${title} role${client}.`,
    `What interests you about this role, and what would make you successful in it?`,
    "Walk through a recent work situation where you had to stay organized under time pressure.",
    "Describe how you communicate with a team when priorities change quickly.",
    "Tell us about a time you handled a difficult customer, worker, or stakeholder professionally.",
    "What does reliability mean to you for this specific job?",
    "What tools, systems, or processes have you used that relate to this work?",
    "What is your availability, and are there any scheduling constraints we should know?",
    "If selected, what support or information would help you ramp up quickly?",
    "Is there anything else job-related you want the recruiter to know?",
  ];
}

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const application = await getApplicationByInterviewToken(token);

  if (!application || !application.posting) {
    notFound();
  }

  const status = interviewStatus(application.interviewMedia, application.status);
  const questions = buildQuestions(
    application.posting.title,
    application.posting.clientName
  );

  return (
    <main className="sn-page">
      <section className="sn-container flex min-h-[calc(100vh-145px)] items-center justify-center py-8">
        <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
          <div className="hidden lg:block">
            <div className="flex items-center gap-3">
              <SparkLogoMark className="h-14 w-16 shrink-0" />
              <div>
                <p className="sn-eyebrow">Spark screening</p>
                <h1 className="mt-2 text-5xl font-extrabold text-[var(--sn-ink)]">
                  {application.posting.title}
                </h1>
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--sn-muted)]">
              {candidateName(application)} has been invited to complete the
              short interview session. Answers are saved for recruiter review
              after the session ends.
            </p>
          </div>

          <div className="mx-auto w-full max-w-[430px]">
            <div className="spark-phone">
              <div className="spark-phone-screen">
                <SparkInterviewSession
                  token={token}
                  candidateName={candidateName(application)}
                  postingTitle={application.posting.title}
                  clientName={application.posting.clientName}
                  initialStatus={status}
                  questions={questions}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
