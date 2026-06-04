import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationForRecruiterAction,
  type JsonValue,
  updateApplication,
} from "@/lib/spark-db";

type ActionConfig = {
  status?: "RecruiterApproved" | "InterviewInvited" | "Declined" | "RecruiterReview";
  eventType: string;
  label: string;
  messagePreview: string;
  channel: string;
};

const ACTIONS: Record<string, ActionConfig> = {
  approve: {
    status: "RecruiterApproved",
    eventType: "recruiter_approved",
    label: "Candidate approved",
    channel: "internal",
    messagePreview:
      "Candidate approved for next recruiter step. Interview invite can be sent when ready.",
  },
  invite_interview: {
    status: "InterviewInvited",
    eventType: "interview_invite_queued",
    label: "Interview invite queued",
    channel: "candidate",
    messagePreview:
      "Spark interview invite is queued for Courier SMS/email once Courier is connected.",
  },
  decline: {
    status: "Declined",
    eventType: "candidate_declined",
    label: "Candidate declined",
    channel: "candidate",
    messagePreview:
      "Decline communication is queued for Courier once messaging templates are connected.",
  },
  review: {
    status: "RecruiterReview",
    eventType: "recruiter_review",
    label: "Recruiter review continued",
    channel: "internal",
    messagePreview: "Recruiter notes were updated while this candidate remains in review.",
  },
  save_notes: {
    eventType: "notes_saved",
    label: "Recruiter notes saved",
    channel: "internal",
    messagePreview: "Recruiter notes updated.",
  },
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function appendEvent(current: unknown, event: Record<string, unknown>) {
  const state = jsonObject(current);
  const existingEvents = Array.isArray(state.events) ? state.events : [];

  return {
    ...state,
    courier: {
      enabled: false,
      plannedTemplates: [
        "spark_application_received",
        "spark_recruiter_review_needed",
        "spark_interview_invite",
        "spark_candidate_decline",
      ],
    },
    events: [...existingEvents, event],
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params;
    const body = await request.json();
    const action = stringValue(body.action);
    const recruiterNotes = stringValue(body.recruiterNotes);
    const config = ACTIONS[action];

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Unknown recruiter action." },
        { status: 400 }
      );
    }

    const application = await getApplicationForRecruiterAction(applicationId);

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found." },
        { status: 404 }
      );
    }

    const communicationState = appendEvent(application.communicationState, {
      type: config.eventType,
      label: config.label,
      at: new Date().toISOString(),
      channel: config.channel,
      messagePreview: config.messagePreview,
    });

    const updated = await updateApplication(
      applicationId,
      {
        ...(config.status ? { status: config.status } : {}),
        recruiterNotes,
        communicationState: communicationState as JsonValue,
      },
      "id,status,recruiterNotes"
    );

    return NextResponse.json({
      success: true,
      application: updated,
    });
  } catch (error) {
    console.error("Spark recruiter action error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to update the Spark application." },
      { status: 500 }
    );
  }
}
