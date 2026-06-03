import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const EXPECTED_PAYLOAD_VERSION = "staffingnation.jd.v1";
const DEFAULT_PUBLIC_JOBS_BASE_URL = "https://tcwtable.com/jobs";

type SparkPublishPayload = {
  payload_version?: string;
  source_system?: string;
  source_entity_type?: string;
  source_entity_id?: string;
  source_revision?: string | null;
  public_jobs_base_url?: string | null;
  client?: {
    id?: string;
    name?: string | null;
  };
  job?: {
    title?: string;
    overview?: string | null;
    responsibilities?: string | null;
    requirements?: string | null;
    qualifications?: string | null;
    skills?: string[];
    certifications?: string[];
    physical_requirements?: unknown;
    status?: string;
  };
  compensation?: {
    pay_range_min?: number | string | null;
    pay_range_max?: number | string | null;
    currency?: string | null;
  };
  compliance?: {
    country?: unknown;
    soc_code?: string | null;
    soc_title?: string | null;
    wc_code?: string | null;
    wc_description?: string | null;
  };
};

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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toDecimalString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : null;
}

function slugify(title: string, sourceEntityId: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  const suffix = sourceEntityId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  return `${base || "job"}-${suffix || "posting"}`;
}

function validatePayload(payload: SparkPublishPayload) {
  if (payload.payload_version !== EXPECTED_PAYLOAD_VERSION) {
    return "Unsupported payload_version";
  }
  if (payload.source_system !== "staffingnation") {
    return "Unsupported source_system";
  }
  if (payload.source_entity_type !== "job_description") {
    return "Unsupported source_entity_type";
  }
  if (!cleanText(payload.source_entity_id)) {
    return "source_entity_id is required";
  }
  if (!cleanText(payload.client?.id)) {
    return "client.id is required";
  }
  if (!cleanText(payload.job?.title)) {
    return "job.title is required";
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return unauthorized();
  }

  try {
    const payload = (await req.json()) as SparkPublishPayload;
    const validationError = validatePayload(payload);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const sourceEntityId = cleanText(payload.source_entity_id)!;
    const title = cleanText(payload.job?.title)!;
    const slug = slugify(title, sourceEntityId);
    const publicJobsBaseUrl =
      cleanText(payload.public_jobs_base_url) ||
      cleanText(process.env.SPARK_PUBLIC_JOBS_BASE_URL) ||
      DEFAULT_PUBLIC_JOBS_BASE_URL;
    const publicUrl = `${publicJobsBaseUrl.replace(/\/+$/g, "")}/${slug}`;
    const now = new Date();
    const physicalRequirements = (payload.job?.physical_requirements ?? {}) as Prisma.InputJsonValue;
    const country =
      payload.compliance?.country === undefined || payload.compliance.country === null
        ? Prisma.JsonNull
        : (payload.compliance.country as Prisma.InputJsonValue);
    const rawPayload = payload as Prisma.InputJsonValue;

    const posting = await prisma.sparkJobPosting.upsert({
      where: { sourceEntityId },
      create: {
        sourceSystem: "staffingnation",
        sourceEntityType: "job_description",
        sourceEntityId,
        sourceRevision: cleanText(payload.source_revision),
        payloadVersion: EXPECTED_PAYLOAD_VERSION,
        clientId: cleanText(payload.client?.id)!,
        clientName: cleanText(payload.client?.name),
        title,
        slug,
        overview: cleanText(payload.job?.overview),
        responsibilities: cleanText(payload.job?.responsibilities),
        requirements: cleanText(payload.job?.requirements),
        qualifications: cleanText(payload.job?.qualifications),
        skills: toStringArray(payload.job?.skills),
        certifications: toStringArray(payload.job?.certifications),
        physicalRequirements,
        payRangeMin: toDecimalString(payload.compensation?.pay_range_min),
        payRangeMax: toDecimalString(payload.compensation?.pay_range_max),
        currency: cleanText(payload.compensation?.currency) || "USD",
        country,
        socCode: cleanText(payload.compliance?.soc_code),
        socTitle: cleanText(payload.compliance?.soc_title),
        wcCode: cleanText(payload.compliance?.wc_code),
        wcDescription: cleanText(payload.compliance?.wc_description),
        publicJobsBaseUrl,
        publicUrl,
        status: "Published",
        rawPayload,
        publishedAt: now,
        lastSyncedAt: now,
      },
      update: {
        sourceRevision: cleanText(payload.source_revision),
        payloadVersion: EXPECTED_PAYLOAD_VERSION,
        clientId: cleanText(payload.client?.id)!,
        clientName: cleanText(payload.client?.name),
        title,
        overview: cleanText(payload.job?.overview),
        responsibilities: cleanText(payload.job?.responsibilities),
        requirements: cleanText(payload.job?.requirements),
        qualifications: cleanText(payload.job?.qualifications),
        skills: toStringArray(payload.job?.skills),
        certifications: toStringArray(payload.job?.certifications),
        physicalRequirements,
        payRangeMin: toDecimalString(payload.compensation?.pay_range_min),
        payRangeMax: toDecimalString(payload.compensation?.pay_range_max),
        currency: cleanText(payload.compensation?.currency) || "USD",
        country,
        socCode: cleanText(payload.compliance?.soc_code),
        socTitle: cleanText(payload.compliance?.soc_title),
        wcCode: cleanText(payload.compliance?.wc_code),
        wcDescription: cleanText(payload.compliance?.wc_description),
        publicJobsBaseUrl,
        publicUrl,
        status: "Published",
        rawPayload,
        lastSyncedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      spark_posting_id: posting.id,
      public_url: posting.publicUrl,
      source_entity_id: posting.sourceEntityId,
    });
  } catch (error) {
    console.error("Spark job posting publish failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
