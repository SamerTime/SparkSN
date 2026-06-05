import { NextRequest, NextResponse } from "next/server";
import { getSparkRecruiterUser } from "@/lib/spark-auth";
import {
  findJobInvitationByPostingAndEmail,
  getPublishedJobById,
  type JsonValue,
  updateJobInvitation,
  upsertJobInvitation,
} from "@/lib/spark-db";
import {
  sendSparkApplyInvite,
  type SparkNotificationSendResult,
} from "@/lib/spark-notifications";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function applyUrl(request: NextRequest, slug: string) {
  return `${new URL(request.url).origin}/jobs/${slug}/apply`;
}

function appendInvitationEvent(
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
        "spark_job_apply_invite",
        "spark_application_received",
        "spark_recruiter_review_needed",
        "spark_interview_invite",
      ],
    },
    events: [...existingEvents, event],
  };
}

function deliveryEvent(delivery: SparkNotificationSendResult) {
  if (!delivery.ok) {
    return {
      delivery: {
        provider: "courier",
        downstreamProvider: "postmark",
        status: "failed",
        errorCode: delivery.errorCode,
      },
    };
  }

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
    const email = stringValue(body.email).toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const posting = await getPublishedJobById(postingId);
    if (!posting) {
      return NextResponse.json(
        { success: false, error: "Published job order not found." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const inviteUrl = applyUrl(request, posting.slug);
    const existingInvitation = await findJobInvitationByPostingAndEmail(
      posting.id,
      email
    );
    const queuedState = appendInvitationEvent(
      existingInvitation?.communicationState,
      {
        type: "job_apply_invite_queued",
        label: "Apply invite queued",
        at: now,
        channel: "candidate",
        messagePreview: `Apply invitation queued for ${email}.`,
        invitedBy: recruiter.email,
      }
    );
    const invitation = await upsertJobInvitation({
      postingId: posting.id,
      email,
      inviteUrl,
      status: "Queued",
      invitedBy: recruiter.email,
      communicationState: queuedState as JsonValue,
    });

    const delivery = await sendSparkApplyInvite({
      postingId: posting.id,
      recipientEmail: email,
      jobTitle: posting.title,
      clientName: posting.clientName,
      applyUrl: inviteUrl,
    });

    const sentAt = new Date().toISOString();
    const finalState = appendInvitationEvent(
      queuedState,
      {
        type: delivery.ok ? "job_apply_invite_sent" : "job_apply_invite_failed",
        label: delivery.ok ? "Apply invite sent" : "Apply invite failed",
        at: sentAt,
        channel: "candidate",
        messagePreview: delivery.ok
          ? `Apply invitation sent to ${email}.`
          : `Courier/Postmark email did not send (${delivery.errorCode}).`,
        invitedBy: recruiter.email,
        ...deliveryEvent(delivery),
      },
      true
    );

    await updateJobInvitation(invitation.id, {
      status: delivery.ok ? "Sent" : "Failed",
      communicationState: finalState as JsonValue,
    });

    if (!delivery.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to send the apply invitation email.",
          code: delivery.errorCode,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email,
        status: "Sent",
        inviteUrl,
      },
    });
  } catch (error) {
    console.error("Spark apply invite error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to send the apply invitation." },
      { status: 500 }
    );
  }
}
