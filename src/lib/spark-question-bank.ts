import type { JsonValue, SparkJobPosting } from "@/lib/spark-db";

export const SPARK_QUESTION_BANK_PAYLOAD_VERSION = "spark.question_bank.v1";
export const SPARK_QUESTION_BANK_PROMPT_VERSION = "spark-question-bank-v1.0";
export const SPARK_QUESTION_BANK_SAFETY_PROFILE =
  "same-bank-no-per-candidate-v1";
export const SPARK_QUESTION_BANK_MCP_SERVER_SLUG =
  "kaizenis_spark_question_agent";
export const SPARK_QUESTION_BANK_MCP_TOOL_NAME = "generate_question_bank";

type QuestionType =
  | "technical"
  | "behavioral"
  | "role_specific"
  | "availability"
  | "safety";

type DraftQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  source: string;
  target_seconds: number;
  editable: boolean;
  rubric: string[];
  ideal_evidence: string[];
  red_flags: string[];
  protected_class_risk: "low" | "review";
  scoring: {
    max_score: number;
    anchors: Record<string, string>;
  };
};

export type SparkQuestionBankDraft = {
  jdSourceHash: string;
  questionCountTarget: number;
  questions: DraftQuestion[];
  sourceSnapshot: JsonValue;
  agentReview: JsonValue;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function compactText(value: string, maxLength = 180) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function uniqueTexts(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function splitTextItems(value: string, maxItems = 6) {
  return uniqueTexts(
    value
      .split(/\r?\n|[.;]\s+/g)
      .map((item) => compactText(item.replace(/^[-*]\s*/, ""), 180))
      .filter((item) => item.length >= 24)
  ).slice(0, maxItems);
}

function normalizeTarget(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(12, Math.max(6, Math.round(parsed)));
}

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rawPayloadQuestionTarget(posting: SparkJobPosting) {
  const rawPayload = jsonObject(posting.rawPayload);
  const spark = jsonObject(rawPayload.spark);
  return (
    spark.ai_question_count_target ||
    rawPayload.ai_question_count_target ||
    rawPayload.question_count_target
  );
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sourceSnapshot(posting: SparkJobPosting) {
  return {
    postingId: posting.id,
    sourceSystem: posting.sourceSystem,
    sourceEntityType: posting.sourceEntityType,
    sourceEntityId: posting.sourceEntityId,
    sourceRevision: posting.sourceRevision,
    title: posting.title,
    overview: posting.overview,
    responsibilities: posting.responsibilities,
    requirements: posting.requirements,
    qualifications: posting.qualifications,
    skills: posting.skills,
    certifications: posting.certifications,
    compliance: {
      socCode: posting.socCode,
      socTitle: posting.socTitle,
      wcCode: posting.wcCode,
      wcDescription: posting.wcDescription,
    },
  };
}

function baseQuestion(
  seedHash: string,
  index: number,
  question: Omit<DraftQuestion, "id" | "editable" | "protected_class_risk" | "scoring">
): DraftQuestion {
  return {
    id: `qb_${seedHash.slice(0, 8)}_${String(index + 1).padStart(2, "0")}`,
    editable: true,
    protected_class_risk: "low",
    scoring: {
      max_score: 5,
      anchors: {
        "1": "Answer is vague, unsupported, or unrelated to the job requirement.",
        "3": "Answer gives relevant experience but limited detail on actions or outcomes.",
        "5": "Answer gives specific job-relevant actions, outcomes, constraints, and reflection.",
      },
    },
    ...question,
  };
}

function roleRubric(sourceLabel: string) {
  return [
    `Explains relevant experience or approach tied to ${sourceLabel}.`,
    "Names concrete actions, tools, decisions, or tradeoffs.",
    "Describes outcome, quality bar, or how success was measured.",
  ];
}

function defaultRedFlags() {
  return [
    "Answer is unrelated to the role or repeats the question.",
    "Answer depends on protected-class information or personal circumstances not needed for the job.",
    "Answer lacks enough job-related detail for recruiter review.",
  ];
}

export async function buildSparkQuestionBankDraft(
  posting: SparkJobPosting,
  requestedTarget?: unknown
): Promise<SparkQuestionBankDraft> {
  const snapshot = sourceSnapshot(posting);
  const seedHash = await sha256Hex(JSON.stringify(snapshot));
  const questionCountTarget = normalizeTarget(
    requestedTarget || rawPayloadQuestionTarget(posting)
  );
  const skills = uniqueTexts((posting.skills || []).map((skill) => compactText(skill, 80)));
  const responsibilities = splitTextItems(cleanText(posting.responsibilities));
  const requirements = splitTextItems(cleanText(posting.requirements));
  const qualifications = splitTextItems(cleanText(posting.qualifications), 4);
  const candidates: Array<Omit<DraftQuestion, "id" | "editable" | "protected_class_risk" | "scoring">> = [];

  skills.slice(0, 3).forEach((skill, index) => {
    candidates.push({
      text: `Describe a recent work situation where you used ${skill}. What was your role, what did you do, and what outcome did you drive?`,
      type: "technical",
      source: `jd.skills[${index}]`,
      target_seconds: 24,
      rubric: roleRubric(skill),
      ideal_evidence: [
        `Specific use of ${skill}`,
        "Candidate role and decision-making",
        "Measurable or observable outcome",
      ],
      red_flags: defaultRedFlags(),
    });
  });

  responsibilities.slice(0, 3).forEach((responsibility, index) => {
    candidates.push({
      text: `Walk through how you would handle this responsibility in the role: ${responsibility}. What would you do first and how would you know it was working?`,
      type: "role_specific",
      source: `jd.responsibilities[${index}]`,
      target_seconds: 24,
      rubric: roleRubric("a listed responsibility"),
      ideal_evidence: [
        "Practical first steps",
        "Awareness of stakeholders or dependencies",
        "Clear success measure",
      ],
      red_flags: defaultRedFlags(),
    });
  });

  requirements.slice(0, 2).forEach((requirement, index) => {
    candidates.push({
      text: `This role calls for ${requirement}. Tell us about your most relevant experience and what support you would need to be effective quickly.`,
      type: "role_specific",
      source: `jd.requirements[${index}]`,
      target_seconds: 24,
      rubric: roleRubric("a stated requirement"),
      ideal_evidence: [
        "Relevant prior work",
        "Honest scope of experience",
        "Reasonable ramp-up needs",
      ],
      red_flags: defaultRedFlags(),
    });
  });

  qualifications.slice(0, 1).forEach((qualification, index) => {
    candidates.push({
      text: `Which part of this qualification best matches your background: ${qualification}? Please give one example from your work experience.`,
      type: "role_specific",
      source: `jd.qualifications[${index}]`,
      target_seconds: 20,
      rubric: roleRubric("a stated qualification"),
      ideal_evidence: [
        "Clear match to qualification",
        "Job-related example",
        "Boundaries of experience",
      ],
      red_flags: defaultRedFlags(),
    });
  });

  candidates.push(
    {
      text: "Tell us about a time you had to stay organized while priorities changed quickly. What did you do and what was the result?",
      type: "behavioral",
      source: "behavioral_bank.organization_under_change",
      target_seconds: 22,
      rubric: roleRubric("organization and adaptability"),
      ideal_evidence: [
        "Prioritization method",
        "Communication with others",
        "Result or lesson learned",
      ],
      red_flags: defaultRedFlags(),
    },
    {
      text: "Describe how you communicate with a team or stakeholder when something will be late, blocked, or different than expected.",
      type: "behavioral",
      source: "behavioral_bank.communication",
      target_seconds: 22,
      rubric: roleRubric("communication and ownership"),
      ideal_evidence: [
        "Proactive communication",
        "Specific audience or stakeholder",
        "Ownership and next steps",
      ],
      red_flags: defaultRedFlags(),
    },
    {
      text: "What is your availability for this role, and are there any job-related scheduling constraints the recruiter should know?",
      type: "availability",
      source: "screening_bank.availability",
      target_seconds: 18,
      rubric: roleRubric("availability and scheduling"),
      ideal_evidence: [
        "Start timing",
        "Schedule fit",
        "Job-related constraints only",
      ],
      red_flags: defaultRedFlags(),
    },
    {
      text: "Is there anything else job-related that would help the recruiter understand your fit for this specific role?",
      type: "role_specific",
      source: "screening_bank.recruiter_context",
      target_seconds: 18,
      rubric: roleRubric("additional job-relevant context"),
      ideal_evidence: [
        "Relevant strengths",
        "Constraints framed in job-related terms",
        "Concise closing context",
      ],
      red_flags: defaultRedFlags(),
    }
  );

  const questions = uniqueTexts(candidates.map((question) => question.text))
    .slice(0, questionCountTarget)
    .map((text, index) => {
      const candidate = candidates.find((question) => question.text === text)!;
      return baseQuestion(seedHash, index, candidate);
    });

  const agentReview: JsonValue = {
    mode: "deterministic_template_v1",
    mcpReady: true,
    mcpServerSlug: SPARK_QUESTION_BANK_MCP_SERVER_SLUG,
    mcpToolName: SPARK_QUESTION_BANK_MCP_TOOL_NAME,
    promptVersion: SPARK_QUESTION_BANK_PROMPT_VERSION,
    safetyProfile: SPARK_QUESTION_BANK_SAFETY_PROFILE,
    guardrails: [
      "Same approved question bank for every applicant to this posting.",
      "No per-candidate personalization in v1.",
      "Questions are tied to JD fields or approved behavioral bank entries.",
      "Scoring is advisory and recruiter-owned.",
    ],
    coverage: {
      skills: Math.min(skills.length, 3),
      responsibilities: Math.min(responsibilities.length, 3),
      requirements: Math.min(requirements.length, 2),
      qualifications: Math.min(qualifications.length, 1),
      behavioral: 2,
      availability: 1,
    },
    watchdogFlags: [
      "Recruiter approval required before use.",
      "Review for local AI hiring notice/audit obligations before production automation.",
    ],
  };

  return {
    jdSourceHash: seedHash,
    questionCountTarget,
    questions,
    sourceSnapshot: snapshot as JsonValue,
    agentReview,
  };
}

// ---------------------------------------------------------------------------
// KaizenIs MCP integration (Phase 1: generate_question_bank)
// Spark's backend calls Roger's pipeline on KaizenIs and maps the structured
// result into the same SparkQuestionBankDraft shape the local generator
// produces, so persistence/approval logic stays unchanged.
// ---------------------------------------------------------------------------

export type SparkQuestionBankMcpResult = {
  draft: SparkQuestionBankDraft;
  mcpRunId: string | null;
  modelName: string | null;
};

function requireMcpEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it to call the KaizenIs generate_question_bank pipeline.`
    );
  }
  return value;
}

function coerceStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

// Roger returns content-only questions. We defensively normalize each one to
// the DraftQuestion shape (the KaizenIs runtime does not validate model output).
function normalizeMcpQuestion(
  raw: unknown,
  seedHash: string,
  index: number
): DraftQuestion {
  const q = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const allowedTypes: QuestionType[] = [
    "technical",
    "behavioral",
    "role_specific",
    "availability",
    "safety",
  ];
  const type = allowedTypes.includes(q.type as QuestionType)
    ? (q.type as QuestionType)
    : "role_specific";

  const scoringRaw = (
    q.scoring && typeof q.scoring === "object" ? q.scoring : {}
  ) as Record<string, unknown>;
  const anchorsRaw = (
    scoringRaw.anchors && typeof scoringRaw.anchors === "object"
      ? scoringRaw.anchors
      : {}
  ) as Record<string, unknown>;
  const anchors: Record<string, string> = {};
  for (const key of ["1", "3", "5"]) {
    if (typeof anchorsRaw[key] === "string") anchors[key] = anchorsRaw[key] as string;
  }

  const targetSeconds = Number(q.target_seconds);
  const maxScore = Number(scoringRaw.max_score);

  return {
    id:
      typeof q.id === "string" && q.id.trim()
        ? q.id
        : `qb_${seedHash.slice(0, 8)}_${String(index + 1).padStart(2, "0")}`,
    text: typeof q.text === "string" ? q.text : "",
    type,
    source: typeof q.source === "string" ? q.source : "jd",
    target_seconds: Number.isFinite(targetSeconds) ? Math.round(targetSeconds) : 24,
    editable: q.editable !== false,
    rubric: coerceStringArray(q.rubric),
    ideal_evidence: coerceStringArray(q.ideal_evidence),
    red_flags: coerceStringArray(q.red_flags),
    // Phase 1: Roger does not yet emit protected_class_risk; default to "low".
    // Phase 2 (bias/PII watchdog agent) will populate "review" where warranted.
    protected_class_risk: q.protected_class_risk === "review" ? "review" : "low",
    scoring: {
      max_score: Number.isFinite(maxScore) ? Math.round(maxScore) : 5,
      anchors:
        Object.keys(anchors).length > 0
          ? anchors
          : {
              "1": "Answer is vague, unsupported, or unrelated to the job requirement.",
              "3": "Answer gives relevant experience but limited detail on actions or outcomes.",
              "5": "Answer gives specific job-relevant actions, outcomes, constraints, and reflection.",
            },
    },
  };
}

export async function fetchSparkQuestionBankDraftFromMcp(
  posting: SparkJobPosting,
  requestedTarget?: unknown
): Promise<SparkQuestionBankMcpResult> {
  const baseUrl = requireMcpEnv("DASHBOARD47_MCP_URL").replace(/\/+$/, "");
  const apiKey = requireMcpEnv("DASHBOARD47_MCP_API_KEY");

  const snapshot = sourceSnapshot(posting);
  const seedHash = await sha256Hex(JSON.stringify(snapshot));
  const questionCountTarget = normalizeTarget(
    requestedTarget || rawPayloadQuestionTarget(posting)
  );

  const input = {
    posting_id: posting.id,
    job_order_id: posting.sourceEntityId,
    title: posting.title,
    client_name: posting.clientName,
    overview: posting.overview,
    responsibilities: posting.responsibilities,
    requirements: posting.requirements,
    qualifications: posting.qualifications,
    skills: posting.skills ?? [],
    certifications: posting.certifications ?? [],
    question_count_target: questionCountTarget,
    source_hash: seedHash,
    prompt_version: SPARK_QUESTION_BANK_PROMPT_VERSION,
  };

  const response = await fetch(
    `${baseUrl}/api/v1/pipelines/generate_question_bank/invoke`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input }),
    }
  );

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    run_id?: string;
    status?: string;
    output?: { type?: string; name?: string; input?: Record<string, unknown> };
    error_code?: string;
    error_message?: string;
  } | null;

  // Fail loud: never silently fall back to the local deterministic generator.
  if (!response.ok || !payload?.ok || payload.status !== "succeeded") {
    const detail =
      payload?.error_message ||
      payload?.error_code ||
      payload?.status ||
      `HTTP ${response.status}`;
    throw new Error(`KaizenIs generate_question_bank failed: ${detail}`);
  }

  if (payload.output?.type !== "tool_use" || !payload.output.input) {
    throw new Error(
      "KaizenIs returned an unexpected output shape (expected a tool_use result)."
    );
  }

  const toolInput = payload.output.input;
  const rawQuestions = Array.isArray(toolInput.questions)
    ? toolInput.questions
    : [];
  if (rawQuestions.length === 0) {
    throw new Error("KaizenIs returned no questions for this job order.");
  }

  const questions = rawQuestions.map((raw, index) =>
    normalizeMcpQuestion(raw, seedHash, index)
  );

  const agentReview: JsonValue = {
    mode: "mcp_roger_question_bank_v1",
    mcpServerSlug: SPARK_QUESTION_BANK_MCP_SERVER_SLUG,
    mcpToolName: SPARK_QUESTION_BANK_MCP_TOOL_NAME,
    mcpRunId: payload.run_id ?? null,
    promptVersion: SPARK_QUESTION_BANK_PROMPT_VERSION,
    safetyProfile: SPARK_QUESTION_BANK_SAFETY_PROFILE,
    coverage: (toolInput.coverage as JsonValue) ?? null,
    recommendation:
      typeof toolInput.recommendation === "string"
        ? toolInput.recommendation
        : null,
    guardrails: [
      "Same approved question bank for every applicant to this posting.",
      "No per-candidate personalization in v1.",
      "Questions generated from job-order fields by Roger (KaizenIs).",
      "Scoring is advisory and recruiter-owned.",
    ],
    watchdogFlags: [
      "Recruiter approval required before use.",
      "protected_class_risk defaults to low until the bias/PII watchdog agent ships (phase 2).",
    ],
  };

  return {
    draft: {
      jdSourceHash: seedHash,
      questionCountTarget,
      questions,
      sourceSnapshot: snapshot as JsonValue,
      agentReview,
    },
    mcpRunId: payload.run_id ?? null,
    modelName: "roger:question-bank-v1.0",
  };
}
