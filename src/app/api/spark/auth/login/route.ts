import { NextRequest, NextResponse } from "next/server";
import {
  createSparkAuthClient,
  setSparkRecruiterCookies,
} from "@/lib/spark-auth";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeReturnTo(value: unknown) {
  const next = stringValue(value);
  return next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/spark/recruiter";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = stringValue(body.email).toLowerCase();
    const password = stringValue(body.password);
    const returnTo = safeReturnTo(body.returnTo);

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const { data, error } = await createSparkAuthClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { success: false, error: "Invalid recruiter login." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      returnTo,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
    setSparkRecruiterCookies(response, data.session);

    return response;
  } catch (error) {
    console.error("Spark recruiter login error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to log in." },
      { status: 500 }
    );
  }
}
