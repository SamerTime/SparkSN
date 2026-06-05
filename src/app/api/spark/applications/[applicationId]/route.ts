import { NextRequest, NextResponse } from "next/server";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import {
  deleteApplicationSubmission,
  getApplicationForDeletion,
  getApplicationForRecruiterAction,
  getApprovedQuestionBankForPosting,
  interviewQuestionsFromBank,
  type JsonValue,
  type SparkApplicationStatus,
  updateApplication,
} from "@/lib/spark-db";
import {
  sendSparkInterviewInvite,
  type SparkNotificationSendResult,
} from "@/lib/spark-notifications";

type ActionConfig = {
  status?: SparkApplicationStatus;
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

const WORKFLOW_STATUSES: Record<string, ActionConfig> = {
  InProcess: {
    status: "InProcess",
    eventType: "candidate_in_process",
    label: "Candidate in process",
    channel: "internal",
    messagePreview:
      "Candidate moved to In Process for active recruiter follow-up.",
  },
  Complete: {
    status: "Complete",
    eventType: "candidate_complete",
    label: "Candidate complete",
    channel: "internal",
    messagePreview:
      "Candidate moved to Complete for this Spark review stage.",
  },
  Reviewing: {
    status: "Reviewing",
    eventType: "candidate_reviewing",
    label: "Candidate reviewing",
    channel: "internal",
    messagePreview:
      "Candidate moved to Reviewing for recruiter evaluation.",
  },
  Shortlisted: {
    status: "Shortlisted",
    eventType: "candidate_shortlisted",
    label: "Candidate shortlisted",
    channel: "internal",
    messagePreview:
      "Candidate moved to Shortlist for recruiter consideration.",
  },
  Declined: {
    status: "Declined",
    eventType: "candidate_rejected",
    label: "Candidate rejected",
    channel: "internal",
    messagePreview:
      "Candidate moved to Reject for this Spark job order.",
  },
  Offer: {
    status: "Offer",
    eventType: "candidate_offer",
    label: "Candidate offer",
    channel: "internal",
    messagePreview:
      "Candidate moved to Offer for this Spark job order.",
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
        "spark_job_apply_invite",
        "spark_interview_invite",
        "spark_candidate_decline",
      ],
    },
    events: [...existingEvents, event],
  };
}

function interviewToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function publicInterviewUrl(request: NextRequest, token: string) {
  return `${new URL(request.url).origin}/interview/${token}`;
}

function withInterviewSession(
  current: unknown,
  session: Record<string, unknown>
) {
  const media = jsonObject(current);
  return {
    ...media,
    session,
  };
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
    const requestedStatus = stringValue(body.status);
    const config =
      action === "set_status"
        ? WORKFLOW_STATUSES[requestedStatus]
        : ACTIONS[action];

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Unknown recruiter action or status." },
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

      const token = interviewToken();
      const interviewUrl = publicInterviewUrl(request, token);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Snapshot the approved question bank onto the session so the candidate
      // sees the recruiter-approved (Roger-generated) questions, locked at
      // invite time even if the bank is later edited/retired.
      const approvedBank = await getApprovedQuestionBankForPosting(
        application.postingId
      );
      const snapshotQuestions = interviewQuestionsFromBank(approvedBank);

      const session = {
        token,
        status: "invited",
        inviteUrl: interviewUrl,
        invitedAt: now,
        expiresAt,
        questionBankId: approvedBank?.id ?? null,
        questionBankApprovedAt: approvedBank?.approvedAt ?? null,
        questions: snapshotQuestions,
      };

      delivery = await sendSparkInterviewInvite({
        applicationId,
        recipientEmail: application.candidateEmail,
        candidateName: application.candidateName,
        jobTitle: application.posting.title,
        clientName: application.posting.clientName,
        interviewUrl,
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

      application.interviewMedia = withInterviewSession(
        application.interviewMedia,
        session
      ) as JsonValue;
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
        ...(action === "invite_interview"
          ? { interviewMedia: application.interviewMedia }
          : {}),
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

export async function DELETE(
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
    const body = await request.json().catch(() => ({}));
    const note = stringValue(body.note);

    if (note.length < 3) {
      return NextResponse.json(
        { success: false, error: "A deletion note is required." },
        { status: 400 }
      );
    }

    const application = await getApplicationForDeletion(applicationId);
    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found." },
        { status: 404 }
      );
    }

    const deletion = await deleteApplicationSubmission({
      application,
      note,
      deletedByUserId: recruiter.id,
      deletedByEmail: recruiter.email,
    });

    return NextResponse.json({
      success: true,
      deletion,
    });
  } catch (error) {
    console.error("Spark application deletion error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to delete the Spark application." },
      { status: 500 }
    );
  }
}
