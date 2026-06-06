-- Question repository v2 (Approach A: additive normalized mirror).
--
-- Source of truth stays the JSONB on SparkQuestionBank.questions and
-- SparkApplication.interviewTranscript.answers. This migration adds normalized,
-- relational tables that MIRROR that JSONB so the repository/analytics can do
-- real SQL joins (question <-> answer <-> job order). Triggers keep the mirror
-- fresh on every write; the backfill at the end (re-run on every deploy by the
-- migrate workflow) reconciles existing data idempotently.
--
-- Idempotent + atomic: CREATE ... IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP TRIGGER IF EXISTS, and delete+reinsert syncs. Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.spark_questions (
  id text PRIMARY KEY,
  bank_id text NOT NULL,
  posting_id text NOT NULL,
  text text NOT NULL,
  type text NOT NULL DEFAULT 'role_specific',
  source text NOT NULL DEFAULT '',
  intent text NOT NULL DEFAULT '',
  generator text NOT NULL DEFAULT 'system',
  model text,
  prompt_version text,
  mcp_run_id text,
  target_seconds integer,
  rubric jsonb,
  ideal_evidence jsonb,
  red_flags jsonb,
  scoring jsonb,
  bank_status text,
  created_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spark_questions_posting ON public.spark_questions(posting_id);
CREATE INDEX IF NOT EXISTS idx_spark_questions_bank ON public.spark_questions(bank_id);
CREATE INDEX IF NOT EXISTS idx_spark_questions_type ON public.spark_questions(type);

CREATE TABLE IF NOT EXISTS public.spark_question_bank_items (
  bank_id text NOT NULL,
  question_id text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bank_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.spark_answers (
  id text PRIMARY KEY,
  application_id text NOT NULL,
  posting_id text,
  question_id text,
  question_text text,
  answer_text text NOT NULL,
  duration_seconds integer,
  created_at timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spark_answers_question ON public.spark_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_spark_answers_application ON public.spark_answers(application_id);
CREATE INDEX IF NOT EXISTS idx_spark_answers_posting ON public.spark_answers(posting_id);

-- Derive a one-line intent from a question's type + JD source.
CREATE OR REPLACE FUNCTION public.spark_question_intent(p_type text, p_source text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN position('skill' in lower(coalesce(p_source, ''))) > 0 THEN 'Probe hands-on depth in a required skill'
    WHEN position('responsibilit' in lower(coalesce(p_source, ''))) > 0 THEN 'See how they''d handle a core responsibility'
    WHEN position('requirement' in lower(coalesce(p_source, ''))) > 0 THEN 'Verify a must-have requirement'
    WHEN position('qualification' in lower(coalesce(p_source, ''))) > 0 THEN 'Confirm a stated qualification'
    WHEN position('behavioral' in lower(coalesce(p_source, ''))) > 0 THEN 'Assess a behavioral / soft-skill signal'
    WHEN position('availability' in lower(coalesce(p_source, ''))) > 0 THEN 'Confirm availability and logistics fit'
    WHEN lower(coalesce(p_type, '')) = 'safety' THEN 'Check safety / compliance awareness'
    WHEN lower(coalesce(p_type, '')) = 'behavioral' THEN 'Assess a behavioral / soft-skill signal'
    WHEN lower(coalesce(p_type, '')) = 'availability' THEN 'Confirm availability and logistics fit'
    WHEN lower(coalesce(p_type, '')) = 'technical' THEN 'Probe technical capability'
    ELSE 'Assess job-relevant fit'
  END
$$;

-- Re-derive one bank's questions + bank-items from its JSONB.
CREATE OR REPLACE FUNCTION public.spark_sync_question_bank(p_bank_id text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM public."SparkQuestionBank" WHERE id = p_bank_id;
  IF NOT FOUND THEN
    DELETE FROM public.spark_question_bank_items WHERE bank_id = p_bank_id;
    DELETE FROM public.spark_questions WHERE bank_id = p_bank_id;
    RETURN;
  END IF;

  DELETE FROM public.spark_question_bank_items WHERE bank_id = p_bank_id;
  DELETE FROM public.spark_questions WHERE bank_id = p_bank_id;

  INSERT INTO public.spark_questions (
    id, bank_id, posting_id, text, type, source, intent, generator, model,
    prompt_version, mcp_run_id, target_seconds, rubric, ideal_evidence,
    red_flags, scoring, bank_status, created_at
  )
  SELECT
    coalesce(nullif(q->>'id', ''), p_bank_id || ':' || (ord - 1)::text),
    p_bank_id,
    b."postingId",
    coalesce(q->>'text', ''),
    coalesce(nullif(q->>'type', ''), 'role_specific'),
    coalesce(q->>'source', ''),
    public.spark_question_intent(q->>'type', q->>'source'),
    coalesce(nullif(q->>'generator_label', ''), nullif(q->>'generated_by', ''), b."generatedBy", 'system'),
    b."modelName",
    b."promptVersion",
    b."mcpRunId",
    nullif(q->>'target_seconds', '')::numeric::int,
    q->'rubric',
    q->'ideal_evidence',
    q->'red_flags',
    q->'scoring',
    b.status,
    b."generatedAt"
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(b.questions) = 'array' THEN b.questions ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS t(q, ord)
  WHERE coalesce(q->>'text', '') <> ''
  ON CONFLICT (id) DO UPDATE SET
    bank_id = EXCLUDED.bank_id, posting_id = EXCLUDED.posting_id, text = EXCLUDED.text,
    type = EXCLUDED.type, source = EXCLUDED.source, intent = EXCLUDED.intent,
    generator = EXCLUDED.generator, model = EXCLUDED.model, prompt_version = EXCLUDED.prompt_version,
    mcp_run_id = EXCLUDED.mcp_run_id, target_seconds = EXCLUDED.target_seconds,
    rubric = EXCLUDED.rubric, ideal_evidence = EXCLUDED.ideal_evidence, red_flags = EXCLUDED.red_flags,
    scoring = EXCLUDED.scoring, bank_status = EXCLUDED.bank_status, created_at = EXCLUDED.created_at,
    synced_at = now();

  INSERT INTO public.spark_question_bank_items (bank_id, question_id, position)
  SELECT
    p_bank_id,
    coalesce(nullif(q->>'id', ''), p_bank_id || ':' || (ord - 1)::text),
    (ord - 1)::int
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(b.questions) = 'array' THEN b.questions ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS t(q, ord)
  WHERE coalesce(q->>'text', '') <> ''
  ON CONFLICT (bank_id, question_id) DO UPDATE SET position = EXCLUDED.position;
END $$;

-- Re-derive one application's answers from its transcript JSONB.
CREATE OR REPLACE FUNCTION public.spark_sync_application_answers(p_app_id text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE a record;
BEGIN
  SELECT id, "postingId", "interviewTranscript" INTO a
  FROM public."SparkApplication" WHERE id = p_app_id;
  IF NOT FOUND THEN
    DELETE FROM public.spark_answers WHERE application_id = p_app_id;
    RETURN;
  END IF;

  DELETE FROM public.spark_answers WHERE application_id = p_app_id;

  INSERT INTO public.spark_answers (
    id, application_id, posting_id, question_id, question_text, answer_text,
    duration_seconds, created_at
  )
  SELECT
    p_app_id || ':' || (ord - 1)::text,
    p_app_id,
    a."postingId",
    nullif(ans->>'questionId', ''),
    coalesce(ans->>'question', ''),
    coalesce(ans->>'answer', ''),
    nullif(ans->>'duration_seconds', '')::numeric::int,
    now()
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(a."interviewTranscript"->'answers') = 'array'
      THEN a."interviewTranscript"->'answers' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS t(ans, ord)
  WHERE coalesce(ans->>'answer', '') <> ''
  ON CONFLICT (id) DO UPDATE SET
    posting_id = EXCLUDED.posting_id, question_id = EXCLUDED.question_id,
    question_text = EXCLUDED.question_text, answer_text = EXCLUDED.answer_text,
    duration_seconds = EXCLUDED.duration_seconds, synced_at = now();
END $$;

-- Triggers keep the mirror fresh in real time.
CREATE OR REPLACE FUNCTION public.spark_trg_sync_bank()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.spark_sync_question_bank(NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_spark_sync_bank ON public."SparkQuestionBank";
CREATE TRIGGER trg_spark_sync_bank
  AFTER INSERT OR UPDATE ON public."SparkQuestionBank"
  FOR EACH ROW EXECUTE FUNCTION public.spark_trg_sync_bank();

CREATE OR REPLACE FUNCTION public.spark_trg_sync_answers()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.spark_sync_application_answers(NEW.id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_spark_sync_answers ON public."SparkApplication";
CREATE TRIGGER trg_spark_sync_answers
  AFTER INSERT OR UPDATE ON public."SparkApplication"
  FOR EACH ROW EXECUTE FUNCTION public.spark_trg_sync_answers();

-- Backfill / reconcile existing data (idempotent; re-runs each deploy).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public."SparkQuestionBank" LOOP
    PERFORM public.spark_sync_question_bank(r.id);
  END LOOP;
  FOR r IN SELECT id FROM public."SparkApplication" LOOP
    PERFORM public.spark_sync_application_answers(r.id);
  END LOOP;
END $$;

COMMIT;
