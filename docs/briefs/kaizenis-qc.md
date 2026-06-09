# KaizenIs QC — Product Brief

> **Canonical spec for the "QC" feature on KaizenIs (dashboard47).**
> A repo-agnostic quality-control + UI-audit dashboard. Playwright runs the
> tests; Taquito audits the design + language; KaizenIs is the home for the
> history, the viewer, and the dashboard. Works across every KaizenIs project
> (Spark, dashboard47, tcw-lms, contingent-agent, payrolling, etc.).
>
> Owner: KaizenIs (Codex) for the dashboard + Taquito side · Each project owns
> its own tests · Status: spec (build pending)
>
> Sister brief: `dashboard47/docs/briefs/ai-screening-results.md` (the chip
> taxonomy pattern this brief mirrors).

---

## 1. Why this exists

Today our quality assurance is "Samer runs a manual smoke test, finds bugs in
production, files fixes." In one session we hit at least 7 prod bugs that
automated tests would have killed in CI. Meanwhile, design/language/accessibility
drift gets caught only when someone notices.

**Goal:** every KaizenIs project ships with a self-running QC pipeline whose
results live in a single dashboard, and every run is audited for look/feel/
language by Taquito.

**Non-goal:** replace human design review. Taquito surfaces evidence; humans
decide.

## 2. Three layers, three responsibilities

```
Playwright   = "did it work + does it look the same?"   (test runner)
Taquito      = "is it good?"                            (MCP-accessible design agent)
KaizenIs QC  = "where is the history + the viewer?"     (dashboard)
```

Each layer can ship and evolve independently. The artifacts they pass are files
+ JSON — no real-time coupling.

| Layer | Owns |
|---|---|
| **Playwright** | Functional tests (pass/fail) · visual-regression diffs (screenshot baselines) · failure traces |
| **Taquito** | Design audits · language/voice audits · accessibility audits · understandability audits — all chip-based with evidence |
| **KaizenIs QC** | Project registry · run dashboard · popout viewer · before/after diff · history + trends |

## 3. Where things live (storage architecture)

| Artifact | Where | Why |
|---|---|---|
| Test code (`tests/qc/*.spec.ts`) | **Each project's GitHub repo** | Sits next to the code it protects; PR-reviewable |
| `playwright.config.ts` | Each project's repo | Uses `@kaizenis/playwright-toolkit` factory (§7) |
| Visual-regression baselines (`__snapshots__/`) | **Each project's repo (committed)** | Source of truth for "how the app should look" — must be reviewable |
| Full `trace.zip` files | **GitHub Actions artifacts** (90-day retention) | Big, naturally per-run, devs already debug here |
| `qc-summary.json` + key screenshots | **KaizenIs (Supabase: DB + storage)** | Centralized, permanent, queryable; drives the dashboard |
| Taquito findings | **KaizenIs DB** | Always paired with the run |

**Mental model:** GitHub = source of truth for code & visual baselines. KaizenIs
= source of truth for the QC dashboard, history, design audits. They link via
URLs.

## 4. The KaizenIs QC menu (UX)

New top-level nav entry: **QC**. Three pages, in order of click:

### 4.1 Projects list (`/qc`)
A table of registered projects.

| Project | Repo | Last run | Result | New findings | Last audited |
|---|---|---|---|---|---|
| Spark | SparkSN | 2m ago | 47/47 pass · 2 visual diffs | 3 amber · 0 red | 2h ago |
| dashboard47 | dashboard47 | 1d ago | 38/40 pass · 0 diffs | 1 amber | 1d ago |
| ... | | | | | |

Top-right: **Register project** button → modal with `name · repo · baseUrl ·
storageState` (the auth blob from §6) and saves a `QCProject` row.

### 4.2 Project runs (`/qc/<project>`)
List of runs (newest first):

| Run | Branch / Commit | Trigger | Tests | Diffs | Findings | Status |
|---|---|---|---|---|---|---|
| #142 | main @ 8f3c9a | PR merge | 47/47 ✅ | 2 | 3 amber | green |
| #141 | feature/x @ a91e0c | PR open | 45/47 ❌ | 5 | 8 amber · 2 red | red |
| ... | | | | | | |

Top-right:
- **Run now** button (manual trigger)
- **Pick 2 → Compare** (selects two runs, opens the before/after view)

### 4.3 Run detail (popout / route `/qc/<project>/runs/<runId>`)
Tabs:
- **Summary** — top counts, failure list with screenshots + error
- **Screens** — grid of every screenshot captured this run, click → fullsize
- **Findings** — Taquito's chips per screen (with evidence quotes)
- **Visual diffs** — for each pixel-changed screen, baseline / current / diff
- **Trace** — embedded Playwright Trace Viewer (iframe) for failed tests
- **Links** — GitHub PR · GH Actions run · raw artifacts

### 4.4 Before/after view (`/qc/<project>/compare/<a>/<b>`)
For each screen, an **overlay slider** (drag to reveal old vs new). Below each
slider: side-by-side finding diffs ("new amber: Off-Topic question copy",
"resolved red: Color contrast on Decline button"). This is the *demo moment* for
designers — the thing that makes the product feel valuable.

## 5. Database schema (additions to KaizenIs Supabase)

```sql
-- The repos KaizenIs QCs
create table "QCProject" (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,                   -- "Spark"
  slug        text not null unique,             -- "spark"
  repoUrl     text not null,                   -- "https://github.com/SamerTime/SparkSN"
  baseUrl     text not null,                   -- "https://spark.tcwglobal.com"
  -- Encrypted via Supabase Vault. JSON of cookies/localStorage for a logged-in
  -- read-only audit user. Playwright loads as storageState.
  storageStateRef  text,                       -- vault secret id
  createdAt   timestamptz not null default now(),
  updatedAt   timestamptz not null default now()
);

create table "QCRun" (
  id          text primary key default gen_random_uuid()::text,
  projectId   text not null references "QCProject"(id) on delete cascade,
  trigger     text not null,                   -- "pr" | "manual" | "scheduled" | "post-deploy"
  branch      text,
  commitSha   text,
  prNumber    int,
  ghActionsRunUrl text,
  ghActionsArtifactUrl text,                   -- where trace.zip etc. live
  startedAt   timestamptz not null,
  finishedAt  timestamptz,
  status      text not null,                   -- "running" | "passed" | "failed" | "errored"
  testsPassed int default 0,
  testsFailed int default 0,
  visualDiffs int default 0,
  taquitoFindings int default 0,
  summary     jsonb not null default '{}',     -- the full qc-summary.json
  createdAt   timestamptz not null default now()
);

create table "QCFinding" (
  id          text primary key default gen_random_uuid()::text,
  runId       text not null references "QCRun"(id) on delete cascade,
  screen      text not null,                   -- "candidate-apply" | "recruiter-card" etc.
  -- The four categories taquito audits over (mirrors AI Screening Results brief)
  category    text not null,                   -- "look" | "feel" | "language" | "accessibility" | "understandability" | "brand"
  label       text not null,                   -- "Surface Level" | "Contrast: AA fail" etc.
  tone        text not null,                   -- "green" | "blue" | "amber" | "red"
  evidence    text not null,                   -- specific quote or DOM excerpt
  screenshotUrl text,                          -- key screenshot ref
  createdAt   timestamptz not null default now()
);

create index on "QCRun"(projectId, createdAt desc);
create index on "QCFinding"(runId);
```

Storage bucket: `kaizenis-qc-artifacts` (private) — holds the key screenshots
and `qc-summary.json` blobs. Trace zips stay on GitHub.

## 6. Authentication: the "audit session token" pattern

The naïve idea ("store username + password, script the login flow") is fragile
and creates a real-credentials-in-DB risk. The clean pattern:

1. In each app, create a **read-only audit user** (e.g. `audit-bot@kaizenis.com`).
2. Log in once as that user. Save the browser's session via Playwright's
   `context.storageState()` → produces a JSON blob (cookies + localStorage).
3. Paste that JSON into KaizenIs (`QCProject.storageStateRef`). It's stored
   encrypted in **Supabase Vault**.
4. At test time, KaizenIs returns the blob to the CI job; Playwright loads it
   as `storageState` and starts already-logged-in.

**Why it's better than scripting login:**
- The login form can break/change without breaking tests
- No raw credentials in DB
- The blob is scoped (one bot user; revoke its session = invalidate everywhere)
- Works for any auth scheme (cookies, JWT, magic link — all serialize the same)

**Per-environment:** `QCProject` can have multiple `baseUrl + storageStateRef`
pairs (prod, staging, local) — drop-down at run time.

## 7. The shared Playwright toolkit (`@kaizenis/playwright-toolkit`)

Published npm package owned by KaizenIs. Every project's `playwright.config.ts`
becomes:

```ts
import { kaizenisConfig } from "@kaizenis/playwright-toolkit";
export default kaizenisConfig({ project: "spark" });
```

The toolkit provides:

- **Config factory** — wires in viewports, project paths, reporter, screenshot
  on every action, trace on retry, etc.
- **Standard fixtures** —
  - `authedPage` (pre-logged-in via storageState)
  - `mobilePage` (iPhone 14 emulation)
  - `apiClient` (request fixture with auth header)
- **Reusable assertions** —
  - `expectColorContrast(locator, "AA")` — calls `axe-core` under the hood
  - `expectAccessibleButton(locator)` — checks role, label, focus ring
  - `expectFunnelBar(page, {applied, invited, complete})` — composable
- **Standard reporter** — emits `qc-summary.json` in the shape §8 requires +
  uploads it to KaizenIs at the end of the run (via a CI-injected token).

This is the lever for cross-repo consistency. New repo gets the same defaults
without reinventing them.

## 8. The `qc-summary.json` contract (CI → KaizenIs)

What every CI run uploads to KaizenIs at the end. This is the wire format.

```ts
type QCSummary = {
  schemaVersion: 1;
  projectSlug: string;             // "spark"
  trigger: "pr" | "manual" | "scheduled" | "post-deploy";
  commitSha: string;
  branch: string;
  prNumber?: number;
  ghActionsRunUrl: string;
  ghActionsArtifactUrl: string;
  startedAt: string;               // ISO
  finishedAt: string;              // ISO

  tests: Array<{
    name: string;                  // "candidate-apply-completed"
    file: string;
    status: "passed" | "failed" | "flaky" | "skipped";
    durationMs: number;
    error?: { message: string; stack: string };
    screenshots: Array<{ name: string; url: string }>; // KaizenIs URLs
    traceUrl?: string;             // GH Actions artifact URL
  }>;

  visualRegressions: Array<{
    test: string;
    diffPixels: number;
    diffPercentage: number;
    baselineUrl: string;
    currentUrl: string;
    diffUrl: string;
  }>;

  // Filled by Taquito after a separate step (or empty here if Taquito runs async)
  taquitoFindings: Array<{
    screen: string;
    category: "look" | "feel" | "language" | "accessibility" | "understandability" | "brand";
    label: string;
    tone: "green" | "blue" | "amber" | "red";
    evidence: string;
    screenshotUrl?: string;
  }>;
};
```

KaizenIs has one ingest endpoint: `POST /api/qc/runs` (auth: project upload
token issued at project registration). Body: `QCSummary`. KaizenIs persists,
indexes, displays.

## 9. Taquito audit contract (KaizenIs MCP tool)

A new MCP tool on Taquito:

```text
POST {KAIZENIS_API_BASE_URL}/api/v1/pipelines/audit_screens/invoke
Authorization: Bearer {TAQUITO_MCP_API_KEY}
```

Input:

```ts
type AuditInput = {
  projectSlug: string;
  runId: string;
  screens: Array<{
    name: string;                  // "candidate-apply"
    screenshotUrl: string;         // public via signed URL
    domSnapshotUrl?: string;       // HTML at moment of capture (optional)
    a11yTreeUrl?: string;          // Playwright a11y snapshot (optional)
    computedColors?: Record<string,string>; // text/bg color pairs the renderer used
    copy: string[];                // every text node on the screen
  }>;
  brand: {                         // per-project, optional
    palette?: Record<string,string>;
    voice?: string;                // "warm, plain English, no jargon"
  };
};

type AuditOutput = {
  findings: Array<QCFinding>;      // same shape as the DB row (§5)
  summary: string;                 // 1-2 line overall verdict
};
```

**Categories Taquito audits** (mirrors the AI Screening Results pattern of
chips with evidence, grouped by category):

| Category | Sample labels (chip text) |
|---|---|
| Look | `Color contrast — AA fail` · `Crowded spacing` · `Misaligned header` · `Brand palette adherence` |
| Feel | `Empty state missing` · `Loading state missing` · `Affordance unclear` · `Layout shift on action` |
| Language | `Jargon: "MCP"` · `Inconsistent capitalization` · `Error message blames user` · `Sentence length` |
| Accessibility | `Missing alt text` · `Focus ring removed` · `Heading skip h1→h3` · `Color-only state indicator` |
| Understandability | `Next action unclear` · `Implicit prerequisite` · `Conflicting cues` |
| Brand voice | `Off-tone for StaffingNation` · `Coral overused` · `Voice drift from sibling pages` |

Tone scale and "evidence is a citation, not an opinion" — both inherited from
the AI Screening Results brief. **Never hand-wavy.**

## 10. Test conventions (what tests live in each project)

Each project's `tests/qc/` directory contains four test layers:

### 10.1 Smoke (always green, fast)
Hit every meaningful route, assert it loads. Catches deploy-time breakage.

```ts
test("/jobs loads", async ({ page }) => {
  await page.goto("/jobs");
  await expect(page).toHaveTitle(/StaffingNation/);
});
```

### 10.2 Functional (the bugs we lived through today)
For Spark, the priority flows:
- Candidate apply → auto-accept → interview → completion screen (no `<!DOCTYPE` error)
- Recruiter logs in → opens completed candidate → answers visible → Roger auto-runs
- Recruiter Re-run → transcripts populate → chips render
- Admin → toggle auto-accept → save → effect on next apply
- 5-minute answer cap → recorder auto-stops + advances
- Drop-internet mid-interview → confirmed-uploaded answers survive

Each test screenshots at every meaningful step (`await page.screenshot({path})`).

### 10.3 Visual regression
`await expect(page).toHaveScreenshot("candidate-apply.png")` at key screens.
First run records the baseline. Future runs diff. Baselines committed to repo,
diff-reviewed in PRs.

### 10.4 Accessibility
Per-screen `axe-core` scan (via `@kaizenis/playwright-toolkit`'s wrapper). Hard
failures = serious violations (color contrast, missing labels). Soft failures
become Taquito amber chips.

## 11. CI integration (per-repo GitHub Actions workflow)

Every repo gets a `.github/workflows/qc.yml`. The toolkit ships a template.

Triggers:
- **On pull_request** that touches UI files (`src/**.tsx`, `tests/qc/**`)
- **On push to main** (post-deploy smoke)
- **Schedule** — nightly cron for drift detection
- **Manual** — via the **Run now** button in KaizenIs (KaizenIs dispatches a
  `workflow_dispatch` event via the GitHub API)

Each job:
1. Pulls `storageState` from KaizenIs (via a project-scoped CI secret)
2. Runs `pnpm playwright test`
3. Uploads `playwright-report/` + `test-results/` (incl. `trace.zip`) as GH
   Actions artifacts (90-day retention)
4. POSTs `qc-summary.json` + key screenshots to KaizenIs ingest endpoint
5. (Optional) calls Taquito `audit_screens` with the screens captured this run;
   appends `taquitoFindings` to the summary

KaizenIs's "Run now" button is just a wrapper around the GitHub
`workflow_dispatch` API. No second runner infrastructure needed.

## 12. Before/after (the "wow")

Every run is a versioned snapshot. The compare view:

1. **Screen alignment** — match screens by `name` (we stamp the name at capture
   time, e.g. `await page.screenshot({path: "candidate-apply-step3.png"})`).
2. **Overlay slider per screen** — one image with a horizontal slider you drag
   to reveal old vs new. (Standard React component, ~50 lines.)
3. **Finding diff under each slider** — three lists:
   - **New issues** (red/amber chips present in new, not in old)
   - **Resolved issues** (chips in old, not in new)
   - **Persistent issues** (unchanged) — collapsed by default
4. **Run header** — both runs' branch, commit, time, who triggered.

This view is what designers/PMs share to celebrate (or to file a fix).

## 13. Build phases

| Phase | What | Effort | Outcome |
|---|---|---|---|
| **0. This brief** | Lock the contract; decide schema, package names, URL shapes | ½ day | Aligned across me + Codex + Taquito |
| **1. Spark QC v0** | `tests/qc/` in SparkSN: 3 functional + 3 smoke tests · `playwright.config.ts` · GH Actions workflow uploading artifacts to GH | 3 days | Spark stops shipping the bugs we hit today |
| **2. KaizenIs QC dashboard v0** | `QCProject` + `QCRun` + `QCFinding` schema · ingest endpoint · projects list + run list + run detail (no Taquito findings yet) | 1 week | Centralized history; the "QC" menu is real |
| **3. Toolkit package** | `@kaizenis/playwright-toolkit` published · Spark migrated to use it | 3 days | Pattern is reusable; second repo onboard cheap |
| **4. Visual regression + before/after slider** | `toHaveScreenshot()` baselines · compare view in dashboard | 1 week | The "wow" moment |
| **5. Taquito audit tool** | `audit_screens` MCP tool · KaizenIs runs it after every QC run · findings stored | 1 week | Design/language/a11y audits visible |
| **6. Multi-repo rollout** | dashboard47, tcw-lms, contingent-agent, payrolling | ~1 day per repo | Coverage |
| **7. Polish** | Slack/email reports on regressions · public-share links · PDF export · trend dashboard | 1 week | Production-grade |

**Phase 1 alone** kills today's recurring pain. Everything after is leverage.

## 14. Open decisions (to pin before Phase 1)

| Decision | Options | Default I'd choose |
|---|---|---|
| Toolkit repo location | New `SamerTime/kaizenis-playwright-toolkit` repo · sub-package in dashboard47 · sub-package in a monorepo | **New repo** — npm publish is cleaner, doesn't bloat dashboard47 |
| Taquito sequencing | Build the dashboard first (Phase 2), Taquito later (Phase 5) · interleave | **Dashboard first** — visible value, Taquito layers on cleanly |
| Storage state generation | Hand-saved JSON · scripted helper command · UI flow in KaizenIs | **Helper command** in toolkit: `npx kaizenis-qc capture-auth` opens a browser, you log in, it writes JSON, you paste into KaizenIs |
| Per-PR run gating | Block merge on failure · advisory only · block on red findings only | **Advisory at first** · escalate to gating once stable (avoid early flakes blocking real work) |

## 15. Versioning + ownership

- **This brief is the source of truth** for the QC product. Schema, contracts,
  and category labels are defined here. Change them here first, then update
  code on all three sides (Spark tests, KaizenIs dashboard, Taquito MCP).
- **§9 chip labels** are the canonical taxonomy (same pattern as the AI
  Screening Results §4 Chip Registry). Edit here when adding/removing.
- **§8 `qc-summary.json` schema** is versioned via `schemaVersion`. Bumps are
  breaking; KaizenIs ingest should accept multiple versions during transitions.

## 16. Out of scope (for v1)

- Visual diffs across *browsers* (Chromium vs Firefox vs WebKit) — Phase 2+
- AI-driven (autonomous) browser navigation (e.g. Anthropic Computer Use) — we
  start script-based; AI-driven is a separate exploration
- Load testing / performance budgets — separate brief if needed
- Mobile native apps — Playwright is web-only; mobile is a different stack
- Test generation from designs (Figma → tests) — out of scope, fun future
