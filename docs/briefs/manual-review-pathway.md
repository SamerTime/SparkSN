# Brief: Manual Review Pathway (deferred)

**Status:** Deferred / hidden behind a flag.
**Owner:** TBD (intake added by Codex; flagged off pending a recruiter workflow).
**Flag:** `NEXT_PUBLIC_SPARK_MANUAL_REVIEW` (unset/`"false"` = hidden; `"true"` = shown).

## Why this exists / why it's deferred

The apply form (`src/components/spark/SparkApplyForm.tsx`) offers a **"Notice and
screening pathway"** choice: **Standard AI-assisted workflow** vs **Manual
recruiter review**. The *intake* for manual review is wired, but there is **no
recruiter-side workflow** for candidates who pick it, and the candidate status
breadcrumb does not represent them. To avoid shipping a dead-end, the Manual
recruiter review option is hidden behind `MANUAL_REVIEW_ENABLED`
(`process.env.NEXT_PUBLIC_SPARK_MANUAL_REVIEW === "true"`). Standard AI remains
the only candidate-visible path. The compliance **Notice at Collection** link is
kept.

## What is already built (do not rebuild)

- **Apply form:** pathway radios; `updateScreeningPathway()` clears the AI /
  recording / geolocation consents and sets `manualReviewAcknowledged` when
  manual is chosen; submit label + location controls adapt to the pathway. The
  manual radio is now wrapped in `{MANUAL_REVIEW_ENABLED && (…)}`.
- **Intake API** (`src/app/api/spark/applications/route.ts`): accepts
  `screeningPathway`; for `manual_review` it sets the application status to
  **`RecruiterReview`**, skips the AI/recording/location capture, persists
  `screeningPathway`, and records manual-specific consent timestamps.

Net effect today (if the flag were on): a manual application lands in the
recruiter queue at `RecruiterReview` ("Reviewing") with **no AI screen, no Roger
analysis, no interview invite**.

## The gap to close before enabling

1. **No recruiter workflow** for a no-AI-screen candidate (what does the recruiter
   do next?).
2. **Breadcrumb mismatch** — `SparkCandidateStepper` models
   `Applied → AI Screen Invited → Screening Complete → (Interview In-Person) →
   Outcome`. A manual candidate skips the two screening steps, so the stepper
   would show them as permanently "stuck."
3. **Trigger is undefined** — should a *candidate* be able to opt out of AI
   screening at all? (If yes, it becomes an easy escape hatch.)

## Proposed plan

1. **Decide the trigger.** Recommend manual review is **not** a free candidate
   choice. Options: (a) recruiter-initiated only, or (b) accommodation/
   accessibility request gated by a short reason. Pick one before building UI.
2. **Status model.** Branch the breadcrumb on the stored `screeningPathway`:
   manual → `Applied → Manual review → Outcome` (hide AI Screen Invited /
   Screening Complete). `SparkCandidateStepper` already receives the application;
   add a `pathway` input and a manual variant.
3. **Recruiter UI.** Add a **"Manual review"** chip + a queue filter; give the
   detail panel a no-AI action set (review profile → advance to in-person / hire
   / reject). Optional: **"Convert to AI screen"** — send the standard interview
   invite and move them onto the normal path.
4. **Compliance.** Confirm what notice/consent the manual path must still capture
   (coordinate with Codex's Notice at Collection). Document what data is and is
   not collected when AI is skipped.
5. **Guardrails / analytics.** Track manual vs standard volume; alert if manual
   becomes a large share (signals candidates dodging the screen).
6. **Enable.** Set `NEXT_PUBLIC_SPARK_MANUAL_REVIEW="true"` (Cloudflare) once the
   above ships.

## Acceptance criteria

- A manual-review candidate flows end to end: intake → recruiter queue with the
  correct status **and** a breadcrumb that reads sensibly → recruiter can take a
  terminal action → outcome.
- Consent / Notice at Collection requirements are satisfied for the manual path.
- Turning the flag off cleanly reverts to Standard-AI-only with no orphaned UI.

## Open questions

- Who triggers manual review, and why is it offered?
- Is "convert to AI screen later" in scope for v1?
- Compliance scope when the AI screen (and its consents) are skipped.
- Reporting: do we need manual-vs-standard outcome metrics?

## References

- `src/components/spark/SparkApplyForm.tsx` — pathway UI + `MANUAL_REVIEW_ENABLED`
- `src/app/api/spark/applications/route.ts` — `manual_review` intake handling
- `src/components/spark/SparkCandidateStepper.tsx` — status breadcrumb to extend
