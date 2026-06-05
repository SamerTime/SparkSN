import type {
  JsonValue,
  SparkCandidateProfile,
  SparkJobPosting,
  SparkQuestionBank,
} from "@/lib/spark-db";
import {
  buildSparkQuestionBankDraft,
  fetchSparkQuestionBankDraftFromMcp,
  SPARK_QUESTION_BANK_MCP_SERVER_SLUG,
  SPARK_QUESTION_BANK_MCP_TOOL_NAME,
  SPARK_QUESTION_BANK_PROMPT_VERSION,
  SPARK_QUESTION_BANK_SAFETY_PROFILE,
  type DraftQuestion,
  type SparkQuestionBankDraft,
} from "@/lib/spark-question-bank";

export const ROGER_MCP_SERVER_SLUG =
  process.env.ROGER_MCP_SERVER_SLUG?.trim() ||
  SPARK_QUESTION_BANK_MCP_SERVER_SLUG;
export const ROGER_MCP_GENERATE_QUESTION_BANK_TOOL =
  process.env.ROGER_MCP_GENERATE_QUESTION_BANK_TOOL?.trim() ||
  SPARK_QUESTION_BANK_MCP_TOOL_NAME;
export const ROGER_MCP_REVIEW_SCREENING_TOOL =
  process.env.ROGER_MCP_REVIEW_SCREENING_TOOL?.trim() ||
  "review_interview_answers";
export const ROGER_MCP_REVIEW_BUILD_TOOL =
  process.env.ROGER_MCP_REVIEW_BUILD_TOOL?.trim() || "review_spark_build";

const ROGER_MCP_TIMEOUT_MS = 10_000;

type RogerCallResult = {
  ok: boolean;
  disabled?: boolean;
  data?: Record<string, unknown>;
  runId: string | null;
  modelName: string | null;
  error?: string;
};

type ScreeningAnswer = {
  question: string;
  answer: string;
  questionId?: string;
  source?: string;
  type?: string;
  targetSeconds?: number | null;
};

export type QuestionBankGenerationResult = {
  draft: SparkQuestionBankDraft;
  generatedBy: "ai" | "mcp";
  mcpRunId: string | null;
  modelName: string;
  rogerUsed: boolean;
  rogerFallbackReason: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => cleanText(item))
        .filter(Boolean)
    : [];
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolValue(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function rogerEndpoint() {
  return (
    process.env.ROGER_MCP_ENDPOINT?.trim() ||
    process.env.KAIZENIS_ROGER_MCP_ENDPOINT?.trim() ||
    process.env.KAIZENIS_MCP_ENDPOINT?.trim() ||
    ""
  );
}

function rogerToken() {
  return (
    process.env.ROGER_MCP_CONSUMER_KEY?.trim() ||
    process.env.ROGER_MCP_TOKEN?.trim() ||
    process.env.KAIZENIS_MCP_CONSUMER_KEY?.trim() ||
    process.env.KAIZENIS_MCP_TOKEN?.trim() ||
    ""
  );
}

function dashboard47QuestionBankConfigured() {
  return Boolean(
    process.env.DASHBOARD47_MCP_URL?.trim() &&
      process.env.DASHBOARD47_MCP_API_KEY?.trim()
  );
}

function parseJsonText(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractToolData(response: unknown) {
  const root = jsonObject(response);
  const result = jsonObject(root.result);
  const structuredContent = jsonObject(result.structuredContent);
  if (Object.keys(structuredContent).length > 0) return structuredContent;

  const data = jsonObject(root.data);
  if (Object.keys(data).length > 0) return data;

  const resultData = jsonObject(result.data);
  if (Object.keys(resultData).length > 0) return resultData;

  const content = Array.isArray(result.content) ? result.content : [];
  for (const item of content) {
    const contentItem = jsonObject(item);
    const parsed = parseJsonText(cleanText(contentItem.text));
    const parsedObject = jsonObject(parsed);
    if (Object.keys(parsedObject).length > 0) return parsedObject;
  }

  if (Object.keys(result).length > 0) return result;
  return root;
}

function extractRunId(response: unknown, data: Record<string, unknown>) {
  const root = jsonObject(response);
  const result = jsonObject(root.result);
  return (
    cleanText(data.mcpRunId) ||
    cleanText(data.runId) ||
    cleanText(data.run_id) ||
    cleanText(result.mcpRunId) ||
    cleanText(result.runId) ||
    null
  );
}

async function callRogerTool(
  toolName: string,
  payload: Record<string, unknown>
): Promise<RogerCallResult> {
  const endpoint = rogerEndpoint();
  const token = rogerToken();

  if (!endpoint || !token) {
    return {
      ok: false,
      disabled: true,
      runId: null,
      modelName: null,
      error: "Roger MCP is not configured.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: payload,
        },
      }),
      signal: AbortSignal.timeout(ROGER_MCP_TIMEOUT_MS),
    });

    const responseJson = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        runId: null,
        modelName: null,
        error: `Roger MCP returned ${response.status}.`,
      };
    }

    const data = extractToolData(responseJson);
    return {
      ok: true,
      data,
      runId: extractRunId(responseJson, data),
      modelName:
        cleanText(data.modelName) ||
        cleanText(data.model) ||
        cleanText(jsonObject(responseJson).model) ||
        "roger-mcp",
    };
  } catch (error) {
    return {
      ok: false,
      runId: null,
      modelName: null,
      error:
        error instanceof Error
          ? error.message
          : "Roger MCP request failed.",
    };
  }
}

function sourceCategory(source: string) {
  if (source.includes("skills")) return "JD skill";
  if (source.includes("responsibilities")) return "Responsibility";
  if (source.includes("requirements")) return "Requirement";
  if (source.includes("qualifications")) return "Qualification";
  if (source.includes("behavioral")) return "Behavioral bank";
  if (source.includes("availability")) return "Availability";
  if (source.includes("roger")) return "Roger";
  return "Question bank";
}

function questionType(value: unknown, fallback: DraftQuestion["type"]) {
  const normalized = cleanText(value).toLowerCase();
  if (
    normalized === "technical" ||
    normalized === "behavioral" ||
    normalized === "role_specific" ||
    normalized === "availability" ||
    normalized === "safety"
  ) {
    return normalized as DraftQuestion["type"];
  }

  return fallback;
}

function normalizeRogerQuestion(
  value: unknown,
  index: number,
  fallback: DraftQuestion | undefined,
  mcpRunId: string | null
): DraftQuestion | null {
  const item = jsonObject(value);
  const text = cleanText(item.text) || cleanText(item.question);
  if (!text) return null;

  const source =
    cleanText(item.source) || fallback?.source || "roger.question_bank";
  const targetSeconds =
    numberValue(item.target_seconds) ||
    numberValue(item.targetSeconds) ||
    fallback?.target_seconds ||
    60;
  const scoring = jsonObject(item.scoring);

  return {
    id: cleanText(item.id) || fallback?.id || `roger_q_${index + 1}`,
    text,
    type: questionType(item.type, fallback?.type || "role_specific"),
    source,
    target_seconds: Math.min(90, Math.max(30, Math.round(targetSeconds))),
    editable: boolValue(item.editable, true),
    rubric: stringArray(item.rubric).length
      ? stringArray(item.rubric)
      : fallback?.rubric || [],
    ideal_evidence:
      stringArray(item.ideal_evidence).length > 0
        ? stringArray(item.ideal_evidence)
        : stringArray(item.idealEvidence).length > 0
          ? stringArray(item.idealEvidence)
          : fallback?.ideal_evidence || [],
    red_flags:
      stringArray(item.red_flags).length > 0
        ? stringArray(item.red_flags)
        : stringArray(item.redFlags).length > 0
          ? stringArray(item.redFlags)
          : fallback?.red_flags || [],
    protected_class_risk:
      cleanText(item.protected_class_risk) === "review" ? "review" : "low",
    scoring:
      Object.keys(scoring).length > 0
        ? (scoring as DraftQuestion["scoring"])
        : fallback?.scoring || {
            max_score: 5,
            anchors: {
              "1": "Answer is vague, unsupported, or unrelated.",
              "3": "Answer gives relevant experience with limited detail.",
              "5": "Answer gives specific job-related actions and outcomes.",
            },
          },
    generated_by: "roger_mcp",
    generator_label: "Roger",
    source_label: cleanText(item.source_label) || sourceCategory(source),
    source_category: sourceCategory(source),
    mcp_run_id: mcpRunId,
  };
}

function normalizeRogerQuestions(
  data: Record<string, unknown>,
  fallbackQuestions: DraftQuestion[],
  mcpRunId: string | null
) {
  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
  const normalized = rawQuestions
    .map((question, index) =>
      normalizeRogerQuestion(question, index, fallbackQuestions[index], mcpRunId)
    )
    .filter((question): question is DraftQuestion => Boolean(question));

  return normalized.length >= 3 ? normalized : null;
}

function sparkBuildContext() {
  return {
    product: "StaffingNation Spark",
    workflow:
      "Published job order -> recruiter-approved screening question bank -> candidate recorded phone screening -> recruiter review.",
    boundaries: [
      "Questions are generated per job order, not per candidate.",
      "Recruiter approval is required before screening use.",
      "Roger insights support recruiter review and must not make hiring decisions.",
      "Candidate profiles stay in Spark for now; vetted return-to-StaffingNation is future scope.",
    ],
    reviewRequest:
      "Please flag ATS/interview workflow gaps, recruiter usability issues, and bias/compliance risks in optional build_review_notes.",
  };
}

function optionalObject(...values: unknown[]) {
  for (const value of values) {
    const object = jsonObject(value);
    if (Object.keys(object).length > 0) return object;
  }

  return null;
}

function withRogerQuestionMetadata(
  draft: SparkQuestionBankDraft,
  mcpRunId: string | null,
  modelName: string | null
): SparkQuestionBankDraft {
  return {
    ...draft,
    questions: draft.questions.map((question) => ({
      ...question,
      generated_by: "roger_mcp",
      generator_label: "Roger",
      source_label: question.source_label || sourceCategory(question.source),
      source_category:
        question.source_category || sourceCategory(question.source),
      mcp_run_id: mcpRunId,
    })),
    agentReview: {
      ...jsonObject(draft.agentReview),
      roger: {
        status: "used",
        mcpRunId,
        toolName: ROGER_MCP_GENERATE_QUESTION_BANK_TOOL,
        modelName,
      },
    } as JsonValue,
  };
}

export async function generateQuestionBankWithRoger(
  posting: SparkJobPosting,
  requestedTarget?: unknown
): Promise<QuestionBankGenerationResult> {
  const fallbackDraft = await buildSparkQuestionBankDraft(
    posting,
    requestedTarget
  );
  const dashboard47Error: string | null = null;

  if (dashboard47QuestionBankConfigured()) {
    try {
      const result = await fetchSparkQuestionBankDraftFromMcp(
        posting,
        requestedTarget
      );

      return {
        draft: withRogerQuestionMetadata(
          result.draft,
          result.mcpRunId,
          result.modelName
        ),
        generatedBy: "mcp",
        mcpRunId: result.mcpRunId,
        modelName: result.modelName || "roger:question-bank-v1.0",
        rogerUsed: true,
        rogerFallbackReason: null,
      };
    } catch (error) {
      // Fail loud: Roger is the configured generator, so a failure must surface
      // to the recruiter rather than silently falling back to the deterministic
      // template (per the no-silent-fallback rule).
      throw new Error(
        `Roger question-bank generation failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  const roger = await callRogerTool(ROGER_MCP_GENERATE_QUESTION_BANK_TOOL, {
    payloadVersion: "spark.roger.question_bank_request.v1",
    promptVersion: SPARK_QUESTION_BANK_PROMPT_VERSION,
    safetyProfile: SPARK_QUESTION_BANK_SAFETY_PROFILE,
    questionCountTarget: fallbackDraft.questionCountTarget,
    sourceSnapshot: fallbackDraft.sourceSnapshot,
    fallbackQuestionBank: fallbackDraft.questions,
    sparkBuildContext: sparkBuildContext(),
    requiredOutput: [
      "questions",
      "agentReview",
      "modelName",
      "mcpRunId",
      "optional build_review_notes",
    ],
  });

  if (!roger.ok || !roger.data) {
    return {
      draft: {
        ...fallbackDraft,
        agentReview: {
          ...jsonObject(fallbackDraft.agentReview),
          roger: {
            status: roger.disabled ? "not_configured" : "fallback",
            reason:
              dashboard47Error ||
              roger.error ||
              "Roger MCP unavailable.",
          },
        } as JsonValue,
      },
      generatedBy: "ai",
      mcpRunId: null,
      modelName: "deterministic-template-v1",
      rogerUsed: false,
      rogerFallbackReason:
        dashboard47Error || roger.error || "Roger MCP unavailable.",
    };
  }

  const rogerQuestions = normalizeRogerQuestions(
    roger.data,
    fallbackDraft.questions,
    roger.runId
  );
  if (!rogerQuestions) {
    return {
      draft: {
        ...fallbackDraft,
        agentReview: {
          ...jsonObject(fallbackDraft.agentReview),
          roger: {
            status: "fallback",
            reason: "Roger did not return at least three valid questions.",
            mcpRunId: roger.runId,
          },
        } as JsonValue,
      },
      generatedBy: "ai",
      mcpRunId: roger.runId,
      modelName: roger.modelName || "roger-mcp",
      rogerUsed: false,
      rogerFallbackReason:
        "Roger did not return at least three valid questions.",
    };
  }

  return {
    draft: {
      ...fallbackDraft,
      questions: rogerQuestions.slice(0, fallbackDraft.questionCountTarget),
      agentReview: {
        ...jsonObject(fallbackDraft.agentReview),
        ...jsonObject(roger.data.agentReview),
        mode: "roger_mcp_v1",
        mcpReady: true,
        roger: {
          status: "used",
          mcpRunId: roger.runId,
          toolName: ROGER_MCP_GENERATE_QUESTION_BANK_TOOL,
          modelName: roger.modelName,
        },
        buildReviewNotes: optionalObject(
          roger.data.build_review_notes,
          roger.data.buildReviewNotes
        ),
      } as JsonValue,
    },
    generatedBy: "mcp",
    mcpRunId: roger.runId,
    modelName: roger.modelName || "roger-mcp",
    rogerUsed: true,
    rogerFallbackReason: null,
  };
}

export function createFallbackScreeningSummary(
  answers: ScreeningAnswer[],
  postingTitle: string,
  recordingSeconds: number | null
) {
  const answerText = answers.map((item) => item.answer).join(" ");
  const shortAnswerCount = answers.filter((item) => item.answer.length < 35).length;
  const availabilityAnswer =
    answers.find((item) => /availability|scheduling/i.test(item.question))?.answer ||
    "";
  const supportAnswer =
    answers.find((item) => /support|ramp/i.test(item.question))?.answer || "";

  return {
    status: "completed",
    generatedBy: "spark_rules_v1",
    summary:
      answerText.length > 0
        ? `Candidate completed a short screening for ${postingTitle}. Responses covered role fit, work style, availability, communication, reliability, and ramp-up needs. Recruiter should review the full answers before making a decision.`
        : `Candidate completed the screening for ${postingTitle}, but answer content was limited.`,
    recruiterFocus: [
      availabilityAnswer
        ? `Availability/scheduling: ${availabilityAnswer}`
        : "Confirm availability and schedule fit.",
      supportAnswer
        ? `Ramp-up/support: ${supportAnswer}`
        : "Confirm onboarding support needed.",
      shortAnswerCount > 2
        ? "Several answers were brief; recruiter may want follow-up questions."
        : "Answers appear complete enough for recruiter review.",
    ],
    nonBiasNotice:
      "Summary intentionally avoids protected-class assumptions and should be used only as recruiter review support.",
    answerCount: answers.length,
    recordingSeconds,
    completedAt: new Date().toISOString(),
  };
}

export async function reviewScreeningWithRoger({
  applicationId,
  posting,
  candidate,
  answers,
  questionBank,
  recordingSeconds,
  recordingCaptured,
  browser,
  deviceSignals,
  locationSignals,
}: {
  applicationId: string;
  posting: Pick<SparkJobPosting, "id" | "title" | "clientName">;
  candidate: Pick<
    SparkCandidateProfile,
    "firstName" | "lastName" | "email" | "city" | "state"
  > | null;
  answers: ScreeningAnswer[];
  questionBank: SparkQuestionBank | null;
  recordingSeconds: number | null;
  recordingCaptured: boolean;
  browser: JsonValue;
  deviceSignals: JsonValue;
  locationSignals: JsonValue;
}) {
  const fallback = createFallbackScreeningSummary(
    answers,
    posting.title,
    recordingSeconds
  );

  const roger = await callRogerTool(ROGER_MCP_REVIEW_SCREENING_TOOL, {
    payloadVersion: "spark.roger.screening_review_request.v1",
    applicationId,
    posting,
    candidate,
    approvedQuestionBank: questionBank
      ? {
          id: questionBank.id,
          status: questionBank.status,
          generatedBy: questionBank.generatedBy,
          mcpRunId: questionBank.mcpRunId,
          questions: questionBank.questions,
          agentReview: questionBank.agentReview,
        }
      : null,
    answers,
    recording: {
      captured: recordingCaptured,
      durationSeconds: recordingSeconds,
    },
    signals: {
      browser,
      deviceSignals,
      locationSignals,
    },
    sparkBuildContext: sparkBuildContext(),
    requiredOutput: [
      "summary",
      "recruiterFocus",
      "strengths",
      "concerns",
      "followUpQuestions",
      "nonBiasNotice",
      "mcpRunId",
    ],
  });

  if (!roger.ok || !roger.data) {
    return {
      ...fallback,
      roger: {
        status: roger.disabled ? "not_configured" : "fallback",
        reason: roger.error || "Roger MCP unavailable.",
      },
    } as JsonValue;
  }

  const summary = cleanText(roger.data.summary);
  if (!summary) {
    return {
      ...fallback,
      roger: {
        status: "fallback",
        reason: "Roger response did not include a summary.",
        mcpRunId: roger.runId,
      },
    } as JsonValue;
  }

  return {
    status: "completed",
    generatedBy: "roger_mcp_v1",
    summary,
    recruiterFocus:
      stringArray(roger.data.recruiterFocus).length > 0
        ? stringArray(roger.data.recruiterFocus)
        : fallback.recruiterFocus,
    strengths: stringArray(roger.data.strengths),
    concerns: stringArray(roger.data.concerns),
    followUpQuestions:
      stringArray(roger.data.followUpQuestions).length > 0
        ? stringArray(roger.data.followUpQuestions)
        : stringArray(roger.data.follow_up_questions),
    nonBiasNotice:
      cleanText(roger.data.nonBiasNotice) ||
      cleanText(roger.data.non_bias_notice) ||
      fallback.nonBiasNotice,
    answerCount: answers.length,
    recordingSeconds,
    completedAt: new Date().toISOString(),
    mcpServerSlug: ROGER_MCP_SERVER_SLUG,
    mcpToolName: ROGER_MCP_REVIEW_SCREENING_TOOL,
    mcpRunId: roger.runId,
    modelName: roger.modelName || "roger-mcp",
    roger: {
      status: "used",
      mcpRunId: roger.runId,
      toolName: ROGER_MCP_REVIEW_SCREENING_TOOL,
      modelName: roger.modelName,
    },
    buildReviewNotes: optionalObject(
      roger.data.build_review_notes,
      roger.data.buildReviewNotes
    ),
  } as JsonValue;
}

// ---------------------------------------------------------------------------
// Stage 2: per-candidate analysis via the KaizenIs analyze_responses pipeline.
// Validates completeness and retries, then fails loud (no silent fallback).
// ---------------------------------------------------------------------------

export type RogerAnalysis = {
  candidate_summary: string;
  fit_assessment?: Array<{
    skill_or_requirement: string;
    evidence_summary: string;
    rating: string;
    confidence: string;
  }>;
  in_person_focus_areas: Array<{
    area: string;
    why: string;
    suggested_probe: string;
  }>;
  recommended_next_step: string;
  bias_notice: string;
};

export type AnalyzeResponsesInput = {
  posting_id: string;
  job_order_id: string;
  application_id: string;
  question_bank_id: string | null;
  title: string;
  overview: string | null;
  responsibilities: string | null;
  requirements: string | null;
  qualifications: string | null;
  skills: string[];
  responses: Array<{
    question_id?: string;
    question_text: string;
    answer_text: string;
    duration_seconds?: number;
  }>;
};

export type AnalyzeResponsesResult = {
  analysis: RogerAnalysis;
  mcpRunId: string | null;
  modelName: string | null;
};

function requireDashboard47Env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it to call the KaizenIs analyze_responses pipeline.`
    );
  }
  return value;
}

function analysisIsComplete(value: unknown): value is RogerAnalysis {
  const a = jsonObject(value);
  return (
    cleanText(a.candidate_summary).length > 0 &&
    Array.isArray(a.in_person_focus_areas) &&
    a.in_person_focus_areas.length === 3 &&
    cleanText(a.recommended_next_step).length > 0
  );
}

export async function analyzeResponsesWithRoger(
  input: AnalyzeResponsesInput
): Promise<AnalyzeResponsesResult> {
  const baseUrl = requireDashboard47Env("DASHBOARD47_MCP_URL").replace(/\/+$/, "");
  const apiKey = requireDashboard47Env("DASHBOARD47_MCP_API_KEY");
  const endpoint = `${baseUrl}/api/v1/pipelines/analyze_responses/invoke`;

  // The analyze_responses model intermittently drops array fields; validate and
  // retry up to 3 times before failing loud, so a recruiter never sees a blank
  // analysis and we never silently fall back to a non-Roger summary.
  let lastReason = "no attempts made";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        run_id?: string;
        status?: string;
        output?: { type?: string; input?: Record<string, unknown> };
        error_code?: string;
        error_message?: string;
      } | null;

      if (!response.ok || !payload?.ok || payload.status !== "succeeded") {
        lastReason =
          payload?.error_message ||
          payload?.error_code ||
          payload?.status ||
          `HTTP ${response.status}`;
        continue;
      }

      if (payload.output?.type !== "tool_use" || !payload.output.input) {
        lastReason = "unexpected output shape (expected tool_use)";
        continue;
      }

      const candidate = payload.output.input;
      if (!analysisIsComplete(candidate)) {
        lastReason =
          "incomplete analysis (missing summary, three focus areas, or next step)";
        continue;
      }

      return {
        analysis: candidate,
        mcpRunId: cleanText(payload.run_id) || null,
        modelName: "roger:analyze-responses-v1.0",
      };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "request failed";
    }
  }

  throw new Error(
    `Roger response analysis failed after 3 attempts: ${lastReason}`
  );
}
