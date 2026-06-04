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
  | "RecruiterApproved"
  | "InterviewInvited"
  | "InterviewStarted"
  | "InterviewCompleted"
  | "RecruiterReview"
  | "Vetted"
  | "Declined";

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
  "id" | "communicationState" | "status"
>;

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

export type SparkApplicationPosting = Pick<
  SparkJobPosting,
  "id" | "title" | "slug" | "clientName"
>;

export type SparkExistingApplication = Pick<
  SparkApplication,
  "id" | "communicationState"
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
    .select("id,communicationState")
    .eq("postingId", postingId)
    .eq("candidateEmail", candidateEmail)
    .maybeSingle();

  if (error) fail(error, "Unable to check existing Spark application");
  return data as unknown as SparkExistingApplication | null;
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
  const { data, error } = await getSparkSupabase()
    .from("SparkApplication")
    .select("id,communicationState,status")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) fail(error, "Unable to load Spark application");
  return data as unknown as SparkRecruiterActionApplication | null;
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

export async function listApplicationStatuses(): Promise<
  Array<Pick<SparkApplication, "status">>
> {
  const { data, error } = await getSparkSupabase()
    .from("SparkApplication")
    .select("status");

  if (error) fail(error, "Unable to list Spark application statuses");
  return (data || []) as unknown as Array<Pick<SparkApplication, "status">>;
}
