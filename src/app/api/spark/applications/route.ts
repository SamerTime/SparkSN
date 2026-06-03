import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function booleanValue(value: unknown) {
  return value === true || value === "true";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function appendCommunicationEvents(
  current: unknown,
  events: Array<Record<string, unknown>>,
  preferredChannel: string
) {
  const state = jsonObject(current);
  const existingEvents = Array.isArray(state.events) ? state.events : [];

  return {
    ...state,
    preferredChannel,
    courier: {
      enabled: false,
      plannedTemplates: [
        "spark_application_received",
        "spark_recruiter_review_needed",
        "spark_interview_invite",
      ],
    },
    events: [...existingEvents, ...events],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const postingSlug = stringValue(body.postingSlug);
    const firstName = stringValue(body.firstName);
    const lastName = stringValue(body.lastName);
    const email = stringValue(body.email).toLowerCase();
    const phone = stringValue(body.phone);
    const city = stringValue(body.city);
    const state = stringValue(body.state);
    const country = stringValue(body.country) || "US";
    const experienceSummary = stringValue(body.experienceSummary);
    const availableToStart = stringValue(body.availableToStart);
    const preferredChannel = stringValue(body.preferredChannel) || "email";
    const aiInterviewConsent = booleanValue(body.aiInterviewConsent);
    const recordingConsent = booleanValue(body.recordingConsent);
    const geolocationConsent = booleanValue(body.geolocationConsent);
    const now = new Date();

    if (!postingSlug) {
      return NextResponse.json(
        { success: false, error: "Missing posting slug." },
        { status: 400 }
      );
    }

    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json(
        { success: false, error: "Name, email, and phone are required." },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!aiInterviewConsent || !recordingConsent || !geolocationConsent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI interview, recording, and location review consent are required for Spark applications.",
        },
        { status: 400 }
      );
    }

    const posting = await prisma.sparkJobPosting.findFirst({
      where: { slug: postingSlug, status: "Published" },
      select: {
        id: true,
        title: true,
        slug: true,
        clientName: true,
      },
    });

    if (!posting) {
      return NextResponse.json(
        { success: false, error: "This job is not available for applications." },
        { status: 404 }
      );
    }

    const location = jsonObject(body.location);
    const browserInput = jsonObject(body.browser);
    const screenInput = jsonObject(browserInput.screen);
    const latitude = numberValue(location.latitude);
    const longitude = numberValue(location.longitude);
    const accuracy = numberValue(location.accuracy);
    const browserSignals = {
      timeZone: stringValue(browserInput.timeZone),
      language: stringValue(browserInput.language),
      platform: stringValue(browserInput.platform),
      screen: {
        width: numberValue(screenInput.width),
        height: numberValue(screenInput.height),
      },
    };
    const browserLocation =
      latitude !== null && longitude !== null
        ? {
            latitude,
            longitude,
            accuracy,
            capturedAt: now.toISOString(),
          }
        : null;

    const profileData: Prisma.InputJsonObject = {
      source: "spark_public_apply",
      experienceSummary,
      availableToStart,
      preferredChannel,
      lastAppliedPostingSlug: posting.slug,
      lastAppliedPostingTitle: posting.title,
    };

    const candidate = await prisma.sparkCandidateProfile.upsert({
      where: { email },
      update: {
        firstName,
        lastName,
        phone,
        city,
        state,
        country,
        profileData,
        geolocationConsentAt: now,
        aiInterviewConsentAt: now,
        recordingConsentAt: now,
        fraudReviewData: {
          locationCaptured: Boolean(browserLocation),
          lastLocationCaptureAt: browserLocation ? now.toISOString() : null,
        },
      },
      create: {
        email,
        firstName,
        lastName,
        phone,
        city,
        state,
        country,
        profileData,
        geolocationConsentAt: now,
        aiInterviewConsentAt: now,
        recordingConsentAt: now,
        fraudReviewData: {
          locationCaptured: Boolean(browserLocation),
          firstLocationCaptureAt: browserLocation ? now.toISOString() : null,
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    const existingApplication = await prisma.sparkApplication.findFirst({
      where: {
        postingId: posting.id,
        candidateEmail: email,
      },
      select: {
        id: true,
        communicationState: true,
      },
    });

    const candidateName = `${firstName} ${lastName}`;
    const locationSignals: Prisma.InputJsonObject = {
      candidateProvidedLocation: {
        city,
        state,
        country,
      },
      browserGeolocation: browserLocation,
      consentAt: now.toISOString(),
      fraudReview: {
        needsLocationReview: !browserLocation,
        reason: browserLocation
          ? "Browser location captured with candidate consent."
          : "Candidate consented, but browser location was not captured.",
      },
    };
    const deviceSignals: Prisma.InputJsonObject = {
      userAgent: request.headers.get("user-agent"),
      acceptLanguage: request.headers.get("accept-language"),
      browser: browserSignals,
      submittedAt: now.toISOString(),
    };
    const communicationState = appendCommunicationEvents(
      existingApplication?.communicationState,
      [
        {
          type: existingApplication ? "application_updated" : "application_received",
          label: existingApplication
            ? "Candidate profile updated"
            : "Application received",
          at: now.toISOString(),
          channel: preferredChannel,
          messagePreview:
            "Thanks for applying. A recruiter will review your profile before the short interview step.",
        },
        {
          type: "recruiter_review_queued",
          label: "Recruiter review queued",
          at: now.toISOString(),
          channel: "internal",
          messagePreview:
            "Review profile, confirm fit, then approve or invite to interview.",
        },
      ],
      preferredChannel
    );

    const application = existingApplication
      ? await prisma.sparkApplication.update({
          where: { id: existingApplication.id },
          data: {
            candidateId: candidate.id,
            candidateEmail: email,
            candidateName,
            candidatePhone: phone,
            status: "Applied",
            communicationState: communicationState as Prisma.InputJsonObject,
            deviceSignals,
            locationSignals,
          },
          select: {
            id: true,
            status: true,
          },
        })
      : await prisma.sparkApplication.create({
          data: {
            postingId: posting.id,
            candidateId: candidate.id,
            candidateEmail: email,
            candidateName,
            candidatePhone: phone,
            status: "Applied",
            communicationState: communicationState as Prisma.InputJsonObject,
            deviceSignals,
            locationSignals,
          },
          select: {
            id: true,
            status: true,
          },
        });

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      status: application.status,
      nextStep:
        "Your profile is queued for recruiter review. If approved, Spark will send the short interview link.",
    });
  } catch (error) {
    console.error("Spark application error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to create the Spark application." },
      { status: 500 }
    );
  }
}
