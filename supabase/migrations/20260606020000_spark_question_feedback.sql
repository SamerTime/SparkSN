-- Learning loop, Phase B: recruiter feedback on questions.
-- Stores both lightweight signals (up/down) and full lessons. Lessons are also
-- forwarded to the KaizenIs recruiting-lesson intake (kaizenis_queue_id records
-- the resulting training_queue id). Idempotent + atomic.

BEGIN;

CREATE TABLE IF NOT EXISTS public.spark_question_feedback (
  id text PRIMARY KEY,
  question_id text,
  posting_id text,
  application_id text,
  kind text NOT NULL,                              -- 'signal' | 'lesson'
  signal text,                                     -- 'up' | 'down' | null
  lesson_text text,
  applies_to text,
  origin text NOT NULL DEFAULT 'recruiter',        -- 'recruiter' | 'roger'
  outcome text,
  recruiter_id text,
  submitted_to_kaizenis boolean NOT NULL DEFAULT false,
  kaizenis_queue_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- This table stores recruiter-only learning signals and lessons. The
-- application writes and reads it exclusively through server-side API routes
-- backed by the Supabase service role, so direct Supabase client access must
-- remain closed even though the table lives in the exposed public schema.
ALTER TABLE public.spark_question_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spark_question_feedback FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.spark_question_feedback FROM anon;
REVOKE ALL ON TABLE public.spark_question_feedback FROM authenticated;
GRANT ALL ON TABLE public.spark_question_feedback TO service_role;

CREATE INDEX IF NOT EXISTS idx_spark_question_feedback_question
  ON public.spark_question_feedback(question_id);
CREATE INDEX IF NOT EXISTS idx_spark_question_feedback_kind
  ON public.spark_question_feedback(kind);
CREATE INDEX IF NOT EXISTS idx_spark_question_feedback_posting
  ON public.spark_question_feedback(posting_id);

COMMIT;
