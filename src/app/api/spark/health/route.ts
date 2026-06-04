import { NextResponse } from "next/server";
import { countPublishedJobs } from "@/lib/spark-db";

export const dynamic = "force-dynamic";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SPARK_API_KEY",
  "SPARK_PUBLIC_JOBS_BASE_URL",
] as const;

const MESSAGING_ENV = [
  "COURIER_AUTH_TOKEN",
  "COURIER_POSTMARK_FROM_EMAIL",
  "COURIER_POSTMARK_MESSAGE_STREAM",
] as const;

function envStatus(name: string) {
  const value = process.env[name]?.trim() || "";
  const isUrl = name.endsWith("_URL") || name === "SPARK_PUBLIC_JOBS_BASE_URL";

  return {
    present: value.length > 0,
    length: value.length,
    validUrl: isUrl ? /^https:\/\/.+/.test(value) : undefined,
  };
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[\w.-]+/gi, "Bearer <redacted>")
    .replace(/eyJ[\w.-]+/g, "<redacted-jwt>");
}

export async function GET() {
  const env = Object.fromEntries(
    REQUIRED_ENV.map((name) => [name, envStatus(name)])
  );
  const messagingEnv = Object.fromEntries(
    MESSAGING_ENV.map((name) => [name, envStatus(name)])
  );
  const missing = REQUIRED_ENV.filter((name) => !env[name].present);
  const courierPostmarkReady = messagingEnv.COURIER_AUTH_TOKEN.present;

  let supabase:
    | { ok: true; publishedJobCount: number }
    | { ok: false; error: string };

  try {
    supabase = {
      ok: true,
      publishedJobCount: await countPublishedJobs(),
    };
  } catch (error) {
    supabase = {
      ok: false,
      error: safeError(error),
    };
  }

  const ok = missing.length === 0 && supabase.ok;

  return NextResponse.json(
    {
      ok,
      service: "staffingnation-spark",
      runtime: "cloudflare-worker",
      env,
      missing,
      messaging: {
        courierPostmark: {
          ready: courierPostmarkReady,
          env: messagingEnv,
          defaultFromEmail: "tasky@tcwglobal.com",
        },
      },
      supabase,
    },
    { status: ok ? 200 : 503 }
  );
}
