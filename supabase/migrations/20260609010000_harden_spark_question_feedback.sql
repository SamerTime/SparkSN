-- Harden recruiter feedback storage for environments where the original
-- spark_question_feedback migration has already been applied.

BEGIN;

ALTER TABLE public.spark_question_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spark_question_feedback FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.spark_question_feedback FROM anon;
REVOKE ALL ON TABLE public.spark_question_feedback FROM authenticated;
GRANT ALL ON TABLE public.spark_question_feedback TO service_role;

COMMIT;
