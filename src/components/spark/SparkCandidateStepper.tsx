import { Check } from "lucide-react";

type StepperProps = {
  status: string;
  createdAt: string;
  communicationState: unknown;
  interviewMedia: unknown;
  interviewTranscript: unknown;
};

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function wasInvited(communicationState: unknown): boolean {
  const events = Array.isArray(obj(communicationState).events)
    ? (obj(communicationState).events as unknown[])
    : [];
  return events.some((e) => obj(e).type === "invited_candidate_applied");
}

function hasSession(interviewMedia: unknown): boolean {
  return Object.keys(obj(obj(interviewMedia).session)).length > 0;
}

function hasAnswers(interviewTranscript: unknown): boolean {
  return Array.isArray(obj(interviewTranscript).answers)
    ? (obj(interviewTranscript).answers as unknown[]).length > 0
    : false;
}

function formatDate(value: string): string {
  if (!value) return "";
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const SCREEN_INVITED = new Set([
  "InterviewInvited",
  "InterviewStarted",
  "InProcess",
  "InterviewCompleted",
  "Complete",
  "RecruiterReview",
  "Reviewing",
  "Shortlisted",
  "Vetted",
  "Offer",
]);
const SCREEN_COMPLETE = new Set([
  "InterviewCompleted",
  "Complete",
  "RecruiterReview",
  "Reviewing",
  "Shortlisted",
  "Vetted",
  "Offer",
]);
const IN_PERSON = new Set(["Shortlisted", "Vetted"]);

type Step = {
  label: string;
  done: boolean;
  sub?: string;
  outcome?: "Hired" | "Rejected" | "Pending";
};

export function SparkCandidateStepper({
  status,
  createdAt,
  communicationState,
  interviewMedia,
  interviewTranscript,
}: StepperProps) {
  const invited = wasInvited(communicationState);
  const isHired = status === "Offer";
  const isRejected = status === "Declined";
  const terminal = isHired || isRejected;

  const reachedInvited = SCREEN_INVITED.has(status) || hasSession(interviewMedia);
  const reachedComplete =
    SCREEN_COMPLETE.has(status) || hasAnswers(interviewTranscript);
  const reachedInPerson = IN_PERSON.has(status);
  // Dynamic path: drop the in-person step when the candidate reached a terminal
  // outcome without ever going to a live interview (e.g. rejected at screening).
  const skipInPerson = terminal && !reachedInPerson;

  const steps: Step[] = [
    { label: invited ? "Invited" : "Applied", done: true, sub: formatDate(createdAt) },
    { label: "AI Screen Invited", done: reachedInvited },
    { label: "Screening Complete", done: reachedComplete },
    ...(skipInPerson
      ? []
      : [{ label: "Interview In-Person", done: reachedInPerson } as Step]),
    {
      label: "Outcome",
      done: terminal,
      outcome: isHired ? "Hired" : isRejected ? "Rejected" : "Pending",
    },
  ];

  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {steps.map((step, i) => {
        const state: "done" | "current" | "upcoming" = step.done
          ? "done"
          : i === currentIndex
            ? "current"
            : "upcoming";
        const isOutcome = step.label === "Outcome";
        const outcomeTone =
          step.outcome === "Hired"
            ? "text-[var(--sn-success,#16a34a)]"
            : step.outcome === "Rejected"
              ? "text-[var(--sn-coral,#e1564f)]"
              : "text-[var(--sn-muted)]";

        return (
          <div key={step.label} className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  state === "done"
                    ? "bg-[var(--sn-ink)] text-white"
                    : state === "current"
                      ? "border-2 border-[var(--sn-blue,#2563eb)] text-[var(--sn-blue,#2563eb)]"
                      : "border border-[var(--sn-line)] text-[var(--sn-muted)]"
                }`}
              >
                {state === "done" ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <div className="leading-tight">
                <div
                  className={`text-xs font-semibold ${
                    state === "upcoming"
                      ? "text-[var(--sn-muted)]"
                      : "text-[var(--sn-ink)]"
                  }`}
                >
                  {step.label}
                </div>
                {isOutcome ? (
                  <div className={`text-[11px] font-medium ${outcomeTone}`}>
                    {step.outcome}
                  </div>
                ) : step.sub ? (
                  <div className="text-[11px] text-[var(--sn-muted)]">
                    {step.sub}
                  </div>
                ) : null}
              </div>
            </div>
            {i < steps.length - 1 && (
              <span className="mx-1 text-[var(--sn-muted)]">→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
