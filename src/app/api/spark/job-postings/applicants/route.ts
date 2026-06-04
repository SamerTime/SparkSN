import { NextRequest, NextResponse } from "next/server";
import {
  listApplicantsByPostingSourceEntity,
  type JsonValue,
  type SparkApplicationStatus,
} from "@/lib/spark-db";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

function isAuthorized(req: NextRequest) {
  const expected = process.env.SPARK_API_KEY;
  if (!expected) return false;

  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.replace(/^Bearer\s+/i, "").trim();
  const apiKey = req.headers.get("x-api-key")?.trim();

  return bearer === expected || apiKey === expected;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function jsonObject(value: JsonValue | unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function candidateName(application: {
  candidateName: string | null;
  candidate?: { firstName?: string | null; lastName?: string | null } | null;
}) {
  const direct = cleanText(application.candidateName);
  if (direct) return direct;

  const first = cleanText(application.candidate?.firstName);
  const last = cleanText(application.candidate?.lastName);
  return [first, last].filter(Boolean).join(" ") || null;
}

function profileLocation(candidate?: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
} | null) {
  if (!candidate) return null;
  return [candidate.city, candidate.state, candidate.country]
    .map(cleanText)
    .filter(Boolean)
    .join(", ") || null;
}

function interviewStatus(status: SparkApplicationStatus, interviewMedia: JsonValue) {
  const media = jsonObject(interviewMedia);

  if (cleanText(media.status)) return cleanText(media.status);
  if (media.completedAt || media.completed_at) return "completed";
  if (media.startedAt || media.started_at) return "started";

  if (status === "InterviewCompleted") return "completed";
  if (status === "InterviewStarted") return "started";
  if (status === "InterviewInvited") return "invited";
  return "not_started";
}

function aiSummaryStatus(aiSummary: JsonValue) {
  const summary = jsonObject(aiSummary);
  if (cleanText(summary.status)) return cleanText(summary.status);
  if (
    cleanText(summary.summary) ||
    cleanText(summary.recruiter_summary) ||
    cleanText(summary.recruiterSummary) ||
    cleanText(summary.overview)
  ) {
    return "ready";
  }
  return "not_started";
}

function aiSummaryExcerpt(aiSummary: JsonValue) {
  const summary = jsonObject(aiSummary);
  const text =
    cleanText(summary.summary) ||
    cleanText(summary.recruiter_summary) ||
    cleanText(summary.recruiterSummary) ||
    cleanText(summary.overview);

  if (!text) return null;
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

function recruiterDecision(status: SparkApplicationStatus) {
  if (status === "Vetted") return "vetted";
  if (status === "Declined") return "declined";
  if (status === "RecruiterApproved") return "approved";
  if (status === "RecruiterReview") return "review";
  return null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorized();
  }

  try {
    const url = new URL(req.url);
    const sparkOrigin = url.origin;
    const sourceEntityId =
      cleanText(url.searchParams.get("source_entity_id")) ||
      cleanText(url.searchParams.get("job_order_id"));
    const sourceEntityType =
      cleanText(url.searchParams.get("source_entity_type")) || "job_order";

    if (!sourceEntityId) {
      return NextResponse.json(
        { success: false, error: "source_entity_id or job_order_id is required" },
        { status: 400 }
      );
    }

    if (sourceEntityType !== "job_order") {
      return NextResponse.json(
        { success: false, error: "Unsupported source_entity_type" },
        { status: 400 }
      );
    }

    const applicants = await listApplicantsByPostingSourceEntity(
      sourceEntityId,
      sourceEntityType
    );

    return NextResponse.json({
      success: true,
      source_entity_id: sourceEntityId,
      source_entity_type: sourceEntityType,
      count: applicants.length,
      applicants: applicants.map((application) => ({
        id: application.id,
        candidate_name: candidateName(application),
        email: cleanText(application.candidateEmail) || cleanText(application.candidate?.email),
        phone: cleanText(application.candidatePhone) || cleanText(application.candidate?.phone),
        status: application.status,
        applied_at: application.createdAt,
        updated_at: application.updatedAt,
        profile_location: profileLocation(application.candidate),
        interview_status: interviewStatus(application.status, application.interviewMedia),
        ai_summary_status: aiSummaryStatus(application.aiSummary),
        ai_summary_excerpt: aiSummaryExcerpt(application.aiSummary),
        recruiter_decision: recruiterDecision(application.status),
        spark_application_url: `${sparkOrigin}/spark/recruiter?application=${application.id}`,
        posting: {
          id: application.posting.id,
          title: application.posting.title,
          slug: application.posting.slug,
          client_name: application.posting.clientName,
        },
      })),
    });
  } catch (error) {
    console.error("Spark applicants lookup failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
