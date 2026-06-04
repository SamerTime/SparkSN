# Spark Local Setup

## Where This Is Built

Spark is built in this repo as the public/candidate/recruiter module.

StaffingNation / Staffing Studio lives in the sibling checkout:

```text
staffing-studio-hub/
```

The integration boundary is:

```text
StaffingNation JD -> spark-jd-publish edge function -> Spark API receiver
```

StaffingNation keeps job description and job order source-of-truth data.
Spark keeps candidate profiles, applications, interview media, AI summaries,
recruiter notes, comms state, device signals, and location/fraud signals.

## Local URLs

Spark app:

```text
http://localhost:3000
```

Spark JD receiver:

```text
http://localhost:3000/api/spark/job-postings
```

Spark recruiter review:

```text
http://localhost:3000/spark/recruiter
```

Public jobs base URL for generated posting links:

```text
https://tcwtable.com/jobs
```

## Spark Environment

Create `.env` from `.env.example` and set:

```env
SUPABASE_URL="https://xmidhrqlfsnkhoadpgsh.supabase.co"
NEXT_PUBLIC_SUPABASE_URL="https://xmidhrqlfsnkhoadpgsh.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="..."
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

SPARK_API_KEY="replace-with-shared-secret"
SPARK_PUBLIC_JOBS_BASE_URL="https://tcwtable.com/jobs"

OPENAI_API_KEY=
```

`SUPABASE_DATABASE_URL` is only needed when applying SQL migrations.

## StaffingNation Environment

In `staffing-studio-hub`, configure the Supabase function secrets for local or
deployed edge functions:

```env
SPARK_JD_PUBLISH_URL="http://localhost:3000/api/spark/job-postings"
SPARK_API_KEY="same-value-as-spark"
SPARK_PUBLIC_JOBS_BASE_URL="https://tcwtable.com/jobs"
```

## Commands

Install dependencies:

```bash
pnpm install
```

Apply the Supabase SQL schema if needed:

```powershell
psql "$env:SUPABASE_DATABASE_URL" --set ON_ERROR_STOP=1 --file "supabase/migrations/20260604000000_spark_schema.sql"
```

If `psql` is not installed locally, use Docker:

```powershell
docker compose -f docker-compose.migrate.yaml run --rm supabase-migrate
```

Run Spark:

```bash
pnpm dev
```

In this Codex Windows workspace, use the repo-local pnpm binary and put the
bundled Node runtime first on PATH before running app commands:

```powershell
$env:PATH="C:\Users\samer\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;$env:PATH"
tools\pnpm.exe dev
```

## First Integration Test

1. Start Spark on `localhost:3000`.
2. Set `SPARK_JD_PUBLISH_URL` and `SPARK_API_KEY` in StaffingNation.
3. In StaffingNation, activate a job description.
4. Use the JD row menu action `Publish to Spark`.
5. Spark should upsert a row in `SparkJobPosting` and return:

```json
{
  "success": true,
  "spark_posting_id": "...",
  "public_url": "https://tcwtable.com/jobs/...",
  "source_entity_id": "..."
}
```

## Public Apply Test

After a job appears on `/jobs`, open its detail page and choose `Start
application`. The apply page creates or updates:

- `SparkCandidateProfile`
- `SparkApplication`
- consent timestamps
- location/device signal JSON
- communication event JSON for later Courier delivery

Recruiter review actions are available at:

```text
http://localhost:3000/spark/recruiter
```

## Next Build Slices

1. Mobile camera/microphone readiness and interview consent.
2. AI question generation and interview session.
3. Media storage and stronger location/device risk scoring.
4. Courier-driven candidate/recruiter communications.
5. Auth and permission hardening for the recruiter review queue.
