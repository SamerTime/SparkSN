const COURIER_API_URL = "https://api.courier.com/send";
const COURIER_TIMEOUT_MS = 10_000;
const SITE_NAME = "StaffingNation Spark";
const DEFAULT_FROM_EMAIL = "tasky@tcwglobal.com";

type SparkInterviewInviteInput = {
  applicationId: string;
  recipientEmail: string;
  candidateName?: string | null;
  jobTitle: string;
  clientName?: string | null;
  interviewUrl: string;
};

export type SparkNotificationSendResult =
  | {
      ok: true;
      provider: "courier";
      downstreamProvider: "postmark";
      providerMessageId: string | null;
      from: string;
    }
  | {
      ok: false;
      errorCode: string;
    };

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainName(value?: string | null) {
  const name = cleanText(value);
  return name || "there";
}

function fromAddress(value: string) {
  return value.includes("<") ? value : `${SITE_NAME} <${value}>`;
}

function courierConfig() {
  const token = cleanText(process.env.COURIER_AUTH_TOKEN);
  const configuredFrom = cleanText(process.env.COURIER_POSTMARK_FROM_EMAIL);
  const from = fromAddress(configuredFrom || DEFAULT_FROM_EMAIL);
  const stream = cleanText(process.env.COURIER_POSTMARK_MESSAGE_STREAM);

  return {
    token,
    from,
    stream,
  };
}

function buildInterviewInviteContent(input: SparkInterviewInviteInput) {
  const candidateName = plainName(input.candidateName);
  const clientLine = cleanText(input.clientName)
    ? ` for ${cleanText(input.clientName)}`
    : "";
  const subject = "Spark interview invite";
  const text = [
    `Hi ${candidateName},`,
    "",
    `A recruiter reviewed your Spark application for ${input.jobTitle}${clientLine} and invited you to the next interview step.`,
    "",
    "What to expect:",
    "- The interview is short and phone-friendly.",
    "- Please use a quiet place with a working camera and microphone.",
    "- Keep your answers focused on the job, your experience, and your availability.",
    "- Spark may use location and device signals with your consent to reduce fraud and protect candidate identity.",
    "",
    `Start your interview here: ${input.interviewUrl}`,
    "",
    "A recruiter will follow up with the next instructions.",
    "",
    "Thank you,",
    "StaffingNation Spark",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#172033;line-height:1.55">
      <p>Hi ${escapeHtml(candidateName)},</p>
      <p>
        A recruiter reviewed your Spark application for
        <strong>${escapeHtml(input.jobTitle)}</strong>${escapeHtml(clientLine)}
        and invited you to the next interview step.
      </p>
      <p><strong>What to expect:</strong></p>
      <ul>
        <li>The interview is short and phone-friendly.</li>
        <li>Please use a quiet place with a working camera and microphone.</li>
        <li>Keep your answers focused on the job, your experience, and your availability.</li>
        <li>Spark may use location and device signals with your consent to reduce fraud and protect candidate identity.</li>
      </ul>
      <p>
        <a href="${escapeHtml(input.interviewUrl)}" style="color:#2563eb;font-weight:700">
          Start interview
        </a>
      </p>
      <p>A recruiter will follow up with the next instructions.</p>
      <p>Thank you,<br />StaffingNation Spark</p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendSparkInterviewInvite(
  input: SparkInterviewInviteInput
): Promise<SparkNotificationSendResult> {
  const recipientEmail = cleanText(input.recipientEmail);
  if (!recipientEmail) {
    return { ok: false, errorCode: "missing_recipient_email" };
  }

  const config = courierConfig();
  if (!config.token) {
    return { ok: false, errorCode: "missing_courier_auth_token" };
  }

  const content = buildInterviewInviteContent(input);

  try {
    const response = await fetch(COURIER_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({
        message: {
          to: { email: recipientEmail },
          content: {
            title: content.subject,
            body: content.text,
          },
          data: {
            applicationId: input.applicationId,
            jobTitle: input.jobTitle,
            interviewUrl: input.interviewUrl,
          },
          channels: {
            email: {
              override: {
                from: config.from,
                subject: content.subject,
                html: content.html,
                text: content.text,
                tracking: {
                  open: false,
                },
              },
            },
          },
          ...(config.stream
            ? {
                providers: {
                  postmark: {
                    override: {
                      config: {
                        MessageStream: config.stream,
                      },
                    },
                  },
                },
              }
            : {}),
          routing: {
            method: "single",
            channels: ["email"],
          },
        },
      }),
      signal: AbortSignal.timeout(COURIER_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { ok: false, errorCode: `courier_http_${response.status}` };
    }

    const result = (await response.json().catch(() => ({}))) as {
      requestId?: string;
      messageId?: string;
    };

    return {
      ok: true,
      provider: "courier",
      downstreamProvider: "postmark",
      providerMessageId: result.requestId || result.messageId || null,
      from: config.from,
    };
  } catch (error) {
    return {
      ok: false,
      errorCode:
        error instanceof Error && error.name === "TimeoutError"
          ? "courier_timeout"
          : "courier_exception",
    };
  }
}
