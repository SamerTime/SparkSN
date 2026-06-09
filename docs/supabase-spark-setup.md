# Supabase Setup For Spark

Spark Supabase project:

```text
https://xmidhrqlfsnkhoadpgsh.supabase.co
```

Supabase owns the backend data and storage layer for Spark:

- Spark job postings
- Candidate profiles
- Applications
- Interview metadata
- Consent timestamps
- Location/device review signals
- Resume and interview media storage

## Required Values

Add these to local `.env` and to the production host secrets:

```env
SUPABASE_URL="https://xmidhrqlfsnkhoadpgsh.supabase.co"
NEXT_PUBLIC_SUPABASE_URL="https://xmidhrqlfsnkhoadpgsh.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="..."
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
SUPABASE_DATABASE_URL="..."
```

Use the Supabase dashboard:

```text
Project Settings -> API
```

Copy:

- Project URL
- publishable key, or anon public key if the dashboard shows the older key name
- service_role secret key

Use:

```text
Project Settings -> Database -> Connection string
```

Copy the shared pooler URI for `SUPABASE_DATABASE_URL`. This is used only by
SQL migration scripts and GitHub Actions. Keep it out of commits.

## Storage Buckets

Create these buckets:

```text
spark-resumes
spark-interviews
spark-candidate-documents
```

Recommended first-pass privacy:

- Buckets private.
- Candidate uploads go through signed upload URLs or server routes.
- Recruiter downloads go through signed read URLs after permission checks.

## SQL Migration Plan

1. Add Supabase keys to `.env`.
2. Apply checked-in SQL migrations from `supabase/migrations`.
3. Publish a test job from StaffingNation or call the Spark receiver.
4. Submit a test Spark application.
5. Confirm `/spark/recruiter` reads from Supabase data.

Local PowerShell migration command:

```powershell
psql "$env:SUPABASE_DATABASE_URL" --set ON_ERROR_STOP=1 --file "supabase/migrations/20260604000000_spark_schema.sql"
```

Docker migration command if `psql` is not installed:

```powershell
docker compose -f docker-compose.migrate.yaml run --rm supabase-migrate
```

If `psql` is not installed locally, run the SQL directly in Supabase:

```text
Supabase Dashboard -> SQL Editor -> New query
```

Paste the contents of the migration file and run it.

## GitHub To Supabase Migrations

The repo includes:

```text
.github/workflows/supabase-sql-migrate.yml
```

Add this repository secret in GitHub:

```text
SUPABASE_DATABASE_URL
```

Use the Supabase shared pooler URI for the secret value:

```text
postgresql://postgres.xmidhrqlfsnkhoadpgsh:<DB_PASSWORD>@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require
```

Replace `<DB_PASSWORD>` with the actual database password, with no brackets.
Keep this secret scoped to the `production` GitHub Environment and configure
required reviewers for that environment before enabling automated migrations.
The workflow runs on pushes to `main` when SQL migration files change. Manual
runs are also limited to the `main` branch by the workflow job guard.

## Cloudflare Pairing

Cloudflare should point `spark.tcwglobal.com` at the hosted Spark app. Supabase
does not replace the Spark web host; it provides the backend services Spark uses.

Production env values should include:

```env
SPARK_PUBLIC_JOBS_BASE_URL="https://spark.tcwglobal.com/jobs"
```
