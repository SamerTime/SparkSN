import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import { SparkRecruiterLoginForm } from "@/components/spark/SparkRecruiterLoginForm";

export const dynamic = "force-dynamic";

type SparkLoginPageProps = {
  searchParams: Promise<{
    returnTo?: string;
  }>;
};

function safeReturnTo(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/spark/recruiter";
}

export default async function SparkLoginPage({
  searchParams,
}: SparkLoginPageProps) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const user = await getSparkRecruiterUser();

  if (user) {
    redirect(returnTo);
  }

  return (
    <main className="sn-page">
      <section className="sn-container flex min-h-[calc(100vh-8rem)] items-center justify-center py-10">
        <div className="sn-card w-full max-w-md overflow-hidden">
          <div className="h-1.5 bg-[var(--sn-coral)]" />
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--sn-blue-50)] text-[var(--sn-blue)]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-normal text-[var(--sn-blue-700)]">
                  Recruiter access
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-[var(--sn-ink)]">
                  Sign in to Spark
                </h1>
                <p className="mt-2 text-sm leading-6 text-[var(--sn-muted)]">
                  Use your Supabase recruiter account to review Spark
                  applications, interviews, and recordings.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <SparkRecruiterLoginForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
