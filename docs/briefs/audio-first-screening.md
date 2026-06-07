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

## Open questions
- Whisper accuracy on phone-mic audio in noisy environments — may need a paid
  provider for production quality.
- Per-question segments vs one-recording+timestamps (A vs B) — confirm with the
  recording owner.
- Retention: how long are raw recordings kept vs transcripts (compliance — ties to
  the Notice at Collection).

## References
- `src/components/spark/SparkInterviewSession.tsx` — recording + per-question UI
- `src/app/api/spark/interviews/[token]/complete/route.ts` — completion + Roger review
- `src/app/api/spark/interviews/[token]/upload/route.ts` — recording upload/storage
- `src/components/spark/RogerCandidateCoach.tsx` — the "Run Roger analysis" trigger (for #5)
