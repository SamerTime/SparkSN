import { NextRequest, NextResponse } from "next/server";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import { getSparkSettings, updateSparkSettings } from "@/lib/spark-settings";

// Admin settings. Any logged-in recruiter can read/write for now;
// roles/permissions will eventually be inherited from staffingnation.us.
export async function GET() {
  const recruiter = await getSparkRecruiterUser();
  if (!recruiter) {
    return NextResponse.json(
      { success: false, error: "Recruiter login required." },
      { status: 401 }
    );
  }
  const settings = await getSparkSettings();
  return NextResponse.json({ success: true, settings });
}

export async function PUT(request: NextRequest) {
  const recruiter = await getSparkRecruiterUser();
  if (!recruiter) {
    return NextResponse.json(
      { success: false, error: "Recruiter login required." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const autoInviteEnabled = body?.autoInviteEnabled === true;
  const autoAcceptDomains = Array.isArray(body?.autoAcceptDomains)
    ? Array.from(
        new Set(
          (body.autoAcceptDomains as unknown[])
            .filter((d): d is string => typeof d === "string")
            .map((d) =>
              d.toLowerCase().trim().replace(/^@/, "").replace(/^\*\./, "")
            )
            .filter(Boolean)
        )
      )
    : [];

  try {
    const settings = await updateSparkSettings(
      { autoInviteEnabled, autoAcceptDomains },
      recruiter.email
    );
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to save settings.",
      },
      { status: 500 }
    );
  }
}
