# Spark Local Setup

## Where This Is Built

Spark is built in this repo (`SN-Spark`) as the public/candidate/recruiter
module.

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
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/staffingnation_spark"
REDIS_URL="redis://localhost:6379"

NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="replace-me"

SPARK_API_KEY="replace-with-shared-secret"
SPARK_PUBLIC_JOBS_BASE_URL="https://tcwtable.com/jobs"

OPENAI_API_KEY=
GEMINI_API_KEY=
```

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

Start database/Redis if using Docker:

```bash
docker-compose up -d
```

Apply migrations and generate Prisma client:

```bash
pnpm prisma migrate deploy
pnpm prisma generate
```

In this Codex Windows workspace, use the repo-local pnpm binary and put the
bundled Node runtime first on PATH before Prisma commands:

```powershell
$env:PATH="C:\Users\samer\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;$env:PATH"
tools\pnpm.exe prisma migrate deploy
tools\pnpm.exe prisma generate
```

Run Spark:

```bash
pnpm dev
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
