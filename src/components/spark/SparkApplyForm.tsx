"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LocateFixed, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SparkApplyFormProps = {
  postingSlug: string;
  postingTitle: string;
};

type LocationCapture = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type Submission = {
  applicationId: string;
  status: string;
  nextStep: string;
};

export function SparkApplyForm({
  postingSlug,
  postingTitle,
}: SparkApplyFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [location, setLocation] = useState<LocationCapture | null>(null);
  const [locationStatus, setLocationStatus] = useState(
    "Location can be captured from the phone/browser after consent."
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
    aiInterviewConsent: false,
    recordingConsent: false,
    geolocationConsent: false,
  });

  const updateField = (
    field: keyof typeof form,
    value: string | boolean
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const captureLocation = () => {
    if (!form.geolocationConsent) {
      toast.error("Please consent to location review first.");
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("This browser does not support location capture.");
      return;
    }

    setCapturingLocation(true);
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
        setLocationStatus(
          `Location captured with about ${
            nextLocation.accuracy ? Math.round(nextLocation.accuracy) : "unknown"
          }m accuracy.`
        );
        setCapturingLocation(false);
      },
      (error) => {
        setLocation(null);
        setLocationStatus(error.message || "Location capture was not approved.");
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
          location,
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
      <div className="rounded-md border border-[#b7d4cb] bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#edf5f1] text-[#176c5d]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-[#15191e]">
          Profile submitted
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#59616b]">
          Spark created application{" "}
          <span className="font-medium text-[#15191e]">
            {submission.applicationId}
          </span>{" "}
          for {postingTitle}. {submission.nextStep}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="bg-[#20282d] text-white hover:bg-[#344047]"
            onClick={() => router.push("/jobs")}
          >
            Back to jobs
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-[#d8d1c6]"
            onClick={() => router.push("/spark/recruiter")}
          >
            View recruiter queue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-md border border-[#d8d1c6] bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-[#15191e]">
          Create Spark profile
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#59616b]">
          This starts recruiter review for {postingTitle}. The short AI video
          interview is only sent after a recruiter approves or invites you.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input
            id="firstName"
            value={form.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
            required
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input
            id="lastName"
            value={form.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
            required
            autoComplete="family-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            required
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={form.state}
            onChange={(event) => updateField("state", event.target.value)}
            autoComplete="address-level1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="availableToStart">Availability</Label>
          <Input
            id="availableToStart"
            value={form.availableToStart}
            onChange={(event) =>
              updateField("availableToStart", event.target.value)
            }
            placeholder="Immediately, 2 weeks, specific date"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="preferredChannel">Preferred communication</Label>
          <select
            id="preferredChannel"
            value={form.preferredChannel}
            onChange={(event) =>
              updateField("preferredChannel", event.target.value)
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="sms">Text message</option>
            <option value="email">Email</option>
            <option value="phone">Phone call</option>
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="experienceSummary">Relevant experience</Label>
        <textarea
          id="experienceSummary"
          value={form.experienceSummary}
          onChange={(event) =>
            updateField("experienceSummary", event.target.value)
          }
          placeholder="A few sentences about work you have done that relates to this role."
          className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="mt-6 rounded-md border border-[#d8d1c6] bg-[#f7f4ef] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#176c5d]" />
          <div>
            <h3 className="font-semibold text-[#15191e]">
              Consent and fraud review
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#59616b]">
              Spark uses these consents before sending a mobile interview link
              and capturing location signals for identity and fraud review.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-[#4f5963]">
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={form.aiInterviewConsent}
              onChange={(event) =>
                updateField("aiInterviewConsent", event.target.checked)
              }
              className="mt-1 h-4 w-4 shrink-0 accent-[#176c5d]"
              required
            />
            I consent to a short AI-assisted interview for this job.
          </label>
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={form.recordingConsent}
              onChange={(event) =>
                updateField("recordingConsent", event.target.checked)
              }
              className="mt-1 h-4 w-4 shrink-0 accent-[#176c5d]"
              required
            />
            I consent to camera and microphone recording when I start the
            interview.
          </label>
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={form.geolocationConsent}
              onChange={(event) =>
                updateField("geolocationConsent", event.target.checked)
              }
              className="mt-1 h-4 w-4 shrink-0 accent-[#176c5d]"
              required
            />
            I consent to location capture for identity, fraud, and job-fit
            review.
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-md bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[#59616b]">{locationStatus}</div>
          <Button
            type="button"
            variant="outline"
            className="border-[#d8d1c6]"
            onClick={captureLocation}
            disabled={capturingLocation}
          >
            {capturingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            Capture location
          </Button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="mt-6 w-full bg-[#20282d] text-white hover:bg-[#344047]"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit for recruiter review
      </Button>
    </form>
  );
}
