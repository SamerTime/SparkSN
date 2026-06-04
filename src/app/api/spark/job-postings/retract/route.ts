import { NextRequest, NextResponse } from "next/server";
import { archiveJobPostingBySourceEntity } from "@/lib/spark-db";

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

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorized();
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sourceEntityId =
      cleanText(body.source_entity_id) || cleanText(body.job_order_id);
    const sourceEntityType = cleanText(body.source_entity_type) || "job_order";

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

    const posting = await archiveJobPostingBySourceEntity(
      sourceEntityId,
      sourceEntityType
    );

    if (!posting) {
      return NextResponse.json(
        { success: false, error: "Spark job posting not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      spark_posting_id: posting.id,
      source_entity_id: posting.sourceEntityId,
      source_entity_type: posting.sourceEntityType,
      status: posting.status,
      retracted_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Spark job posting retract failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
