-- Spark storage hardening — deny anon/authenticated all access to interview
-- recordings.
--
-- The previous migration locked DB tables down. The remaining gap: the
-- spark-interview-recordings bucket allowed anon to LIST folder names (an empty
-- bucket today, but once real clips land an attacker could enumerate
-- applicationIds). The bucket is already `public = false` so downloads are
-- blocked, but listing is governed by RLS policies on storage.objects.
--
-- Pattern: drop any prior Spark policies (idempotent), then add explicit deny
-- policies for anon + authenticated. Service-role bypasses storage RLS, so the
-- server-issued signed-URL upload + signed-URL download paths continue to work
-- (uploadToSignedUrl / createSignedUrl use server-side tokens, not role grants).

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'spark recordings%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end$$;

-- Deny all anon/authenticated access to the spark-interview-recordings bucket.
-- The `using (false)` evaluates to false for every row -> nothing is visible
-- to these roles. `with check (false)` blocks INSERT/UPDATE the same way.
create policy "spark recordings - deny anon all"
  on storage.objects
  as restrictive
  for all
  to anon
  using (bucket_id <> 'spark-interview-recordings')
  with check (bucket_id <> 'spark-interview-recordings');

create policy "spark recordings - deny authenticated all"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using (bucket_id <> 'spark-interview-recordings')
  with check (bucket_id <> 'spark-interview-recordings');

notify pgrst, 'reload schema';
