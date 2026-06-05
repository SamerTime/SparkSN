import { NextRequest, NextResponse } from "next/server";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import {
  createQuestionBank,
  createQuestionBankAuditEvent,
  getPublishedJobById,
  retireQuestionBanksForPosting,
  type JsonValue,
} from "@/lib/spark-db";
import {
  SPARK_QUESTION_BANK_PAYLOAD_VERSION,
  SPARK_QUESTION_BANK_PROMPT_VERSION,
  SPARK_QUESTION_BANK_SAFETY_PROFILE,
} from "@/lib/spark-question-bank";
import {
  generateQuestionBankWithRoger,
  ROGER_MCP_GENERATE_QUESTION_BANK_TOOL,
  ROGER_MCP_SERVER_SLUG,
} from "@/lib/spark-roger";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postingId: string }> }
) {
  try {
    const recruiter = await getSparkRecruiterUser();
    if (!recruiter) {
      return NextResponse.json(
        { success: false, error: "Recruiter login required." },
        { status: 401 }
      );
    }

    const { postingId } = await params;
    const body = await request.json().catch(() => ({}));
    const posting = await getPublishedJobById(postingId);

    if (!posting) {
      return NextResponse.json(
        { success: false, error: "Published job order not found." },
        { status: 404 }
      );
    }

    const generation = await generateQuestionBankWithRoger(
      posting,
      numberValue(body.questionCountTarget)
    );
    const draft = generation.draft;

    await retireQuestionBanksForPosting(posting.id, ["Draft"]);

    const questionBank = await createQuestionBank({
      postingId: posting.id,
      jobOrderId: posting.sourceEntityId,
      jdSourceHash: draft.jdSourceHash,
      payloadVersion: SPARK_QUESTION_BANK_PAYLOAD_VERSION,
      status: "Draft",
      questionCountTarget: draft.questionCountTarget,
      generatedBy: generation.generatedBy,
      generatedAt: new Date().toISOString(),
      mcpServerSlug: ROGER_MCP_SERVER_SLUG,
      mcpToolName: ROGER_MCP_GENERATE_QUESTION_BANK_TOOL,
      mcpRunId: generation.mcpRunId,
      modelName: generation.modelName,
      promptVersion: SPARK_QUESTION_BANK_PROMPT_VERSION,
      safetyProfile: SPARK_QUESTION_BANK_SAFETY_PROFILE,
      sourceSnapshot: draft.sourceSnapshot,
      questions: draft.questions as unknown as JsonValue,
      agentReview: draft.agentReview,
    });

    await createQuestionBankAuditEvent({
      questionBankId: questionBank.id,
      postingId: posting.id,
      eventType: "question_bank_generated",
      actorType: "recruiter",
      actorId: recruiter.id,
      beforeJson: null,
      afterJson: {
        status: questionBank.status,
        questionCount: draft.questions.length,
        jdSourceHash: draft.jdSourceHash,
        promptVersion: SPARK_QUESTION_BANK_PROMPT_VERSION,
        generatedBy: generation.generatedBy,
        mcpServerSlug: ROGER_MCP_SERVER_SLUG,
        mcpToolName: ROGER_MCP_GENERATE_QUESTION_BANK_TOOL,
        mcpRunId: generation.mcpRunId,
        rogerUsed: generation.rogerUsed,
        rogerFallbackReason: generation.rogerFallbackReason,
      } as JsonValue,
    });

    return NextResponse.json({
      success: true,
      questionBank,
    });
  } catch (error) {
    console.error("Spark question bank generate error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to generate the Spark question bank." },
      { status: 500 }
    );
  }
}
