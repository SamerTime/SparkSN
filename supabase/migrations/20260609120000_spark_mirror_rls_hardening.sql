-- Spark normalized mirror hardening.
--
-- The repository mirror stores candidate interview answers in public.spark_answers
-- and question-bank metadata in public.spark_questions / public.spark_question_bank_items.
-- These mirrors are server-side implementation details populated by triggers and
-- read with the Supabase service-role client, so browser-visible anon/auth roles
-- must not be able to read, write, or invoke the sync helpers through PostgREST.

BEGIN;

DO $$
DECLARE
  t text;
  mirror_tables text[] := array[
    'spark_questions',
    'spark_question_bank_items',
    'spark_answers'
  ];
BEGIN
  FOREACH t IN ARRAY mirror_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  function_signature text;
  function_regprocedure regprocedure;
  mirror_functions text[] := array[
    'public.spark_question_intent(text,text)',
    'public.spark_sync_question_bank(text)',
    'public.spark_sync_application_answers(text)',
    'public.spark_trg_sync_bank()',
    'public.spark_trg_sync_answers()'
  ];
BEGIN
  FOREACH function_signature IN ARRAY mirror_functions LOOP
    function_regprocedure := to_regprocedure(function_signature);
    IF function_regprocedure IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', function_regprocedure);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', function_regprocedure);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', function_regprocedure);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
