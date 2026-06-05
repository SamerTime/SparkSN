import { NextRequest, NextResponse } from "next/server";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import {
  approveQuestionBank,
  createQuestionBankAuditEvent,
  getQuestionBankForPosting,
  type JsonValue,
} from "@/lib/spark-db";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
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
    const body = await request.json();
    const questionBankId = stringValue(body.questionBankId);

    if (!questionBankId) {
      return NextResponse.json(
        { success: false, error: "questionBankId is required." },
        { status: 400 }
      );
    }

    const existing = await getQuestionBankForPosting(postingId, questionBankId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Question bank not found." },
        { status: 404 }
      );
    }

    const questionCount = arrayValue(existing.questions).length;
    if (questionCount < 3) {
      return NextResponse.json(
        {
          success: false,
          error: "At least three questions are required before approval.",
        },
        { status: 400 }
      );
    }

    const approved = await approveQuestionBank(
      postingId,
      questionBankId,
      recruiter.id
    );

    await createQuestionBankAuditEvent({
      questionBankId,
      postingId,
      eventType: "question_bank_approved",
      actorType: "recruiter",
      actorId: recruiter.id,
      beforeJson: {
        status: existing.status,
        questionCount,
      } as JsonValue,
      afterJson: {
        status: approved.status,
        approvedByUserId: recruiter.id,
        approvedAt: approved.approvedAt,
        questionCount: arrayValue(approved.questions).length,
      } as JsonValue,
    });

    return NextResponse.json({
      success: true,
      questionBank: approved,
    });
  } catch (error) {
    console.error("Spark question bank approve error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to approve the Spark question bank." },
      { status: 500 }
    );
  }
}
