-- Spark RLS hardening — best-practices lockdown.
--
-- Findings: every Spark API route runs server-side and uses the service-role
-- client (service-role bypasses RLS). The candidate's browser only uploads via
-- a server-issued signed URL (not anon role permissions). No client code reads
-- any Spark table directly. So we can safely lock every table down to
-- service-role-only without breaking the app.
--
-- For each table this migration:
--   1. enables row level security
--   2. forces RLS even for the table owner (defense in depth)
--   3. revokes anon + authenticated grants (no policies + no grants = no access)
--   4. service role still has full access (it bypasses RLS by design)
--
-- This closes the previously verified anon-readable exposures:
--   - SparkQuestionBank        (interview questions leak — applicants could pre-load)
--   - spark_questions / spark_question_bank_items (question-bank mirror)
--   - spark_answers            (candidate interview answer text mirror)
--   - SparkQuestionBankAuditEvent (recruiter activity timestamps)
--   - SparkApplicationDeletionLog (deleted-candidate PII)
--   - SparkJobPosting          (full rawPayload + internal fields)
-- and explicitly hardens the tables already covered by default-deny so the
-- hardening is declarative and auditable in the migration history.

do $$
declare
  t text;
  spark_tables text[] := array[
    'SparkApplication',
    'SparkCandidateProfile',
    'SparkJobInvitation',
    'SparkJobPosting',
    'SparkQuestionBank',
    'SparkQuestionBankAuditEvent',
    'SparkApplicationDeletionLog',
    'SparkSetting',
    'SparkQuestionFeedback',
    'SparkQuestion',
    'spark_questions',
    'spark_question_bank_items',
    'spark_answers'
  ];
begin
  foreach t in array spark_tables loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);
      execute format('revoke all on public.%I from anon', t);
      execute format('revoke all on public.%I from authenticated', t);
    end if;
  end loop;
end$$;

-- The mirror sync helpers are implementation details for triggers/backfills.
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default; revoke it so
-- browser clients cannot invoke the sync routines through Supabase RPC. Triggers
-- and service-role migrations continue to execute them without public grants.
do $$
declare
  function_signature text;
  function_regprocedure regprocedure;
  spark_functions text[] := array[
    'public.spark_question_intent(text,text)',
    'public.spark_sync_question_bank(text)',
    'public.spark_sync_application_answers(text)',
    'public.spark_trg_sync_bank()',
    'public.spark_trg_sync_answers()'
  ];
begin
  foreach function_signature in array spark_functions loop
    function_regprocedure := to_regprocedure(function_signature);
    if function_regprocedure is not null then
      execute format('revoke execute on function %s from public', function_regprocedure);
      execute format('revoke execute on function %s from anon', function_regprocedure);
      execute format('revoke execute on function %s from authenticated', function_regprocedure);
    end if;
  end loop;
end$$;

-- Storage bucket is already private (public=false from the earlier migration).
-- Uploads use server-issued signed tokens (uploadToSignedUrl); downloads use
-- service-role signed URLs. No anon storage policy is needed; keep the bucket
-- locked. Re-asserting `public = false` here for declarative clarity.
update storage.buckets set public = false where id = 'spark-interview-recordings';

notify pgrst, 'reload schema';
