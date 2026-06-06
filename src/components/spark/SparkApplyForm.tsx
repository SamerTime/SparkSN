"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Loader2,
  LocateFixed,
  MapPin,
  Mic,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SparkApplyFormProps = {
  postingSlug: string;
  postingTitle: string;
  clientName?: string | null;
  locationLabel?: string;
  payLabel?: string;
};

type LocationCapture = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type LocationCaptureState =
  | "idle"
  | "ready"
  | "capturing"
  | "captured"
  | "denied"
  | "unsupported"
  | "error";

type BrowserLocationPermission =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

type Submission = {
  applicationId: string;
  status: string;
  nextStep: string;
};

type ScreeningPathway = "standard_ai" | "manual_review";

const SPARK_CONSENT_VERSION = "2026-06-06-v2";

export function SparkApplyForm({
  postingSlug,
  postingTitle,
  clientName,
  locationLabel,
  payLabel,
}: SparkApplyFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [location, setLocation] = useState<LocationCapture | null>(null);
  const [locationCaptureState, setLocationCaptureState] =
    useState<LocationCaptureState>("idle");
  const [browserLocationPermission, setBrowserLocationPermission] =
    useState<BrowserLocationPermission>("unknown");
  const [locationStatus, setLocationStatus] = useState(
    "Check location consent below to enable capture."
  );
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    country: "US",
    availableToStart: "",
    experienceSummary: "",
    preferredChannel: "sms",
    screeningPathway: "standard_ai" as ScreeningPathway,
    aiInterviewConsent: false,
    recordingConsent: false,
    geolocationConsent: false,
    manualReviewAcknowledged: false,
  });

  const updateField = (
    field: keyof typeof form,
    value: string | boolean
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateGeolocationConsent = (checked: boolean) => {
    updateField("geolocationConsent", checked);
    setLocation(null);
    setLocationCaptureState(checked ? "ready" : "idle");
    setLocationStatus(
      checked
        ? "Consent checked. Tap capture location and allow the browser permission prompt."
        : "Check location consent below to enable capture."
    );
  };

  const updateScreeningPathway = (screeningPathway: ScreeningPathway) => {
    setForm((current) => ({
      ...current,
      screeningPathway,
      aiInterviewConsent:
        screeningPathway === "standard_ai" ? current.aiInterviewConsent : false,
      recordingConsent:
        screeningPathway === "standard_ai" ? current.recordingConsent : false,
      geolocationConsent:
        screeningPathway === "standard_ai" ? current.geolocationConsent : false,
      manualReviewAcknowledged:
        screeningPathway === "manual_review"
          ? current.manualReviewAcknowledged
          : false,
    }));
    if (screeningPathway === "manual_review") {
      setLocation(null);
      setLocationCaptureState("idle");
      setLocationStatus(
        "Manual review selected. Browser location will not be requested for initial submission."
      );
      setBrowserLocationPermission("unknown");
    } else {
      setLocationStatus("Check location consent below to enable capture.");
    }
  };

  useEffect(() => {
    if (!form.geolocationConsent) {
      setBrowserLocationPermission("unknown");
      return;
    }

    if (!navigator.geolocation) {
      setBrowserLocationPermission("unsupported");
      return;
    }

    if (!navigator.permissions?.query) {
      setBrowserLocationPermission("unknown");
      return;
    }

    let active = true;
    let permissionStatus: PermissionStatus | null = null;

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (!active) return;

        permissionStatus = status;
        const updatePermission = () => {
          const nextState = status.state as BrowserLocationPermission;
          setBrowserLocationPermission(nextState);

          if (nextState === "denied" && !location) {
            setLocationCaptureState("denied");
            setLocationStatus(
              "Consent is checked, but browser location permission is blocked for this site. Open site settings, allow Location, then try again."
            );
          }
        };

        updatePermission();
        status.onchange = updatePermission;
      })
      .catch(() => {
        if (active) setBrowserLocationPermission("unsupported");
      });

    return () => {
      active = false;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [form.geolocationConsent, location]);

  const captureLocation = () => {
    if (!form.geolocationConsent) {
      setLocationCaptureState("idle");
      setLocationStatus("Check location consent below to enable capture.");
      toast.error("Please consent to location review first.");
      return;
    }

    if (!navigator.geolocation) {
      setLocation(null);
      setLocationCaptureState("unsupported");
      setLocationStatus(
        "This browser does not support location capture. Recruiter review will use the city/state you entered."
      );
      return;
    }

    if (browserLocationPermission === "denied") {
      setLocation(null);
      setLocationCaptureState("denied");
      setLocationStatus(
        "Consent is checked, but browser location permission is blocked for this site. Open site settings, allow Location, then try again."
      );
      toast.error("Browser location permission is blocked for this site.");
      return;
    }

    setCapturingLocation(true);
    setLocationCaptureState("capturing");
    setLocationStatus("Requesting browser location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
        };
        setLocation(nextLocation);
        setLocationCaptureState("captured");
        setLocationStatus(
          `Location captured with about ${
            nextLocation.accuracy ? Math.round(nextLocation.accuracy) : "unknown"
          }m accuracy.`
        );
        setCapturingLocation(false);
      },
      (error) => {
        setLocation(null);
        if (error.code === error.PERMISSION_DENIED) {
          setBrowserLocationPermission("denied");
          setLocationCaptureState("denied");
          setLocationStatus(
            "Consent is checked, but browser location permission was denied. Allow Location in site settings and try again, or submit for recruiter review with manual city/state."
          );
        } else {
          setLocationCaptureState("error");
          setLocationStatus(
            error.message ||
              "Location capture was not completed. Recruiter review will use the city/state you entered."
          );
        }
        setCapturingLocation(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setSubmission(null);

    try {
      const response = await fetch("/api/spark/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postingSlug,
          ...form,
          consentVersion: SPARK_CONSENT_VERSION,
          location,
          locationCapture: {
            status: locationCaptureState,
            message: locationStatus,
            captured: Boolean(location),
          },
          browser: {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            platform: navigator.platform,
            screen: {
              width: window.screen.width,
              height: window.screen.height,
            },
          },
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to submit application.");
      }

      setSubmission({
        applicationId: result.applicationId,
        status: result.status,
        nextStep: result.nextStep,
      });
      toast.success("Application sent to Spark recruiter review.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to submit application."
      );
    } finally {
      setLoading(false);
    }
  };

  if (submission) {
    return (
      <div className="flex min-h-[720px] flex-col bg-[var(--sn-soft)] px-5 pb-5 pt-16">
        <div className="sn-card flex flex-1 flex-col justify-center p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--sn-success-50)] text-[var(--sn-success)]">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold text-[var(--sn-ink)]">
            Profile submitted
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--sn-muted)]">
            Spark created application{" "}
            <span className="font-bold text-[var(--sn-ink)]">
              {submission.applicationId}
            </span>{" "}
            for {postingTitle}. {submission.nextStep}
          </p>
          <div className="mt-6 grid gap-3">
            <Button
              type="button"
              className="sn-button-primary h-11"
              onClick={() => router.push("/jobs")}
            >
              Back to jobs
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 border-[var(--sn-line)]"
              onClick={() => router.push("/spark/recruiter")}
            >
              View recruiter queue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const locationTone =
    locationCaptureState === "captured"
      ? "border-[#bde8ce] bg-[var(--sn-success-50)]"
      : locationCaptureState === "denied" ||
          locationCaptureState === "unsupported" ||
          locationCaptureState === "error"
        ? "border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)]"
        : "border-[var(--sn-line)] bg-white";
  const locationIconTone =
    locationCaptureState === "captured"
      ? "text-[var(--sn-success)]"
      : locationCaptureState === "denied" ||
          locationCaptureState === "unsupported" ||
          locationCaptureState === "error"
        ? "text-[var(--sn-coral-600)]"
        : "text-[var(--sn-success)]";
  const standardAiSelected = form.screeningPathway === "standard_ai";
  const manualReviewSelected = form.screeningPathway === "manual_review";
  const locationButtonLabel = manualReviewSelected
    ? "Manual review selected"
    : locationCaptureState === "captured"
      ? "Refresh location"
      : locationCaptureState === "denied"
        ? "Retry location"
        : "Capture location";
  const permissionStatusText =
    form.geolocationConsent && browserLocationPermission === "denied"
      ? "Consent granted; browser permission blocked."
      : form.geolocationConsent && browserLocationPermission === "granted"
        ? "Consent granted; browser permission allowed."
        : form.geolocationConsent && browserLocationPermission === "prompt"
          ? "Consent granted; browser will ask for permission."
          : "";
  const submitLabel = manualReviewSelected
    ? "Request manual recruiter review"
    : "Submit for AI-assisted recruiter review";

  return (
    <form onSubmit={submit} className="flex min-h-[720px] flex-col bg-[var(--sn-soft)]">
      <header className="spark-mobile-header px-5 pb-4 pt-16">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-normal text-[var(--sn-blue-700)]">
              Quick apply
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-[var(--sn-ink)]">
              {postingTitle}
            </h2>
          </div>
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--sn-coral)] text-white">
            <UserRound className="h-5 w-5" />
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {clientName && <span className="sn-chip sn-chip-blue">{clientName}</span>}
          {payLabel && <span className="sn-chip sn-chip-success">{payLabel}</span>}
          {locationLabel && (
            <span className="sn-chip">
              <MapPin className="h-3.5 w-3.5 text-[var(--sn-blue)]" />
              {locationLabel}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-4 px-4 py-4">
        <section className="sn-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[var(--sn-ink)]">
                Notice and screening pathway
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--sn-muted)]">
                Review the{" "}
                <Link
                  href="/notice-at-collection"
                  className="font-bold text-[var(--sn-blue-700)] underline-offset-4 hover:underline"
                  target="_blank"
                >
                  Notice at Collection
                </Link>{" "}
                and choose how Spark should process this application.
              </p>
            </div>
            <span className="sn-chip sn-chip-coral">Step 1</span>
          </div>

          <div className="mt-4 grid gap-3">
            <label
              className={`block rounded-lg border p-3 ${
                standardAiSelected
                  ? "border-[var(--sn-blue-200)] bg-[var(--sn-blue-50)]"
                  : "border-[var(--sn-line)] bg-white"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="screeningPathway"
                  value="standard_ai"
                  checked={standardAiSelected}
                  onChange={() => updateScreeningPathway("standard_ai")}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--sn-blue)]"
                />
                <span>
                  <span className="block text-sm font-extrabold text-[var(--sn-ink)]">
                    Standard AI-assisted workflow
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--sn-muted)]">
                    Spark may use AI-assisted tools and permission-based device
                    signals to support recruiter review. Human reviewers make
                    final hiring decisions.
                  </span>
                </span>
              </span>
            </label>

            <label
              className={`block rounded-lg border p-3 ${
                manualReviewSelected
                  ? "border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)]"
                  : "border-[var(--sn-line)] bg-white"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="screeningPathway"
                  value="manual_review"
                  checked={manualReviewSelected}
                  onChange={() => updateScreeningPathway("manual_review")}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--sn-coral)]"
                />
                <span>
                  <span className="block text-sm font-extrabold text-[var(--sn-ink)]">
                    Manual recruiter review
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--sn-muted)]">
                    Request a human-led review pathway without standard AI
                    screening acknowledgements or initial camera, microphone, or
                    browser location capture.
                  </span>
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="sn-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[var(--sn-ink)]">
                Your profile
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--sn-muted)]">
                Used by recruiters for this Spark application only.
              </p>
            </div>
            <span className="sn-chip sn-chip-coral">Step 2</span>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(event) => updateField("firstName", event.target.value)}
                  required
                  autoComplete="given-name"
                  className="sn-input h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(event) => updateField("lastName", event.target.value)}
                  required
                  autoComplete="family-name"
                  className="sn-input h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                required
                autoComplete="email"
                className="sn-input h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                required
                autoComplete="tel"
                className="sn-input h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  autoComplete="address-level2"
                  className="sn-input h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(event) => updateField("state", event.target.value)}
                  autoComplete="address-level1"
                  className="sn-input h-11"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="availableToStart">Availability</Label>
                <Input
                  id="availableToStart"
                  value={form.availableToStart}
                  onChange={(event) =>
                    updateField("availableToStart", event.target.value)
                  }
                  placeholder="Immediately"
                  className="sn-input h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preferredChannel">Contact</Label>
                <select
                  id="preferredChannel"
                  value={form.preferredChannel}
                  onChange={(event) =>
                    updateField("preferredChannel", event.target.value)
                  }
                  className="sn-input h-11 w-full px-3 text-sm"
                >
                  <option value="sms">Text</option>
                  <option value="email">Email</option>
                  <option value="phone">Call</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="sn-card p-4">
          <h3 className="text-base font-extrabold text-[var(--sn-ink)]">
            Relevant experience
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--sn-muted)]">
            A short note helps the recruiter review faster.
          </p>
          <textarea
            id="experienceSummary"
            value={form.experienceSummary}
            onChange={(event) =>
              updateField("experienceSummary", event.target.value)
            }
            placeholder="A few sentences about work you have done that relates to this role."
            className="sn-input mt-3 min-h-28 w-full px-3 py-2 text-sm"
          />
        </section>

        <section className="sn-card p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sn-blue)]" />
            <div>
              <h3 className="text-base font-extrabold text-[var(--sn-ink)]">
                Screening readiness
              </h3>
              <p className="mt-1 text-xs leading-5 text-[var(--sn-muted)]">
                {manualReviewSelected
                  ? "Manual review keeps device permissions off for initial submission."
                  : "These checks support the future short mobile interview and recruiter fraud review."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-[var(--sn-line)] bg-white p-3">
              <Camera className="h-5 w-5 text-[var(--sn-coral)]" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--sn-ink)]">
                  Camera
                </p>
                <p className="text-xs text-[var(--sn-muted)]">
                  {manualReviewSelected
                    ? "Not requested for manual review submission."
                    : "Needed only after recruiter approval."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[var(--sn-line)] bg-white p-3">
              <Mic className="h-5 w-5 text-[var(--sn-blue)]" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--sn-ink)]">
                  Microphone
                </p>
                <p className="text-xs text-[var(--sn-muted)]">
                  {manualReviewSelected
                    ? "Not requested for manual review submission."
                    : "Used for the short video answers."}
                </p>
              </div>
            </div>
            <div className={`rounded-lg border p-3 ${locationTone}`}>
              <div className="flex items-start gap-3">
                <LocateFixed className={`mt-0.5 h-5 w-5 shrink-0 ${locationIconTone}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[var(--sn-ink)]">
                    Location signal
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--sn-muted)]">
                    {locationStatus}
                  </p>
                  {permissionStatusText && (
                    <p className="mt-1 text-[11px] font-bold leading-4 text-[var(--sn-muted)]">
                      {permissionStatusText}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-10 w-full border-[var(--sn-line)]"
                onClick={captureLocation}
                disabled={
                  capturingLocation ||
                  !form.geolocationConsent ||
                  manualReviewSelected
                }
              >
                {capturingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : locationCaptureState === "captured" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <LocateFixed className="h-4 w-4" />
                )}
                {locationButtonLabel}
              </Button>
            </div>
          </div>
        </section>

        <section className="sn-card p-4">
          <h3 className="text-base font-extrabold text-[var(--sn-ink)]">
            Consent and acknowledgement
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--sn-muted)]">
            Consent version {SPARK_CONSENT_VERSION}. Read the{" "}
            <Link
              href="/terms"
              className="font-bold text-[var(--sn-blue-700)] underline-offset-4 hover:underline"
              target="_blank"
            >
              California AI Disclosure & Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy-choices"
              className="font-bold text-[var(--sn-blue-700)] underline-offset-4 hover:underline"
              target="_blank"
            >
              privacy choices
            </Link>
            .
          </p>

          {standardAiSelected ? (
            <div className="mt-3 grid gap-3 text-sm text-[var(--sn-ink-2)]">
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={form.aiInterviewConsent}
                  onChange={(event) =>
                    updateField("aiInterviewConsent", event.target.checked)
                  }
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--sn-blue)]"
                  required
                />
                <span>
                  I choose the standard Spark workflow and consent to
                  AI-assisted recruiter support for this job.
                </span>
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={form.recordingConsent}
                  onChange={(event) =>
                    updateField("recordingConsent", event.target.checked)
                  }
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--sn-blue)]"
                  required
                />
                <span>
                  I consent to camera and microphone recording when I start the
                  interview.
                </span>
              </label>
              <label className="flex gap-3">
                <input
                  type="checkbox"
                  checked={form.geolocationConsent}
                  onChange={(event) =>
                    updateGeolocationConsent(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--sn-blue)]"
                  required
                />
                <span>
                  I consent to Spark requesting browser location for identity,
                  fraud, jurisdiction, and job-fit review.
                </span>
              </label>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 text-sm text-[var(--sn-ink-2)]">
              <label className="flex gap-3 rounded-lg border border-[var(--sn-coral-100)] bg-[var(--sn-coral-50)] p-3">
                <input
                  type="checkbox"
                  checked={form.manualReviewAcknowledged}
                  onChange={(event) =>
                    updateField(
                      "manualReviewAcknowledged",
                      event.target.checked
                    )
                  }
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--sn-coral)]"
                  required
                />
                <span>
                  I request manual recruiter review instead of the standard
                  AI-assisted workflow. I understand a recruiter may contact me
                  for written questions, a phone screen, or another human-led
                  assessment.
                </span>
              </label>
            </div>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 border-t border-[var(--sn-line)] bg-white p-4">
        <Button
          type="submit"
          disabled={loading}
          className="sn-button-coral h-12 w-full text-base font-extrabold"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
