import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const SPARK_RECRUITER_ACCESS_TOKEN = "spark_recruiter_access_token";
const SPARK_RECRUITER_REFRESH_TOKEN = "spark_recruiter_refresh_token";

type SparkRecruiterUser = {
  id: string;
  email: string | null;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function supabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  );
}

function supabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  );
}

export function createSparkAuthClient() {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getSparkRecruiterUser(): Promise<SparkRecruiterUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SPARK_RECRUITER_ACCESS_TOKEN)?.value;

  if (!accessToken) return null;

  const { data, error } = await createSparkAuthClient().auth.getUser(accessToken);
  if (error || !data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email || null,
  };
}

export function setSparkRecruiterCookies(
  response: Response & {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  },
  session: {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  }
) {
  const secure = process.env.NODE_ENV === "production";
  const accessMaxAge = Math.max(60, session.expires_in || 3600);

  response.cookies.set(SPARK_RECRUITER_ACCESS_TOKEN, session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });
  response.cookies.set(SPARK_RECRUITER_REFRESH_TOKEN, session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSparkRecruiterCookies(
  response: Response & {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  }
) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(SPARK_RECRUITER_ACCESS_TOKEN, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(SPARK_RECRUITER_REFRESH_TOKEN, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
