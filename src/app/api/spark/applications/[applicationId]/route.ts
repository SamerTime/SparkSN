import { NextRequest, NextResponse } from "next/server";
import {
  getApplicationForRecruiterAction,
  type JsonValue,
  updateApplication,
} from "@/lib/spark-db";
import {
  sendSparkInterviewInvite,
  type SparkNotificationSendResult,
} from "@/lib/spark-notifications";

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
    eventType: "interview_invite_sent",
    label: "Interview invite sent",
    channel: "candidate",
    messagePreview:
      "Spark interview instructions were sent through Courier and Postmark.",
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

function appendEvent(
  current: unknown,
  event: Record<string, unknown>,
  courierEnabled = false
) {
  const state = jsonObject(current);
  const existingEvents = Array.isArray(state.events) ? state.events : [];
  const existingCourier = jsonObject(state.courier);

  return {
    ...state,
    courier: {
      ...existingCourier,
      enabled: Boolean(existingCourier.enabled) || courierEnabled,
      provider: "courier",
      downstreamProvider: "postmark",
      fromEmail: "tasky@tcwglobal.com",
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

function publicJobUrl(
  request: NextRequest,
  slug: string,
  publicUrl?: string | null
) {
  if (publicUrl) return publicUrl;
  return `${new URL(request.url).origin}/jobs/${slug}`;
}

function inviteEventDelivery(delivery: SparkNotificationSendResult | null) {
  if (!delivery?.ok) return {};

  return {
    delivery: {
      provider: delivery.provider,
      downstreamProvider: delivery.downstreamProvider,
      status: "sent",
      providerMessageId: delivery.providerMessageId,
      from: delivery.from,
    },
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

    let delivery: SparkNotificationSendResult | null = null;
    const now = new Date().toISOString();

    if (action === "invite_interview") {
      if (!application.candidateEmail) {
        return NextResponse.json(
          {
            success: false,
            error: "Candidate email is required before sending an invite.",
          },
          { status: 400 }
        );
      }

      if (!application.posting) {
        return NextResponse.json(
          {
            success: false,
            error: "Spark posting details are required before sending an invite.",
          },
          { status: 400 }
        );
      }

      delivery = await sendSparkInterviewInvite({
        applicationId,
        recipientEmail: application.candidateEmail,
        candidateName: application.candidateName,
        jobTitle: application.posting.title,
        clientName: application.posting.clientName,
        jobUrl: publicJobUrl(
          request,
          application.posting.slug,
          application.posting.publicUrl
        ),
      });

      if (!delivery.ok) {
        const failedCommunicationState = appendEvent(
          application.communicationState,
          {
            type: "interview_invite_failed",
            label: "Interview invite failed",
            at: now,
            channel: "candidate",
            messagePreview: `Courier/Postmark email did not send (${delivery.errorCode}).`,
            delivery: {
              provider: "courier",
              downstreamProvider: "postmark",
              status: "failed",
              errorCode: delivery.errorCode,
            },
          },
          true
        );

        await updateApplication(
          applicationId,
          {
            recruiterNotes,
            communicationState: failedCommunicationState as JsonValue,
          },
          "id,status,recruiterNotes"
        );

        return NextResponse.json(
          {
            success: false,
            error: "Unable to send the interview invite email.",
            code: delivery.errorCode,
          },
          { status: 502 }
        );
      }
    }

    const communicationState = appendEvent(application.communicationState, {
      type: config.eventType,
      label: config.label,
      at: now,
      channel: config.channel,
      messagePreview: config.messagePreview,
      ...inviteEventDelivery(delivery),
    }, action === "invite_interview");

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
