# Brief: Audio-first screening (transcribe the answer, don't type it)

**Status:** Phase 1 shipped; Phases 2–3 planned.
**Why:** Typed answers are **cheatable** (copy-paste from ChatGPT/Google), which
defeats the entire point of a video screen. The answer of record must be the
**audio extracted from the recording, transcribed to text** — what Roger reads.

## Current state (the gap)
- On completion, `interviews/[token]/complete` runs `reviewScreeningWithRoger`
  using the candidate's **typed `answers`** (the text box). The **video is
  recorded and stored** (`SPARK_INTERVIEW_RECORDINGS_BUCKET`) but **never
  transcribed**. So today the text box is the real data and the video is decorative
  for the AI.
- The deeper `analyze_responses` pass (3 in-person focus areas + lesson) is
  recruiter-triggered ("Run Roger analysis"), also off the typed answers.

## Target
The **spoken answer** (audio → transcript) is the data Roger analyzes; the typed
box is demoted to an **accessibility fallback** only.

## Phases

### Phase 1 — shipped (stopgap UI + anti-cheat)
- Progress `N / total` in Spark coral above each question; removed "The question
  is:" prefix; "answer out loud" hint.
- **Paste/drop disabled** on the text box (kills the obvious copy-paste cheat
  while transcription is built). Box still required for now (it's still the data).

### Phase 2 — transcription
- **Engine:** Cloudflare Workers AI **Whisper** (`@cf/openai/whisper`) — native to
  Spark's CF Worker, no external key, low cost. (Deepgram/AssemblyAI are paid
  alternatives if accuracy/diarization demands it later.)
  - **Infra needed:** enable Workers AI on the account + add the `AI` binding in
    `wrangler.jsonc`; confirm the Next-on-Cloudflare runtime can reach the binding.
- **Per-question mapping — recommend (A) per-question segments:** finalize a short
  audio clip each time the candidate hits "Next" → transcribe each → clean 1:1
  mapping to the question. (Alternative (B): one recording + question-start
  timestamps, slice Whisper word-timestamps — less front-end change, fuzzier
  boundaries.)
- Run transcription **async after completion** (don't block the candidate's
  submit): on the stored recording, write transcripts back onto
  `interviewTranscript.answers[i].transcript`.

### Phase 3 — Roger reads the transcript; box becomes fallback
- Swap `answers` (typed) → transcribed answers in both `reviewScreeningWithRoger`
  and `analyze_responses`.
- Demote the typed box to **optional** (accessibility / mic-failure fallback);
  keep paste disabled. Drop the "answer required to continue" gate once audio is
  the source.

## #5 — auto-run Roger's deeper analysis (decision: lazy on recruiter open)
- The basic AI summary already runs on completion. For the deeper
  `analyze_responses` pass, **auto-trigger it when a recruiter opens a completed,
  not-yet-analyzed candidate** (spinner → result) instead of a manual "Run Roger
  analysis" click. Keeps the candidate's submit fast and only spends the Opus call
  when someone actually reviews. (Alternative: sync on completion — slower submit,
  runs even if never reviewed.)

## VALIDATED (2026-06-07)
Increment 1 deployed (PR #22) and tested on a real candidate recording:
**`@cf/openai/whisper` transcribes our webm VIDEO directly** — no audio-only
rebuild needed. (`/api/spark/applications/[id]/transcribe` returned clean text;
stored on `interviewMedia.session.recording.audioTranscript`; typed answers
untouched.) Bonus: a test transcript literally contained *"I can't move forward
without typing"* — real evidence the typed requirement is friction to drop.

## DECISION — per-question segments (Increment 2a)
Record **per-question video clips** (start on question show, finalize + **upload
on "Next"**), not one continuous recording. Rationale: smaller files, **incremental
upload while the candidate moves on** (the end-of-session bulk upload is the
fragile part on phones), resilience (a failed clip ≠ lost session), and clean 1:1
question→transcript mapping. Each clip is transcribed individually (Whisper on
webm — proven).

## Per-answer data model
```
mode:        "spoken" | "typed"          // default spoken
reason:      "accessibility" | "technical" | "cant_speak" | "other" (+ note)  // typed only
language:    e.g. "es" (Whisper-detected) // spoken only
transcript:  original-language text        // spoken
translation: English text                  // spoken (recruiter readability)
typedAnswer: text                          // typed
clipPath:    storage path of the per-question clip  // spoken
```
- **Typed = flagged exception:** per-question **pencil** toggle → reason
  dropdown (accessibility / technical / can't speak aloud / other) → box activates
  (paste disabled), recording skipped for that question, answer tagged `typed`.
- **Surface to Roger** (mode + reason in the prompt) **and the recruiter**
  ("Typed" badge + "N of 10 typed" count). Default video + visible typed flag
  preserves the anti-cheat intent.
- **Multilingual:** Whisper supports ~99 languages — candidates may **speak their
  own language**; store original + English translation + detected language, show
  the recruiter English with a "spoken in X" tag. (Reduces the need to type for
  language reasons.)

## Future releases
- **Candidate transparency email:** after the screen, email the candidate their
  **questions + their text** (transcript) for transparency.
- **Recording retention/deletion — COUNSEL DECISION (do not auto-delete):**
  employment law (EEOC ~1yr hiring-record retention, 2yr for federal contractors,
  longer if a charge is filed) likely **requires retaining** the recording; deleting
  after litigation is anticipated risks **spoliation**. Defensible pattern: retain
  per a **documented schedule, then auto-delete** — and the candidate email says
  "kept securely for [X] then deleted," NOT "deleted now." Settle the policy with
  legal before promising deletion.

## Open questions
- Whisper accuracy on phone-mic audio in noisy environments — may need a paid
  provider (Deepgram/AssemblyAI) for production quality.
- Translation: Whisper translate-task vs a separate model — confirm Cloudflare
  params (language detection output + translate) during 2b.
- 2a recorder rework changes the production candidate flow and **can't be tested
  locally (no camera) or by the agent** — must be **real-phone tested on a branch
  before merge**.

## References
- `src/components/spark/SparkInterviewSession.tsx` — recording + per-question UI
- `src/app/api/spark/interviews/[token]/complete/route.ts` — completion + Roger review
- `src/app/api/spark/interviews/[token]/upload/route.ts` — recording upload/storage
- `src/components/spark/RogerCandidateCoach.tsx` — the "Run Roger analysis" trigger (for #5)
