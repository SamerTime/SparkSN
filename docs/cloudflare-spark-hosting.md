# Cloudflare Hosting For Spark

Target hostname:

```text
https://spark.tcwglobal.com
```

For the first hosted version, use Cloudflare as the public front door and keep
Spark running as a normal Next.js app behind it. This fits the current stack:
Next.js, Supabase, and Spark API routes.

## Cloudflare Dashboard Setup

In Cloudflare Zero Trust:

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

That service URL is for the current Windows Docker Desktop/local dev setup,
where Spark is running on the host at `localhost:3000`.

When Spark runs as a Docker Compose app service in the same Docker network, use:

```text
Service URL: http://app:3000
```

## Local Tunnel Run

Add the copied token to `.env`:

```env
CLOUDFLARE_TUNNEL_TOKEN="paste-cloudflare-token-here"
SPARK_PUBLIC_JOBS_BASE_URL="https://spark.tcwglobal.com/jobs"
```

Start Spark locally if it is not already running:

```powershell
tools\pnpm.exe dev
```

Start only the Cloudflare connector:

```powershell
docker compose -f docker-compose.cloudflare.yaml up -d
```

Check logs:

```powershell
docker compose -f docker-compose.cloudflare.yaml logs -f cloudflared
```

Then open:

```text
https://spark.tcwglobal.com/jobs
```

## If You Created A Cloudflare Worker Build

The current Spark app is a normal Next.js server app with Supabase server
queries and API routes. A Cloudflare Worker project connected to GitHub
with these settings is not enough:

```text
Build command: pnpm run build
Deploy command: npx wrangler deploy
Environment variables: none
Branch: main
```

Problems with that setup:

- Cloudflare is building `main`, while the current Spark work is on
  `spark-module-setup`.
- The runtime needs environment variables, at minimum `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SPARK_API_KEY`, and
  `SPARK_PUBLIC_JOBS_BASE_URL`.
- A Next.js app on Cloudflare Workers needs the OpenNext Cloudflare adapter, not
  plain `npx wrangler deploy`.
- Running the app fully inside Workers is a later architecture change.

For now, use the Tunnel setup above. If Spark later moves fully to Workers, add
OpenNext, Wrangler config, Cloudflare-compatible database access, and Worker
secrets as a separate build slice.

## Production Notes

- `SPARK_PUBLIC_JOBS_BASE_URL` must be `https://spark.tcwglobal.com/jobs`.
- `SPARK_API_KEY` must match the StaffingNation publish secret.
- Keep Supabase service keys in the host secret manager.
- Cloudflare should terminate HTTPS and proxy only to Spark.
- The Spark pages that read database data are marked dynamic so Docker builds do
  not need live database reads during image creation.

## Later Hardening

- Restrict `/spark/recruiter` to authenticated recruiter users.
- Add Cloudflare Access in front of recruiter-only routes.
- Add WAF/rate limiting for public apply endpoints.
- Move secrets into the production host secret manager.
- Add a permanent production Node host behind the same Cloudflare hostname.
