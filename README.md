# StaffingNation Spark

Spark is the candidate-facing module for StaffingNation-published job
descriptions. StaffingNation/Staffing Studio owns job orders and job
description authoring; Spark receives approved postings through an API, shows
them on a public jobs page, and will manage the separate candidate profile,
short mobile interview, recruiter review, and AI summary workflow.

## Current Build

- `POST /api/spark/job-postings` receives StaffingNation job description
  payloads and upserts Spark postings.
- `/jobs` lists published Spark roles.
- `/jobs/[slug]` shows full role details and the planned Spark apply path.
- Prisma models now separate Spark postings, candidate profiles, and
  applications from the legacy app data.
- `staffing-studio-hub` contains the matching Staffing Studio publish function
  and job description UI action.

## V1 Direction

Spark should stay modular. Candidate data does not need to live in
StaffingNation for the first release. The near-term flow is:

1. A recruiter approves/publishes a job description in StaffingNation.
2. StaffingNation sends sanitized JD data to Spark through the shared API key.
3. Spark displays the posting on the public jobs page.
4. A candidate creates a Spark profile and starts the apply path.
5. Recruiters review the candidate and invite or approve the short interview.
6. Spark captures phone-friendly video answers, location/fraud signals, and a
   job-related AI summary for recruiter review.

Returning vetted candidates into StaffingNation is a later integration.

## Local Development

Prerequisites:

- Docker Desktop
- Node.js 20+
- pnpm, or the repo-local `tools/pnpm.exe`

Start the local services:

```powershell
docker compose up -d db redis
```

Install dependencies:

```powershell
tools\pnpm.exe install
```

Run database migrations:

```powershell
tools\pnpm.exe prisma migrate deploy
```

Start the app:

```powershell
tools\pnpm.exe dev
```

Open the app at [http://localhost:3000/jobs](http://localhost:3000/jobs).

## Environment

Copy `.env.example` to `.env` and set the local values:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/staffingnation_spark"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="replace-with-a-local-secret"
SPARK_API_KEY="replace-with-a-shared-publish-secret"
SPARK_PUBLIC_JOBS_BASE_URL="https://tcwtable.com/jobs"
```

If you already have a local database from the earlier prototype, keep your
existing `.env` value until you intentionally migrate or recreate the database.

## Key Paths

- `src/app/jobs/page.tsx` - public published jobs list
- `src/app/jobs/[slug]/page.tsx` - public job detail page
- `src/app/api/spark/job-postings/route.ts` - StaffingNation publish receiver
- `prisma/schema.prisma` - Spark posting/application/profile models
- `docs/spark-local-setup.md` - local setup details
- `staffing-studio-hub/supabase/functions/spark-jd-publish/index.ts` -
  Staffing Studio publish function

## Stack

- Next.js 15
- React 19
- TypeScript
- Prisma
- PostgreSQL
- Redis
- NextAuth
- Tailwind CSS

Planned integrations include Courier for communications, Cloudflare for public
delivery and security controls, Supabase for Staffing Studio functions, and
mobile-ready camera/microphone capture for Spark interviews.
