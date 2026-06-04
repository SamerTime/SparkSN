# Supabase Setup For Spark

Spark Supabase project:

```text
https://xmidhrqlfsnkhoadpgsh.supabase.co
```

Supabase should own the backend data and storage layer for Spark:

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
DATABASE_URL="..."
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

Copy a Postgres connection string for Prisma. Keep the password included in the
secret value, but never commit it.

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

## Migration Plan

1. Add Supabase keys and `DATABASE_URL` to `.env`.
2. Run Prisma migrations against Supabase:

```powershell
tools\pnpm.exe prisma migrate deploy
```

3. Generate Prisma client:

```powershell
tools\pnpm.exe prisma generate
```

4. Publish a test job from StaffingNation or call the Spark receiver.
5. Submit a test Spark application.
6. Confirm `/spark/recruiter` reads from Supabase data.

## GitHub To Supabase Migrations

The repo includes a GitHub Actions workflow at
`.github/workflows/supabase-prisma-migrate.yml`. It installs dependencies,
generates Prisma, and runs:

```bash
pnpm prisma migrate deploy
```

Add this repository secret in GitHub:

```text
SUPABASE_DATABASE_URL
```

Use the Supabase shared pooler URI for the secret value:

```text
postgresql://postgres.xmidhrqlfsnkhoadpgsh:<DB_PASSWORD>@aws-1-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1
```

Replace `<DB_PASSWORD>` with the actual database password, with no brackets.
Keep the secret out of commits. The workflow runs manually and on pushes to
`main` or `spark-module-setup` when Prisma or workflow files change.

## Cloudflare Pairing

Cloudflare should point `spark.tcwglobal.com` at the hosted Spark app. Supabase
does not replace the Spark web host; it provides the backend services Spark uses.

Production env values should include:

```env
NEXTAUTH_URL="https://spark.tcwglobal.com"
SPARK_PUBLIC_JOBS_BASE_URL="https://spark.tcwglobal.com/jobs"
```
