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
