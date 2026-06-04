# Cloudflare Hosting For Spark

Target hostname:

```text
https://spark.tcwglobal.com
```

For the hosted version, deploy Spark as a Cloudflare Worker using the
OpenNext Cloudflare adapter. Supabase remains the backend database and storage
layer.

## Cloudflare Worker Setup

Create a new Cloudflare Workers project from GitHub and connect:

```text
Repository: SamerTime/SparkSN
Branch: main
Root directory: /
Build command: pnpm run build:worker
Deploy command: pnpm run deploy:worker
Version command: pnpm run upload:worker
```

The deploy and upload scripts pass `--keep-vars` so dashboard-managed secrets,
including `SUPABASE_SERVICE_ROLE_KEY`, survive each deployment.

The repo contains:

```text
wrangler.jsonc
open-next.config.ts
```

`wrangler.jsonc` sets `nodejs_compat`, points Wrangler at
`.open-next/worker.js`, and keeps dashboard-managed environment variables during
deploys. It also registers `spark.tcwglobal.com` as the production custom
domain and disables the extra `workers.dev` preview URLs.

## Cloudflare Variables And Secrets

Add these to the Worker in Cloudflare. Set them for both build-time and runtime
when the dashboard offers both.

```text
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SPARK_PUBLIC_JOBS_BASE_URL
```

Use:

```text
SPARK_PUBLIC_JOBS_BASE_URL=https://spark.tcwglobal.com/jobs
```

`SUPABASE_SERVICE_ROLE_KEY` and `SPARK_API_KEY` should be secrets, not plain
text variables.

The non-secret values above are also checked into `wrangler.jsonc` so Worker
deployments always have them. Keep only these values in the Cloudflare dashboard
as secrets:

```text
SUPABASE_SERVICE_ROLE_KEY
SPARK_API_KEY
```

## Local Worker Build

Run a normal Next build:

```powershell
tools\pnpm.exe build
```

Run the Cloudflare Worker build:

```powershell
tools\pnpm.exe build:worker
```

OpenNext can warn that Windows is not its preferred local environment. The
Cloudflare build runs on Linux, which avoids local Windows symlink issues.

## Optional Local Tunnel

If a temporary tunnel is needed before the Worker is live, use Cloudflare Zero
Trust:

1. Go to `Networks` -> `Tunnels`.
2. Create a tunnel named `staffingnation-spark`.
3. Choose Docker as the connector.
4. Copy the generated tunnel token.
5. Add a public hostname:

```text
Subdomain: spark
Domain: tcwglobal.com
Path: blank
Service type: HTTP
Service URL: http://host.docker.internal:3000
```

Then add the copied token to `.env` and run:

```powershell
docker compose -f docker-compose.cloudflare.yaml up -d
docker compose -f docker-compose.cloudflare.yaml logs -f cloudflared
```

## Production Notes

- `SPARK_PUBLIC_JOBS_BASE_URL` must be `https://spark.tcwglobal.com/jobs`.
- `SPARK_API_KEY` must match the StaffingNation publish secret.
- Keep Supabase service keys in the host secret manager.
- The Spark pages that read database data are marked dynamic.
- The Worker must use `nodejs_compat` for the Next.js/OpenNext runtime.

## Later Hardening

- Restrict `/spark/recruiter` to authenticated recruiter users.
- Add Cloudflare Access in front of recruiter-only routes.
- Add WAF/rate limiting for public apply endpoints.
