Steps (in build order)
Schema. Add a job_order_question_banks table (or job_orders.metadata.spark_question_bank if you want to stay metadata-only in v1). Fields: job_order_id, payload_version, generated_at, generated_by (ai | recruiter), reviewed_at, reviewed_by_user_id, status (draft | approved | retired), questions (jsonb array — see shape below), model_name, prompt_version, seed_hash.
Edge function spark-question-bank-generate — POST { job_order_id }. Reads the linked JD, generates the bank deterministically (temperature=0, fixed seed where the provider supports it, prompt version pinned), writes status draft. Auth via canManageWorkersForClient. Never per-candidate.
Recruiter review surface. A pusher panel on the Job Order row: list of questions, edit/remove/add, then Approve. No approval → Spark publish is blocked. This is your bias audit trail.
Publish wiring. spark-job-order-publish reads status='approved' bank, sends the bank as part of the Spark payload (extend payload_version minor → staffingnation.job_order.v1.1). If no approved bank exists, return 409 with reason: question_bank_not_approved.
Retire on JD change. When the linked JD's required_skills/responsibilities change, mark bank retired, force regeneration. Track this via a JD-version foreign key on the bank.
No per-candidate probing in v1. Period. v2 can add a separate "adaptive follow-up" agent gated by a documented bias review and a DECISIONS.md entry.
Question shape (JSON in questions[])
{
  \"id\": \"uuid\",
  \"text\": \"Walk me through how you'd structure...\",
  \"type\": \"technical\" | \"behavioral\" | \"role_specific\",
  \"source\": \"jd.required_skills[2]\" | \"jd.responsibilities[0]\" | \"behavioral_bank\",
  \"target_seconds\": 18,
  \"editable\": true
}
Target ~10 questions tied to ai_question_count_target, not hardcoded.

Brief to drop in docs/briefs/spark-question-bank-v1.md
Sections to include, in this order, matching your existing brief pattern:

Status: ready
Scope: JD-driven question bank, recruiter approval gate, Spark payload extension. NO per-candidate personalization.
What NOT to do: no per-candidate prompts; no temperature > 0; no "gap probing" field; no storage of candidate responses in StaffingNation (Spark-owned per v1 boundaries).
Pre-flight: verify spark-job-order-publish is on canonical auth pattern (it is per recent commit 273e5b0); verify _shared/auth.ts has canManageWorkersForClient.
Watchdog flags to expect: new AI surface → NYC LL 144 / IL AIVIA / EU AI Act bias audit obligations. Pre-arm a DECISIONS.md entry stating: questions are JD-driven, recruiter-approved, identical for all applicants to the same Job Order, with full audit trail.
Success criteria: (a) bank generates deterministically — same JD twice produces identical text; (b) publish is blocked without status='approved'; (c) bank is retired and regenerated when JD required_skills change; (d) Spark payload v1.1 carries the bank; (e) audit log captures question_bank_generated, question_bank_approved, question_bank_retired.
Commit prefix: spark-questions:
Followup briefs: spark-question-bank-v2-adaptive.md (gated on bias framework).
