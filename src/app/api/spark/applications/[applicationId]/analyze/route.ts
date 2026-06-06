import { NextRequest, NextResponse } from "next/server";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import {
  getApplicationForAnalysis,
  getApprovedQuestionBankForPosting,
  getPublishedJobById,
  updateApplication,
  type JsonValue,
} from "@/lib/spark-db";
import { analyzeResponsesWithRoger } from "@/lib/spark-roger";

// Map the stored interview transcript ({ answers: [{ question, answer }] }) into
// the shape analyze_responses expects.
function transcriptResponses(transcript: unknown) {
  const root =
    transcript && typeof transcript === "object"
      ? (transcript as Record<string, unknown>)
      : {};
  const answers = Array.isArray(root.answers) ? root.answers : [];
  return answers
    .map((entry) => {
      const obj =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};
      return {
        question_text: typeof obj.question === "string" ? obj.question : "",
        answer_text: typeof obj.answer === "string" ? obj.answer : "",
      };
    })
    .filter((r) => r.answer_text.trim().length > 0);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const recruiter = await getSparkRecruiterUser();
    if (!recruiter) {
      return NextResponse.json(
        { success: false, error: "Recruiter login required." },
        { status: 401 }
      );
    }

    const { applicationId } = await params;
    const application = await getApplicationForAnalysis(applicationId);
    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found." },
        { status: 404 }
      );
    }

    const posting = await getPublishedJobById(application.postingId);
    if (!posting) {
      return NextResponse.json(
        { success: false, error: "Job order for this application was not found." },
        { status: 404 }
      );
    }

    const responses = transcriptResponses(application.interviewTranscript);
    if (responses.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No completed interview answers to analyze yet.",
        },
        { status: 400 }
      );
    }

    const approvedBank = await getApprovedQuestionBankForPosting(
      application.postingId
    );

    // Fail loud: analyzeResponsesWithRoger validates + retries, and throws if
    // Roger cannot return a complete analysis (no silent fallback).
    const { analysis, mcpRunId, modelName } = await analyzeResponsesWithRoger({
      posting_id: posting.id,
      job_order_id: posting.sourceEntityId,
      application_id: applicationId,
      question_bank_id: approvedBank?.id ?? null,
      title: posting.title,
      overview: posting.overview,
      responsibilities: posting.responsibilities,
      requirements: posting.requirements,
      qualifications: posting.qualifications,
      skills: posting.skills ?? [],
      responses,
    });

    const aiSummary = {
      status: "completed",
      generatedBy: "roger_mcp_v1",
      mcpServerSlug: "kaizenis_spark_question_agent",
      mcpToolName: "analyze_responses",
      mcpRunId,
      modelName,
      analyzedByUserId: recruiter.id,
      analyzedAt: new Date().toISOString(),
      ...analysis,
    } as unknown as JsonValue;

    await updateApplication(applicationId, { aiSummary }, "id,status");

    return NextResponse.json({ success: true, analysis, mcpRunId });
  } catch (error) {
    console.error("Spark analyze responses error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze the candidate's responses.",
      },
      { status: 500 }
    );
  }
}
