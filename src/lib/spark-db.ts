import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SparkPostingStatus = "Published" | "Archived" | "Closed";

export type SparkApplicationStatus =
  | "ProfileStarted"
  | "Applied"
  | "Invited"
  | "RecruiterApproved"
  | "InterviewInvited"
  | "InProcess"
  | "InterviewStarted"
  | "Complete"
  | "InterviewCompleted"
  | "RecruiterReview"
  | "Reviewing"
  | "Vetted"
  | "Shortlisted"
  | "Offer"
  | "Declined";

export type SparkQuestionBankStatus = "Draft" | "Approved" | "Retired";

export type SparkJobPosting = {
  id: string;
  sourceSystem: string;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceRevision: string | null;
  payloadVersion: string;
  clientId: string;
  clientName: string | null;
  title: string;
  slug: string;
  overview: string | null;
  responsibilities: string | null;
  requirements: string | null;
  qualifications: string | null;
  skills: string[];
  certifications: string[];
  physicalRequirements: JsonValue;
  payRangeMin: string | number | null;
  payRangeMax: string | number | null;
  currency: string;
  country: JsonValue | null;
  socCode: string | null;
  socTitle: string | null;
  wcCode: string | null;
  wcDescription: string | null;
  publicJobsBaseUrl: string;
  publicUrl: string | null;
  status: SparkPostingStatus;
  rawPayload: JsonValue;
  publishedAt: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SparkCandidateProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  resumeUrl: string | null;
  profileData: JsonValue;
  geolocationConsentAt: string | null;
  aiInterviewConsentAt: string | null;
  recordingConsentAt: string | null;
  fraudReviewData: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type SparkJobInvitation = {
  id: string;
  postingId: string;
  email: string;
  inviteUrl: string;
  status: string;
  invitedBy: string | null;
  communicationState: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type SparkQuestionBank = {
  id: string;
  postingId: string;
  jobOrderId: string | null;
  jdSourceHash: string;
  payloadVersion: string;
  status: SparkQuestionBankStatus;
  questionCountTarget: number;
  generatedBy: "ai" | "mcp" | "recruiter" | "system";
  generatedAt: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  retiredAt: string | null;
  mcpServerSlug: string | null;
  mcpToolName: string | null;
  mcpRunId: string | null;
  modelName: string | null;
  promptVersion: string;
  safetyProfile: string;
  sourceSnapshot: JsonValue;
  questions: JsonValue;
  agentReview: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type SparkQuestionBankAuditEvent = {
  id: string;
  questionBankId: string;
  postingId: string;
  eventType: string;
  actorType: "recruiter" | "system" | "mcp";
  actorId: string | null;
  beforeJson: JsonValue | null;
  afterJson: JsonValue;
  createdAt: string;
};

export type SparkApplicationDeletionLog = {
  id: string;
  applicationId: string;
  postingId: string | null;
  candidateId: string | null;
  candidateEmail: string | null;
  candidateName: string | null;
  applicationStatus: string | null;
  note: string;
  deletedByUserId: string | null;
  deletedByEmail: string | null;
  snapshot: JsonValue;
  deletedAt: string;
};

export type SparkApplication = {
  id: string;
  postingId: string;
  candidateId: string | null;
  candidateEmail: string | null;
  candidateName: string | null;
  candidatePhone: string | null;
  status: SparkApplicationStatus;
  recruiterNotes: string | null;
  communicationState: JsonValue;
  deviceSignals: JsonValue;
  locationSignals: JsonValue;
  interviewMedia: JsonValue;
  interviewTranscript: JsonValue;
  aiSummary: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type SparkApplicationWithRelations = SparkApplication & {
  posting: Pick<SparkJobPosting, "title" | "slug" | "clientName">;
  candidate: Pick<
    SparkCandidateProfile,
    "firstName" | "lastName" | "email" | "phone" | "city" | "state"
  > | null;
};

export type SparkRecruiterActionApplication = Pick<
  SparkApplication,
  | "id"
  | "communicationState"
  | "interviewMedia"
  | "status"
  | "postingId"
  | "candidateEmail"
  | "candidateName"
  | "candidatePhone"
> & {
  posting: Pick<
    SparkJobPosting,
    "id" | "title" | "slug" | "clientName" | "publicUrl"
  > | null;
};

export type SparkInterviewSessionApplication = SparkApplication & {
  posting: Pick<SparkJobPosting, "id" | "title" | "slug" | "clientName"> | null;
  candidate: Pick<
    SparkCandidateProfile,
    "firstName" | "lastName" | "email" | "phone" | "city" | "state"
  > | null;
};

export type SparkApplicationDeletionSnapshot = SparkApplication & {
  posting: Pick<
    SparkJobPosting,
    "id" | "title" | "slug" | "clientName" | "sourceEntityId" | "sourceEntityType"
  > | null;
  candidate: Pick<
    SparkCandidateProfile,
    "id" | "firstName" | "lastName" | "email" | "phone" | "city" | "state" | "country"
  > | null;
};

export type SparkPublishedJobListItem = Pick<
  SparkJobPosting,
  | "id"
  | "title"
  | "slug"
  | "overview"
  | "clientName"
  | "skills"
  | "payRangeMin"
  | "payRangeMax"
  | "currency"
  | "country"
  | "lastSyncedAt"
>;

export type SparkQuestionBankListItem = Pick<
  SparkQuestionBank,
  | "id"
  | "postingId"
  | "jdSourceHash"
  | "status"
  | "questionCountTarget"
  | "generatedBy"
  | "generatedAt"
  | "approvedByUserId"
  | "approvedAt"
  | "mcpServerSlug"
  | "mcpToolName"
  | "mcpRunId"
  | "modelName"
  | "promptVersion"
  | "safetyProfile"
  | "questions"
  | "agentReview"
  | "updatedAt"
>;

export type SparkApplicationPosting = Pick<
  SparkJobPosting,
  "id" | "title" | "slug" | "clientName"
>;

export type SparkExistingApplication = Pick<
  SparkApplication,
  "id" | "status" | "communicationState"
>;

export type SparkApplicationWriteResult = Pick<
  SparkApplication,
  "id" | "status"
>;

export type SparkPostingWriteResult = Pick<
  SparkJobPosting,
  "id" | "publicUrl" | "sourceEntityId"
>;

export type SparkPostingRetractResult = Pick<
  SparkJobPosting,
  "id" | "sourceEntityId" | "sourceEntityType" | "status"
>;

export type SparkApplicantListItem = Pick<
  SparkApplication,
  | "id"
  | "candidateName"
  | "candidateEmail"
  | "candidatePhone"
  | "status"
  | "interviewMedia"
  | "aiSummary"
  | "createdAt"
  | "updatedAt"
> & {
  posting: Pick<SparkJobPosting, "id" | "title" | "slug" | "clientName">;
  candidate: Pick<
    SparkCandidateProfile,
    "firstName" | "lastName" | "email" | "phone" | "city" | "state" | "country"
  > | null;
};

let adminClient: SupabaseClient | null = null;

export const SPARK_INTERVIEW_RECORDINGS_BUCKET = "spark-interview-recordings";

const INTERVIEW_RECORDING_MIME_TYPES = [
  "video/webm",
  "video/mp4",
  "video/quicktime",
];
const INTERVIEW_RECORDING_MAX_BYTES = 262_144_000;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSparkSupabase() {
  if (adminClient) return adminClient;

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing required environment variable: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"
    );
  }

  adminClient = createClient(url, getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  return adminClient;
}

function fail(error: { message?: string } | null, context: string): never {
  throw new Error(`${context}: ${error?.message || "Unknown Supabase error"}`);
}

function nowIso() {
  return new Date().toISOString();
}

function rowId() {
  return crypto.randomUUID();
}

function missingTable(error: { code?: string; message?: string } | null, tableName: string) {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes(tableName))
  );
}

function recordingExtension(contentType: string) {
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "video/quicktime") return "mov";
  return "webm";
}

function safeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || rowId();
}

export async function ensureInterviewRecordingBucket() {
  const supabase = getSparkSupabase();
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();

  if (listError) fail(listError, "Unable to list Spark storage buckets");

  const exists = (buckets || []).some(
    (bucket) => bucket.name === SPARK_INTERVIEW_RECORDINGS_BUCKET
  );
  if (exists) return;

  const { error } = await supabase.storage.createBucket(
    SPARK_INTERVIEW_RECORDINGS_BUCKET,
    {
      public: false,
      fileSizeLimit: INTERVIEW_RECORDING_MAX_BYTES,
      allowedMimeTypes: INTERVIEW_RECORDING_MIME_TYPES,
    }
  );

  if (error && !/already exists/i.test(error.message || "")) {
    fail(error, "Unable to create Spark interview recording bucket");
  }
}

export async function createInterviewRecordingUpload(
  applicationId: string,
  token: string,
  contentType: string
) {
  await ensureInterviewRecordingBucket();

  const normalizedContentType = contentType.split(";")[0];
  if (!INTERVIEW_RECORDING_MIME_TYPES.includes(normalizedContentType)) {
    throw new Error("Unsupported interview recording content type");
  }

  const extension = recordingExtension(normalizedContentType);
  const path = [
    safeStorageSegment(applicationId),
    `${Date.now()}-${safeStorageSegment(token)}.${extension}`,
  ].join("/");
  const { data, error } = await getSparkSupabase()
    .storage
    .from(SPARK_INTERVIEW_RECORDINGS_BUCKET)
    .createSignedUploadUrl(path);

  if (error) fail(error, "Unable to create Spark recording upload URL");
  if (!data?.token || !data?.path) {
    throw new Error("Unable to create Spark recording upload URL");
  }

  return {
    bucket: SPARK_INTERVIEW_RECORDINGS_BUCKET,
    path: data.path,
    token: data.token,
  };
}

export async function createInterviewRecordingSignedUrl(
  path: string,
  expiresInSeconds = 3600
) {
  const { data, error } = await getSparkSupabase()
    .storage
    .from(SPARK_INTERVIEW_RECORDINGS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) fail(error, "Unable to create Spark recording playback URL");
  if (!data?.signedUrl) {
    throw new Error("Unable to create Spark recording playback URL");
  }

  return data.signedUrl;
}

export async function listPublishedJobs(): Promise<SparkPublishedJobListItem[]> {
  const { data, error } = await getSparkSupabase()
    .from("SparkJobPosting")
    .select(
      "id,title,slug,overview,clientName,skills,payRangeMin,payRangeMax,currency,country,lastSyncedAt"
    )
    .eq("status", "Published")
    .order("lastSyncedAt", { ascending: false });

  if (error) fail(error, "Unable to list published Spark jobs");
  return (data || []) as unknown as SparkPublishedJobListItem[];
}

export async function getPublishedJobBySlug(
  slug: string
): Promise<SparkJobPosting | null> {
  const { data, error } = await getSparkSupabase()
    .from("SparkJobPosting")
    .select("*")
    .eq("slug", slug)
    .eq("status", "Published")
    .maybeSingle();

  if (error) fail(error, "Unable to load Spark job");
  return data as unknown as SparkJobPosting | null;
}

export async function getPublishedJobById(
  postingId: string
): Promise<SparkJobPosting | null> {
  const { data, error } = await getSparkSupabase()
    .from("SparkJobPosting")
    .select("*")
    .eq("id", postingId)
    .eq("status", "Published")
    .maybeSingle();

  if (error) fail(error, "Unable to load Spark job");
  return data as unknown as SparkJobPosting | null;
}

export async function listLatestQuestionBanksByPostingIds(
  postingIds: string[]
): Promise<SparkQuestionBankListItem[]> {
  if (!postingIds.length) return [];

  const { data, error } = await getSparkSupabase()
    .from("SparkQuestionBank")
    .select(
      "id,postingId,jdSourceHash,status,questionCountTarget,generatedBy,generatedAt,approvedByUserId,approvedAt,mcpServerSlug,mcpToolName,mcpRunId,modelName,promptVersion,safetyProfile,questions,agentReview,updatedAt"
    )
    .in("postingId", postingIds)
    .order("updatedAt", { ascending: false });

  if (error) {
    if (missingTable(error, "SparkQuestionBank")) return [];
    fail(error, "Unable to list Spark question banks");
  }

  const latestByPostingId = new Map<string, SparkQuestionBankListItem>();
  ((data || []) as unknown as SparkQuestionBankListItem[]).forEach((bank) => {
    if (!latestByPostingId.has(bank.postingId)) {
      latestByPostingId.set(bank.postingId, bank);
    }
  });

  return [...latestByPostingId.values()];
}

export async function getQuestionBankForPosting(
  postingId: string,
  questionBankId: string
): Promise<SparkQuestionBank | null> {
  const { data, error } = await getSparkSupabase()
    .from("SparkQuestionBank")
    .select("*")
    .eq("postingId", postingId)
    .eq("id", questionBankId)
    .maybeSingle();

  if (error) fail(error, "Unable to load Spark question bank");
  return data as unknown as SparkQuestionBank | null;
}

export type SparkInterviewSnapshotQuestion = {
  id: string;
  text: string;
  type: string;
  source: string;
  source_label: string | null;
  source_category: string | null;
  target_seconds: number | null;
  generated_by: string | null;
  generator_label: string | null;
  mcp_run_id: string | null;
};

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// Normalize an approved bank's questions JSON into the shape the candidate
// interview needs. Tolerant of missing fields, since upstream agent output is
// not runtime-validated.
export function interviewQuestionsFromBank(
  bank: Pick<SparkQuestionBank, "questions"> | null
): SparkInterviewSnapshotQuestion[] {
  const raw =
    bank && Array.isArray(bank.questions) ? (bank.questions as unknown[]) : [];
  return raw
    .map((entry) => {
      const obj =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};
      const text = typeof obj.text === "string" ? obj.text.trim() : "";
      if (!text) return null;
      return {
        id: stringField(obj.id),
        text,
        type: stringField(obj.type) || "role_specific",
        source: stringField(obj.source) || "question_bank",
        source_label:
          stringField(obj.source_label) || stringField(obj.sourceLabel) || null,
        source_category:
          stringField(obj.source_category) ||
          stringField(obj.sourceCategory) ||
          null,
        target_seconds:
          typeof obj.target_seconds === "number" ? obj.target_seconds : null,
        generated_by:
          stringField(obj.generated_by) || stringField(obj.generatedBy) || null,
        generator_label:
          stringField(obj.generator_label) ||
          stringField(obj.generatorLabel) ||
          null,
        mcp_run_id:
          stringField(obj.mcp_run_id) || stringField(obj.mcpRunId) || null,
      };
    })
    .filter((q): q is SparkInterviewSnapshotQuestion => q !== null);
}

export async function getApprovedQuestionBankForPosting(
  postingId: string
): Promise<SparkQuestionBank | null> {
  const { data, error } = await getSparkSupabase()
    .from("SparkQuestionBank")
    .select("*")
    .eq("postingId", postingId)
    .eq("status", "Approved")
    .order("approvedAt", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (missingTable(error, "SparkQuestionBank")) return null;
    fail(error, "Unable to load approved Spark question bank");
  }

  return data as unknown as SparkQuestionBank | null;
}

// ---------------------------------------------------------------------------
// Question repository: flatten every question across all banks (incl. retired)
// into one row each, joined to its job order and to a count of candidate
// answers (answers carry questionId, so question <-> answer is relational).
// ---------------------------------------------------------------------------

export type SparkQuestionRepositoryRow = {
  questionId: string;
  bankId: string;
  bankStatus: SparkQuestionBankStatus;
  postingId: string;
  jobOrder: string;
  clientName: string | null;
  text: string;
  type: string;
  intent: string;
  source: string;
  generator: string;
  model: string | null;
  promptVersion: string | null;
  targetSeconds: number | null;
  answersCount: number;
  mcpRunId: string | null;
  createdAt: string;
};

function deriveQuestionIntent(type: string, source: string): string {
  const s = source.toLowerCase();
  if (s.includes("skill")) return "Probe hands-on depth in a required skill";
  if (s.includes("responsibilit")) return "See how they'd handle a core responsibility";
  if (s.includes("requirement")) return "Verify a must-have requirement";
  if (s.includes("qualification")) return "Confirm a stated qualification";
  if (s.includes("behavioral")) return "Assess a behavioral / soft-skill signal";
  if (s.includes("availability")) return "Confirm availability and logistics fit";
  const t = type.toLowerCase();
  if (t === "safety") return "Check safety / compliance awareness";
  if (t === "behavioral") return "Assess a behavioral / soft-skill signal";
  if (t === "availability") return "Confirm availability and logistics fit";
  if (t === "technical") return "Probe technical capability";
  return "Assess job-relevant fit";
}

export async function listQuestionRepositoryRows(): Promise<
  SparkQuestionRepositoryRow[]
> {
  const supabase = getSparkSupabase();

  const banksRes = await supabase
    .from("SparkQuestionBank")
    .select(
      "id,postingId,status,generatedBy,modelName,promptVersion,generatedAt,approvedAt,mcpRunId,questions"
    );
  if (banksRes.error) {
    if (missingTable(banksRes.error, "SparkQuestionBank")) return [];
    fail(banksRes.error, "Unable to load Spark question banks");
  }
  const banks = (banksRes.data || []) as Array<Record<string, unknown>>;
  if (banks.length === 0) return [];

  const postingIds = [
    ...new Set(banks.map((b) => String(b.postingId)).filter(Boolean)),
  ];
  const postingsRes = await supabase
    .from("SparkJobPosting")
    .select("id,title,clientName")
    .in("id", postingIds);
  if (postingsRes.error) {
    fail(postingsRes.error, "Unable to load Spark postings for repository");
  }
  const postingById = new Map<string, { title: string; clientName: string | null }>();
  for (const p of (postingsRes.data || []) as Array<Record<string, unknown>>) {
    postingById.set(String(p.id), {
      title: String(p.title ?? "Untitled"),
      clientName: (p.clientName as string) ?? null,
    });
  }

  // Count candidate answers per questionId across all applications.
  const appsRes = await supabase
    .from("SparkApplication")
    .select("interviewTranscript");
  if (appsRes.error) {
    fail(appsRes.error, "Unable to load Spark applications for repository");
  }
  const answerCountByQuestionId = new Map<string, number>();
  for (const app of (appsRes.data || []) as Array<Record<string, unknown>>) {
    const transcript = app.interviewTranscript;
    const answers =
      transcript &&
      typeof transcript === "object" &&
      Array.isArray((transcript as Record<string, unknown>).answers)
        ? ((transcript as Record<string, unknown>).answers as unknown[])
        : [];
    for (const a of answers) {
      const qid =
        a && typeof a === "object"
          ? String((a as Record<string, unknown>).questionId ?? "")
          : "";
      if (qid) {
        answerCountByQuestionId.set(
          qid,
          (answerCountByQuestionId.get(qid) ?? 0) + 1
        );
      }
    }
  }

  const rows: SparkQuestionRepositoryRow[] = [];
  for (const bank of banks) {
    const questions = Array.isArray(bank.questions)
      ? (bank.questions as unknown[])
      : [];
    const posting = postingById.get(String(bank.postingId));
    for (const q of questions) {
      const item = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
      const text = typeof item.text === "string" ? item.text : "";
      if (!text) continue;
      const qid = typeof item.id === "string" && item.id ? item.id : "";
      const type = typeof item.type === "string" ? item.type : "role_specific";
      const source = typeof item.source === "string" ? item.source : "";
      const generator =
        (typeof item.generator_label === "string" && item.generator_label) ||
        (typeof item.generated_by === "string" && item.generated_by) ||
        String(bank.generatedBy ?? "system");
      rows.push({
        questionId: qid,
        bankId: String(bank.id),
        bankStatus: String(bank.status ?? "Draft") as SparkQuestionBankStatus,
        postingId: String(bank.postingId),
        jobOrder: posting?.title ?? "Unknown job order",
        clientName: posting?.clientName ?? null,
        text,
        type,
        intent: deriveQuestionIntent(type, source),
        source,
        generator,
        model: (bank.modelName as string) ?? null,
        promptVersion: (bank.promptVersion as string) ?? null,
        targetSeconds:
          typeof item.target_seconds === "number" ? item.target_seconds : null,
        answersCount: qid ? answerCountByQuestionId.get(qid) ?? 0 : 0,
        mcpRunId: (bank.mcpRunId as string) ?? null,
        createdAt: String(bank.generatedAt ?? bank.approvedAt ?? ""),
      });
    }
  }
  return rows;
}

export async function retireQuestionBanksForPosting(
  postingId: string,
  statuses: SparkQuestionBankStatus[] = ["Draft"]
) {
  const { error } = await getSparkSupabase()
    .from("SparkQuestionBank")
    .update({
      status: "Retired",
      retiredAt: nowIso(),
      updatedAt: nowIso(),
    })
    .eq("postingId", postingId)
    .in("status", statuses);

  if (error) fail(error, "Unable to retire Spark question banks");
}

export async function createQuestionBank(
  values: Omit<Partial<SparkQuestionBank>, "id" | "createdAt" | "updatedAt"> & {
    postingId: string;
    jobOrderId: string;
    jdSourceHash: string;
    questionCountTarget: number;
    questions: JsonValue;
  }
): Promise<SparkQuestionBank> {
  const timestamp = nowIso();
  const { data, error } = await getSparkSupabase()
    .from("SparkQuestionBank")
    .insert({
      id: rowId(),
      ...values,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .select("*")
    .single();

  if (error) fail(error, "Unable to create Spark question bank");
  return data as unknown as SparkQuestionBank;
}

export async function approveQuestionBank(
  postingId: string,
  questionBankId: string,
  approvedByUserId: string
): Promise<SparkQuestionBank> {
  const timestamp = nowIso();
  const supabase = getSparkSupabase();
  const retireExisting = await supabase
    .from("SparkQuestionBank")
    .update({
      status: "Retired",
      retiredAt: timestamp,
      updatedAt: timestamp,
    })
    .eq("postingId", postingId)
    .eq("status", "Approved")
    .neq("id", questionBankId);

  if (retireExisting.error) {
    fail(retireExisting.error, "Unable to retire previous approved question bank");
  }

  const { data, error } = await supabase
    .from("SparkQuestionBank")
    .update({
      status: "Approved",
      approvedByUserId,
      approvedAt: timestamp,
      retiredAt: null,
      updatedAt: timestamp,
    })
    .eq("postingId", postingId)
    .eq("id", questionBankId)
    .select("*")
    .single();

  if (error) fail(error, "Unable to approve Spark question bank");
  return data as unknown as SparkQuestionBank;
}

export async function createQuestionBankAuditEvent(
  values: Omit<
    Partial<SparkQuestionBankAuditEvent>,
    "id" | "createdAt"
  > & {
    questionBankId: string;
    postingId: string;
    eventType: string;
  }
) {
  const { error } = await getSparkSupabase()
    .from("SparkQuestionBankAuditEvent")
    .insert({
      id: rowId(),
      ...values,
      createdAt: nowIso(),
    });

  if (error) fail(error, "Unable to create Spark question bank audit event");
}

export async function countPublishedJobs() {
  const { count, error } = await getSparkSupabase()
    .from("SparkJobPosting")
    .select("id", { count: "exact", head: true })
    .eq("status", "Published");

  if (error) fail(error, "Unable to count published Spark jobs");
  return count || 0;
}

export async function upsertJobPostingBySourceEntityId(
  sourceEntityId: string,
  values: Omit<
    Partial<SparkJobPosting>,
    "id" | "sourceEntityId" | "createdAt" | "updatedAt"
  >
): Promise<SparkPostingWriteResult> {
  const supabase = getSparkSupabase();
  const existing = await supabase
    .from("SparkJobPosting")
    .select("id,createdAt")
    .eq("sourceEntityId", sourceEntityId)
    .maybeSingle();

  if (existing.error) {
    fail(existing.error, "Unable to check existing Spark job posting");
  }

  const timestamp = nowIso();
  if (existing.data) {
    const { data, error } = await supabase
      .from("SparkJobPosting")
      .update({
        ...values,
        sourceEntityId,
        updatedAt: timestamp,
      })
      .eq("id", existing.data.id)
      .select("id,publicUrl,sourceEntityId")
      .single();

    if (error) fail(error, "Unable to update Spark job posting");
    return data as unknown as SparkPostingWriteResult;
  }

  const { data, error } = await supabase
    .from("SparkJobPosting")
    .insert({
      id: rowId(),
      ...values,
      sourceEntityId,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .select("id,publicUrl,sourceEntityId")
    .single();

  if (error) fail(error, "Unable to create Spark job posting");
  return data as unknown as SparkPostingWriteResult;
}

export async function archiveJobPostingBySourceEntity(
  sourceEntityId: string,
  sourceEntityType = "job_order"
): Promise<SparkPostingRetractResult | null> {
  const timestamp = nowIso();
  const { data, error } = await getSparkSupabase()
    .from("SparkJobPosting")
    .update({
      status: "Archived",
      lastSyncedAt: timestamp,
      updatedAt: timestamp,
    })
    .eq("sourceEntityId", sourceEntityId)
    .eq("sourceEntityType", sourceEntityType)
    .select("id,sourceEntityId,sourceEntityType,status")
    .maybeSingle();

  if (error) fail(error, "Unable to retract Spark job posting");
  return data as unknown as SparkPostingRetractResult | null;
}

export async function listApplicantsByPostingSourceEntity(
  sourceEntityId: string,
  sourceEntityType = "job_order"
): Promise<SparkApplicantListItem[]> {
  const supabase = getSparkSupabase();
  const postingResponse = await supabase
    .from("SparkJobPosting")
    .select("id,title,slug,clientName")
    .eq("sourceEntityId", sourceEntityId)
    .eq("sourceEntityType", sourceEntityType)
    .maybeSingle();

  if (postingResponse.error) {
    fail(postingResponse.error, "Unable to load Spark posting applicants");
  }

  if (!postingResponse.data) return [];

  const appsResponse = await supabase
    .from("SparkApplication")
    .select(
      "id,candidateId,candidateName,candidateEmail,candidatePhone,status,interviewMedia,aiSummary,createdAt,updatedAt"
    )
    .eq("postingId", postingResponse.data.id)
    .order("createdAt", { ascending: false });

  if (appsResponse.error) {
    fail(appsResponse.error, "Unable to list Spark posting applicants");
  }

  const applications = appsResponse.data || [];
  const candidateIds = [
    ...new Set(
      applications
        .map((app) => app.candidateId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const candidatesResponse =
    candidateIds.length > 0
      ? await supabase
          .from("SparkCandidateProfile")
          .select("id,firstName,lastName,email,phone,city,state,country")
          .in("id", candidateIds)
      : { data: [], error: null };

  if (candidatesResponse.error) {
    fail(candidatesResponse.error, "Unable to load Spark applicant profiles");
  }

  const candidatesById = new Map(
    (candidatesResponse.data || []).map((candidate) => [candidate.id, candidate])
  );

  return applications.map((application) => ({
    ...application,
    posting: postingResponse.data,
    candidate: application.candidateId
      ? candidatesById.get(application.candidateId) || null
      : null,
  })) as unknown as SparkApplicantListItem[];
}

export async function getPublishedPostingForApplication(
  slug: string
): Promise<SparkApplicationPosting | null> {
  const { data, error } = await getSparkSupabase()
    .from("SparkJobPosting")
    .select("id,title,slug,clientName")
    .eq("slug", slug)
    .eq("status", "Published")
    .maybeSingle();

  if (error) fail(error, "Unable to load Spark posting for application");
  return data as unknown as SparkApplicationPosting | null;
}

export async function upsertCandidateProfileByEmail(
  email: string,
  values: Omit<
    Partial<SparkCandidateProfile>,
    "id" | "email" | "createdAt" | "updatedAt"
  >
): Promise<Pick<SparkCandidateProfile, "id" | "email">> {
  const supabase = getSparkSupabase();
  const existing = await supabase
    .from("SparkCandidateProfile")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();

  if (existing.error) {
    fail(existing.error, "Unable to check existing Spark candidate");
  }

  const timestamp = nowIso();
  if (existing.data) {
    const { data, error } = await supabase
      .from("SparkCandidateProfile")
      .update({
        ...values,
        email,
        updatedAt: timestamp,
      })
      .eq("id", existing.data.id)
      .select("id,email")
      .single();

    if (error) fail(error, "Unable to update Spark candidate");
    return data as unknown as Pick<SparkCandidateProfile, "id" | "email">;
  }

  const { data, error } = await supabase
    .from("SparkCandidateProfile")
    .insert({
      id: rowId(),
      email,
      ...values,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .select("id,email")
    .single();

  if (error) fail(error, "Unable to create Spark candidate");
  return data as unknown as Pick<SparkCandidateProfile, "id" | "email">;
}

export async function findApplicationByPostingAndEmail(
  postingId: string,
  candidateEmail: string
): Promise<SparkExistingApplication | null> {
  const { data, error } = await getSparkSupabase()
    .from("SparkApplication")
    .select("id,status,communicationState")
    .eq("postingId", postingId)
    .eq("candidateEmail", candidateEmail)
    .maybeSingle();

  if (error) fail(error, "Unable to check existing Spark application");
  return data as unknown as SparkExistingApplication | null;
}

export async function findJobInvitationByPostingAndEmail(
  postingId: string,
  email: string
): Promise<Pick<SparkJobInvitation, "id" | "communicationState"> | null> {
  const { data, error } = await getSparkSupabase()
    .from("SparkJobInvitation")
    .select("id,communicationState")
    .eq("postingId", postingId)
    .eq("email", email)
    .maybeSingle();

  if (error) {
    if (missingTable(error, "SparkJobInvitation")) return null;
    fail(error, "Unable to check Spark job invitation");
  }

  return data as unknown as Pick<SparkJobInvitation, "id" | "communicationState"> | null;
}

export async function upsertJobInvitation(
  values: Omit<
    Partial<SparkJobInvitation>,
    "id" | "createdAt" | "updatedAt"
  > & {
    postingId: string;
    email: string;
    inviteUrl: string;
  }
): Promise<Pick<SparkJobInvitation, "id" | "email" | "status">> {
  const supabase = getSparkSupabase();
  const timestamp = nowIso();
  const existing = await supabase
    .from("SparkJobInvitation")
    .select("id")
    .eq("postingId", values.postingId)
    .eq("email", values.email)
    .maybeSingle();

  if (existing.error) {
    fail(existing.error, "Unable to check Spark job invitation");
  }

  if (existing.data) {
    const { data, error } = await supabase
      .from("SparkJobInvitation")
      .update({
        ...values,
        updatedAt: timestamp,
      })
      .eq("id", existing.data.id)
      .select("id,email,status")
      .single();

    if (error) fail(error, "Unable to update Spark job invitation");
    return data as unknown as Pick<SparkJobInvitation, "id" | "email" | "status">;
  }

  const { data, error } = await supabase
    .from("SparkJobInvitation")
    .insert({
      id: rowId(),
      ...values,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .select("id,email,status")
    .single();

  if (error) fail(error, "Unable to create Spark job invitation");
  return data as unknown as Pick<SparkJobInvitation, "id" | "email" | "status">;
}

export async function updateJobInvitation(
  invitationId: string,
  values: Omit<Partial<SparkJobInvitation>, "id" | "createdAt" | "updatedAt">
) {
  const { error } = await getSparkSupabase()
    .from("SparkJobInvitation")
    .update({
      ...values,
      updatedAt: nowIso(),
    })
    .eq("id", invitationId);

  if (error) fail(error, "Unable to update Spark job invitation");
}

export async function createApplication(
  values: Omit<Partial<SparkApplication>, "id" | "createdAt" | "updatedAt">
): Promise<SparkApplicationWriteResult> {
  const timestamp = nowIso();
  const { data, error } = await getSparkSupabase()
    .from("SparkApplication")
    .insert({
      id: rowId(),
      ...values,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .select("id,status")
    .single();

  if (error) fail(error, "Unable to create Spark application");
  return data as unknown as SparkApplicationWriteResult;
}

export async function updateApplication(
  applicationId: string,
  values: Omit<Partial<SparkApplication>, "id" | "createdAt" | "updatedAt">,
  select = "id,status"
): Promise<SparkApplicationWriteResult> {
  const { data, error } = await getSparkSupabase()
    .from("SparkApplication")
    .update({
      ...values,
      updatedAt: nowIso(),
    })
    .eq("id", applicationId)
    .select(select)
    .single();

  if (error) fail(error, "Unable to update Spark application");
  return data as unknown as SparkApplicationWriteResult;
}

export async function getApplicationForRecruiterAction(
  applicationId: string
): Promise<SparkRecruiterActionApplication | null> {
  const supabase = getSparkSupabase();
  const { data, error } = await supabase
    .from("SparkApplication")
    .select(
      "id,communicationState,interviewMedia,status,postingId,candidateEmail,candidateName,candidatePhone"
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (error) fail(error, "Unable to load Spark application");
  if (!data) return null;

  const postingResponse = await supabase
    .from("SparkJobPosting")
    .select("id,title,slug,clientName,publicUrl")
    .eq("id", data.postingId)
    .maybeSingle();

  if (postingResponse.error) {
    fail(postingResponse.error, "Unable to load Spark application posting");
  }

  return {
    ...data,
    posting: postingResponse.data || null,
  } as unknown as SparkRecruiterActionApplication;
}

export async function getApplicationForDeletion(
  applicationId: string
): Promise<SparkApplicationDeletionSnapshot | null> {
  const supabase = getSparkSupabase();
  const { data, error } = await supabase
    .from("SparkApplication")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) fail(error, "Unable to load Spark application for deletion");
  if (!data) return null;

  const postingResponse = await supabase
    .from("SparkJobPosting")
    .select("id,title,slug,clientName,sourceEntityId,sourceEntityType")
    .eq("id", data.postingId)
    .maybeSingle();

  if (postingResponse.error) {
    fail(postingResponse.error, "Unable to load Spark deletion posting");
  }

  const candidateResponse = data.candidateId
    ? await supabase
        .from("SparkCandidateProfile")
        .select("id,firstName,lastName,email,phone,city,state,country")
        .eq("id", data.candidateId)
        .maybeSingle()
    : { data: null, error: null };

  if (candidateResponse.error) {
    fail(candidateResponse.error, "Unable to load Spark deletion candidate");
  }

  return {
    ...data,
    posting: postingResponse.data || null,
    candidate: candidateResponse.data || null,
  } as unknown as SparkApplicationDeletionSnapshot;
}

export async function deleteApplicationSubmission({
  application,
  note,
  deletedByUserId,
  deletedByEmail,
}: {
  application: SparkApplicationDeletionSnapshot;
  note: string;
  deletedByUserId: string | null;
  deletedByEmail: string | null;
}) {
  const supabase = getSparkSupabase();
  const snapshot = {
    application,
    deletedReason: note,
  } as unknown as JsonValue;
  const logResponse = await supabase
    .from("SparkApplicationDeletionLog")
    .insert({
      id: rowId(),
      applicationId: application.id,
      postingId: application.postingId,
      candidateId: application.candidateId,
      candidateEmail: application.candidateEmail || application.candidate?.email,
      candidateName: application.candidateName,
      applicationStatus: application.status,
      note,
      deletedByUserId,
      deletedByEmail,
      snapshot,
      deletedAt: nowIso(),
    })
    .select("id")
    .single();

  if (logResponse.error) {
    fail(logResponse.error, "Unable to log Spark application deletion");
  }

  const deleteResponse = await supabase
    .from("SparkApplication")
    .delete()
    .eq("id", application.id);

  if (deleteResponse.error) {
    fail(deleteResponse.error, "Unable to delete Spark application");
  }

  return {
    deletionLogId: logResponse.data?.id as string,
  };
}

export async function listRecruiterApplications() {
  const supabase = getSparkSupabase();
  const appsResponse = await supabase
    .from("SparkApplication")
    .select("*")
    .order("updatedAt", { ascending: false })
    .limit(50);

  if (appsResponse.error) {
    fail(appsResponse.error, "Unable to list Spark applications");
  }

  const applications = appsResponse.data || [];
  const postingIds = [...new Set(applications.map((app) => app.postingId))];
  const candidateIds = [
    ...new Set(
      applications
        .map((app) => app.candidateId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const postingsResponse =
    postingIds.length > 0
      ? await supabase
          .from("SparkJobPosting")
          .select("id,title,slug,clientName")
          .in("id", postingIds)
      : { data: [], error: null };

  if (postingsResponse.error) {
    fail(postingsResponse.error, "Unable to load Spark application postings");
  }

  const candidatesResponse =
    candidateIds.length > 0
      ? await supabase
          .from("SparkCandidateProfile")
          .select("id,firstName,lastName,email,phone,city,state")
          .in("id", candidateIds)
      : { data: [], error: null };

  if (candidatesResponse.error) {
    fail(candidatesResponse.error, "Unable to load Spark candidates");
  }

  const postingsById = new Map(
    (postingsResponse.data || []).map((posting) => [posting.id, posting])
  );
  const candidatesById = new Map(
    (candidatesResponse.data || []).map((candidate) => [candidate.id, candidate])
  );

  return applications.map((application) => ({
    ...application,
    posting: postingsById.get(application.postingId) || {
      title: "Unknown Spark posting",
      slug: "missing",
      clientName: null,
    },
    candidate: application.candidateId
      ? candidatesById.get(application.candidateId) || null
      : null,
  })) as unknown as SparkApplicationWithRelations[];
}

export async function getApplicationByInterviewToken(
  token: string
): Promise<SparkInterviewSessionApplication | null> {
  const supabase = getSparkSupabase();
  const appsResponse = await supabase
    .from("SparkApplication")
    .select("*")
    .contains("interviewMedia", { session: { token } })
    .maybeSingle();

  if (appsResponse.error) {
    fail(appsResponse.error, "Unable to load Spark interview session");
  }

  if (!appsResponse.data) return null;

  const postingResponse = await supabase
    .from("SparkJobPosting")
    .select("id,title,slug,clientName")
    .eq("id", appsResponse.data.postingId)
    .maybeSingle();

  if (postingResponse.error) {
    fail(postingResponse.error, "Unable to load Spark interview posting");
  }

  const candidateResponse = appsResponse.data.candidateId
    ? await supabase
        .from("SparkCandidateProfile")
        .select("id,firstName,lastName,email,phone,city,state")
        .eq("id", appsResponse.data.candidateId)
        .maybeSingle()
    : { data: null, error: null };

  if (candidateResponse.error) {
    fail(candidateResponse.error, "Unable to load Spark interview candidate");
  }

  return {
    ...appsResponse.data,
    posting: postingResponse.data || null,
    candidate: candidateResponse.data || null,
  } as unknown as SparkInterviewSessionApplication;
}

export async function listApplicationStatuses(): Promise<
  Array<Pick<SparkApplication, "status">>
> {
  const { data, error } = await getSparkSupabase()
    .from("SparkApplication")
    .select("status");

  if (error) fail(error, "Unable to list Spark application statuses");
  return (data || []) as unknown as Array<Pick<SparkApplication, "status">>;
}
