import { NextRequest, NextResponse } from "next/server";
import {
  createApplication,
  findApplicationByPostingAndEmail,
  findJobInvitationByPostingAndEmail,
  getApprovedQuestionBankForPosting,
  getPublishedPostingForApplication,
  interviewQuestionsFromBank,
  type JsonValue,
  type SparkApplicationStatus,
  updateApplication,
  updateJobInvitation,
  upsertCandidateProfileByEmail,
} from "@/lib/spark-db";
import {
  emailMatchesAutoAcceptDomain,
  getSparkSettings,
} from "@/lib/spark-settings";

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
        "spark_job_apply_invite",
        "spark_interview_invite",
      ],
    },
    events: [...existingEvents, ...events],
  };
}

const EARLY_APPLICATION_STATUSES = new Set<SparkApplicationStatus>([
  "ProfileStarted",
  "Applied",
  "Invited",
]);

const SPARK_CONSENT_VERSION = "2026-06-06-v2";
const STANDARD_AI_PATHWAY = "standard_ai";
const MANUAL_REVIEW_PATHWAY = "manual_review";

function applicationStatusForApply(
  existingStatus: SparkApplicationStatus | undefined,
  invited: boolean,
  manualReviewRequested: boolean
): SparkApplicationStatus {
  if (existingStatus && !EARLY_APPLICATION_STATUSES.has(existingStatus)) {
    return existingStatus;
  }

  if (manualReviewRequested) return "RecruiterReview";
  return invited ? "Invited" : "Applied";
}

function locationReviewReason(
  status: string,
  captured: boolean,
  geolocationConsent: boolean
) {
  if (!geolocationConsent) {
    return "Candidate requested manual review; browser location was not requested.";
  }
  if (captured) return "Browser location captured with candidate consent.";
  if (status === "denied") {
    return "Candidate consented, but browser location permission was denied.";
  }
  if (status === "unsupported") {
    return "Candidate consented, but this browser does not support location capture.";
  }
  if (status === "error") {
    return "Candidate consented, but browser location capture failed.";
  }
  return "Candidate consented, but browser location was not captured.";
}

function interviewToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function publicInterviewUrl(request: NextRequest, token: string) {
  return `${new URL(request.url).origin}/interview/${token}`;
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
    const screeningPathway = stringValue(body.screeningPathway);
    const manualReviewRequested = screeningPathway === MANUAL_REVIEW_PATHWAY;
    const standardAiRequested =
      !screeningPathway || screeningPathway === STANDARD_AI_PATHWAY;
    const resolvedScreeningPathway = manualReviewRequested
      ? MANUAL_REVIEW_PATHWAY
      : STANDARD_AI_PATHWAY;
    const now = new Date().toISOString();

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

    if (
      !manualReviewRequested &&
      (!standardAiRequested ||
        !aiInterviewConsent ||
        !recordingConsent ||
        !geolocationConsent)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI interview, recording, and location review consent are required for the standard Spark workflow. Choose manual review if you do not consent to the standard workflow.",
        },
        { status: 400 }
      );
    }

    const posting = await getPublishedPostingForApplication(postingSlug);

    if (!posting) {
      return NextResponse.json(
        { success: false, error: "This job is not available for applications." },
        { status: 404 }
      );
    }

    // Auto-accept bypass: a standard-pathway applicant whose email domain is on
    // the allowlist (Admin > Options) skips recruiter review + the email invite
    // and is sent straight into the AI screening. Stays null if disabled, the
    // domain doesn't match, or the job has no approved question bank.
    let autoAcceptSession: Record<string, unknown> | null = null;
    let autoAcceptUrl: string | null = null;
    if (standardAiRequested && !manualReviewRequested) {
      const settings = await getSparkSettings();
      if (
        settings.autoAcceptEnabled &&
        emailMatchesAutoAcceptDomain(email, settings.autoAcceptDomains)
      ) {
        const approvedBank = await getApprovedQuestionBankForPosting(posting.id);
        const snapshotQuestions = interviewQuestionsFromBank(approvedBank);
        if (snapshotQuestions.length > 0) {
          const token = interviewToken();
          autoAcceptUrl = publicInterviewUrl(request, token);
          autoAcceptSession = {
            token,
            status: "invited",
            inviteUrl: autoAcceptUrl,
            invitedAt: now,
            expiresAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            questionBankId: approvedBank?.id ?? null,
            questionBankApprovedAt: approvedBank?.approvedAt ?? null,
            questions: snapshotQuestions,
            autoAccepted: true,
          };
        }
      }
    }

    const location = jsonObject(body.location);
    const locationCapture = jsonObject(body.locationCapture);
    const browserInput = jsonObject(body.browser);
    const screenInput = jsonObject(browserInput.screen);
    const latitude = numberValue(location.latitude);
    const longitude = numberValue(location.longitude);
    const accuracy = numberValue(location.accuracy);
    const locationCaptureStatus =
      stringValue(locationCapture.status) ||
      (latitude !== null && longitude !== null ? "captured" : "not_captured");
    const locationCaptureMessage = stringValue(locationCapture.message);
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
            capturedAt: now,
          }
        : null;

    const profileData: JsonValue = {
      source: "spark_public_apply",
      experienceSummary,
      availableToStart,
      preferredChannel,
      screeningPathway: resolvedScreeningPathway,
      consentVersion: SPARK_CONSENT_VERSION,
      lastAppliedPostingSlug: posting.slug,
      lastAppliedPostingTitle: posting.title,
    };

    const candidateConsentTimestamps = manualReviewRequested
      ? {}
      : {
          geolocationConsentAt: now,
          aiInterviewConsentAt: now,
          recordingConsentAt: now,
        };

    const candidate = await upsertCandidateProfileByEmail(email, {
      firstName,
      lastName,
      phone,
      city,
      state,
      country,
      profileData,
      ...candidateConsentTimestamps,
      fraudReviewData: {
        screeningPathway: resolvedScreeningPathway,
        consentVersion: SPARK_CONSENT_VERSION,
        locationCaptured: Boolean(browserLocation),
        locationCaptureAt: browserLocation ? now : null,
        locationCaptureStatus,
        locationCaptureMessage,
      },
    });

    const existingApplication = await findApplicationByPostingAndEmail(
      posting.id,
      email
    );
    const invitation = await findJobInvitationByPostingAndEmail(posting.id, email);
    const applicationStatus = applicationStatusForApply(
      existingApplication?.status,
      Boolean(invitation),
      manualReviewRequested
    );
    const finalStatus: SparkApplicationStatus = autoAcceptSession
      ? "InterviewInvited"
      : applicationStatus;

    const candidateName = `${firstName} ${lastName}`;
    const locationSignals: JsonValue = {
      candidateProvidedLocation: {
        city,
        state,
        country,
      },
      browserGeolocation: browserLocation,
      consentAt: geolocationConsent ? now : null,
      screeningPathway: resolvedScreeningPathway,
      consentVersion: SPARK_CONSENT_VERSION,
      capture: {
        status: browserLocation ? "captured" : locationCaptureStatus,
        message: locationCaptureMessage,
        captured: Boolean(browserLocation),
      },
      fraudReview: {
        needsLocationReview: !browserLocation,
        reason: locationReviewReason(
          locationCaptureStatus,
          Boolean(browserLocation),
          geolocationConsent
        ),
      },
    };
    const deviceSignals: JsonValue = {
      userAgent: request.headers.get("user-agent"),
      acceptLanguage: request.headers.get("accept-language"),
      browser: browserSignals,
      screeningPathway: resolvedScreeningPathway,
      consentVersion: SPARK_CONSENT_VERSION,
      submittedAt: now,
    };
    const communicationState = appendCommunicationEvents(
      existingApplication?.communicationState,
      [
        {
          type: existingApplication ? "application_updated" : "application_received",
          label: existingApplication
            ? "Candidate profile updated"
            : "Application received",
          at: now,
          channel: preferredChannel,
          messagePreview:
            manualReviewRequested
              ? "Manual review requested. A recruiter will review this application through a human-led pathway."
              : "Thanks for applying. A recruiter will review your profile before the short interview step.",
          screeningPathway: resolvedScreeningPathway,
          consentVersion: SPARK_CONSENT_VERSION,
        },
        ...(invitation
          ? [
              {
                type: "invited_candidate_applied",
                label: "Invited candidate applied",
                at: now,
                channel: "internal",
                messagePreview:
                  "Candidate applied after receiving a recruiter invitation for this job order.",
              },
            ]
          : []),
        ...(autoAcceptSession
          ? [
              {
                type: "auto_accepted",
                label: "Auto-accepted",
                at: now,
                channel: "internal",
                messagePreview:
                  "Auto-accepted — email domain matched the allowlist; recruiter review and the email invite were skipped.",
                screeningPathway: resolvedScreeningPathway,
                consentVersion: SPARK_CONSENT_VERSION,
              },
              {
                type: "interview_invite_sent",
                label: "Sent to AI screening",
                at: now,
                channel: "candidate",
                messagePreview:
                  "Candidate was auto-accepted and taken straight into the AI screening.",
                screeningPathway: resolvedScreeningPathway,
                consentVersion: SPARK_CONSENT_VERSION,
              },
            ]
          : [
              {
                type: "recruiter_review_queued",
                label: "Recruiter review queued",
                at: now,
                channel: "internal",
                messagePreview:
                  manualReviewRequested
                    ? "Manual review requested. Do not route this candidate through standard AI-assisted screening without updated consent."
                    : "Review profile, confirm fit, then approve or invite to interview.",
                screeningPathway: resolvedScreeningPathway,
                consentVersion: SPARK_CONSENT_VERSION,
              },
            ]),
      ],
      preferredChannel
    );

    const application = existingApplication
      ? await updateApplication(existingApplication.id, {
          candidateId: candidate.id,
          candidateEmail: email,
          candidateName,
          candidatePhone: phone,
          status: finalStatus,
          communicationState: communicationState as JsonValue,
          deviceSignals,
          locationSignals,
          ...(autoAcceptSession
            ? { interviewMedia: { session: autoAcceptSession } as JsonValue }
            : {}),
        })
      : await createApplication({
          postingId: posting.id,
          candidateId: candidate.id,
          candidateEmail: email,
          candidateName,
          candidatePhone: phone,
          status: finalStatus,
          communicationState: communicationState as JsonValue,
          deviceSignals,
          locationSignals,
          ...(autoAcceptSession
            ? { interviewMedia: { session: autoAcceptSession } as JsonValue }
            : {}),
        });

    if (invitation) {
      const invitationCommunicationState = appendCommunicationEvents(
        invitation.communicationState,
        [
          {
            type: "job_apply_invite_accepted",
            label: "Apply invite accepted",
            at: now,
            channel: "internal",
            messagePreview:
              "Candidate submitted the Spark application from a recruiter invitation.",
            applicationId: application.id,
          },
        ],
        preferredChannel
      );

      await updateJobInvitation(invitation.id, {
        status: "Applied",
        communicationState: invitationCommunicationState as JsonValue,
      });
    }

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      status: application.status,
      // When auto-accepted, the apply form redirects the candidate straight here.
      interviewUrl: autoAcceptUrl,
      nextStep: autoAcceptUrl
        ? "You're all set — taking you straight into your AI screening."
        : manualReviewRequested
          ? "Your profile is queued for manual recruiter review. A recruiter may contact you for next steps."
          : "Your profile is queued for recruiter review. If approved, Spark will send the short interview link.",
    });
  } catch (error) {
    console.error("Spark application error:", error);
    return NextResponse.json(
      { success: false, error: "Unable to create the Spark application." },
      { status: 500 }
    );
  }
}
