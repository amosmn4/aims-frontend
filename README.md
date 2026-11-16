# Amsol Ops

A Vite, React and TanStack Router frontend connected to the existing NestJS backend through an isolated Ops domain.

## Run locally

Use Node.js 22.19 or newer and npm. Start the existing backend entry point:

```powershell
cd "C:\dev\SYSTEMS\AIMS\backend"
npm.cmd run start:dev
```

In another terminal, start the new frontend:

```powershell
cd "C:\dev\SYSTEMS\AIMS\frontend"
npm.cmd run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173; Vite selects the next port if
that one is occupied). The page renders independently; session restoration and other API
requests go to the existing backend on port 4000; set OPS_API_PROXY when the backend uses another
local port. The normal backend already includes Ops, Water, Blog, Ledger and the existing public
APIs.

For a missing local System Admin, run npm.cmd run ops:setup:local from backend once. It uses SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD and preserves an existing password. This development-only command is not a production setup step. For production initialization, run ops:bootstrap with an existing active AIMS System Administrator to create the separate Ops System Admin profile, or with an existing CEO to bootstrap a CEO profile. The System Admin can then invite or assign the CEO.

## Production hosting

Build and host the generated static files independently from the backend. The backend is API-only;
neither service assumes a particular frontend directory name or build location. Configure the
frontend host to serve `index.html` for client-side routes, and configure `VITE_API_URL` or the
frontend host's `/api` reverse proxy to point API requests at the backend. The frontend does not
contact the backend just to load its static files; API calls occur when users sign in or use the app.

Keep the existing backend process, API port, database, uploads, credentials, Blog/payment
integrations and public API contracts. Route API requests to that same backend. If the static
frontend uses a different origin, include that origin in the backend's `CORS_ORIGIN` configuration.
Keep the frontend and API on the same site (for example, sibling subdomains or a same-origin API
proxy) so the HTTP-only `SameSite=Strict` refresh cookie works. Preserve any existing CORS origins
needed by external sites. Use the existing `OPS_FRONTEND_URL` value for invitation and reporting
links, updating it only if the frontend origin itself changes.

Do not use the standalone `ops-main` entry point to replace the current backend: it only registers
Ops APIs. The tender page reads the existing production tender service. CEO assignment changes
update only the existing tender owner field through its existing authorization rules. See [the
production release guide](../deploy/ops/README.md) and [the backend permission contract](../backend/docs/ops.md).

## Connected workflows

- Clients, projects, multiple departments, project teams and tasks.
- Richly formatted project summaries and task details, CEO-only task comments, plus task document/image attachments shared with authorized project members.
- Project, department and ad-hoc reports with CEO feedback and retained review history.
- Operations-wide and Marketing-owned client requests; prospective client entries do not create Amsol client records. Production tenders are read live from the existing tender service.
- Businesses, dated finance entries with descriptions and staff business grants.
- CEO-only staff profiles and operational settings; a separate, auditable System Admin role for health checks and CEO account assignment.
- Original document uploads up to 25 MB, previews, downloads and permissions.
- Department registers, report templates, document defaults and in-app report reminders.
- Weekly staff plans and results, CEO reviews/corrections and separate scheduled consolidated emails.
- Dashboards, searches, analytics and PDFs using current authorized server records.

Reviewed reports are locked. Submit a new update to amend a reviewed report. Removing a team member requires reassigning their tasks first.

Department registers track owners, dates, status, notes and optional amounts. Payroll registers do not execute payments, and database health registers do not perform monitoring. General report reminders appear in the app. Weekly plans and reports have their own CEO-controlled email schedules.

## Persistence and sessions

Normal startup uses /api/v1/ops. Records are stored in MySQL; original uploads use the backend storage provider. Access tokens remain in memory and refresh sessions use an HTTP-only cookie. Personal and department views keep the same staff identity.

The server filters records and business figures and authorizes every change and download. Stale saves return a conflict; the form retains its values for review and retry. A failed API request never loads browser sample data.

Invitations expire after seven days and can be used once. SMTP sends the link when configured; administrators can also copy it. Passwords belong to the shared AIMS identity. Ops roles and activation are separate from legacy roles and activation.

For production, host the frontend static build independently and configure client-route fallback
on that host. The NestJS service exposes APIs only. Route `/api/` through a reverse proxy or set an
absolute `VITE_API_URL` to the backend; an absolute URL requires the backend CORS settings to allow
the frontend origin. `OPS_FRONTEND_URL` controls Ops invitation and weekly-report links.

## Optional browser demo

```powershell
npm.cmd run dev:demo
```

Demo mode explicitly uses browser storage and sample records. Its accounts include ceo@amsol.local, finance@amsol.local and brian@amsol.local, all with AmsolDemo2026!. Demo data and passwords are never imported into the backend.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
```

The existing demo browser tests use Edge on port 5175. Connected browser tests require a separate local database with migrations applied:

```powershell
$env:OPS_TEST_DATABASE_URL="mysql://root@127.0.0.1:3308/amsol_ops_verify"
npm.cmd run test:e2e:api
```

Connected tests start an isolated API on port 4001, a mock payment gateway on port 4003, a local SMTP fixture on port 2526 and frontend on port 5176. They disable real email, S3 and external gateway access and create test identities only in a local database whose name ends in _verify. The SMTP fixture control service on port 2527 belongs only to this test harness. Run database API tests and connected browser tests sequentially when sharing that database.

## Weekly staff reporting

Open /weekly-reports to prepare a plan or report for a selected Monday-to-Sunday week. Staff can add routine work or import their own project tasks, attach up to 10 private files or images (25 MB each), save drafts, and submit a dated snapshot. Draft content and attachments stay private to the author and CEO. Reports start with the planned tasks and require an outcome for each one: Completed, In progress, Pending, Blocked or Cancelled. Reporting does not silently change project task statuses.

The CEO sees submissions and missing reports, reviews them, or returns them for correction with a reason. Submitted records are locked until returned. Submission and correction history retains the earlier snapshots. Dashboard reminders and links lead to the current reporting cycle.

At /weekly-settings, the CEO sets plan and report deadlines and email schedules independently. The reports deadline can fall in the following week. Emails are delivered at the first chosen day/time at or after the corresponding deadline, in Africa/Nairobi. No Tuesday/Friday email time is fixed in code. Each active CEO receives one consolidated plans email and a separate consolidated reports email, each with staff names, brief summaries, task counts and missing-submission status. Names open the individual submission in /weekly-brief and return there after sign-in.

Set SMTP and OPS_FRONTEND_URL in the backend. Automatic delivery also requires OPS_EMAIL_JOBS_ENABLED=true; it defaults to false locally. The CEO can preview emails, explicitly send a brief to their own inbox, and inspect delivery history. Sent briefs are not sent again. An interrupted or unconfirmed send needs an explicit retry after checking the inbox.

Apply the outstanding Ops migrations, including `20261115110000_ops_task_descriptions`, and regenerate Prisma before starting the updated API. They add weekly records/settings/deliveries, an Ops profile creation timestamp and task details; existing Water, Blog and Ledger tables remain unchanged.

## Deployment

See [the deployment guide](../deploy/ops/README.md) for production configuration, migrations, shared uploads, health checks and the backend ops:check readiness command. Set the schedules as the CEO before enabling production delivery. Application builds and tests run natively.

## Water Project, Blog and Payment Ledger

Water Project is available at /water, with its existing zones, meters, customers, balances, readings, payment uploads, import review, expenses, reports and AI screens. Blog is available at /marketing/blog with the production list, rich text editor, formatting toolbar, media uploads, preview and publishing dialogs.

In Settings, open Module access and assign each account No access, View or Manage for Water Project, Blog and Payment Ledger independently. Accounts start with No access, including CEO accounts. Assign your own account when you need to use a module. Viewers can read, preview and export; managers can also change records and publish. These modules require connected mode and are hidden in the browser demo.

The new routes use /api/v1/ops/water and /api/v1/ops/blog. They reuse the existing backend services, database rows, identifiers, authorship and upload keys. Blog styling is scoped to preserve its production interface within Ops navigation. Water AI can query only Water records and Water expenses. The dedicated Ops server runs the existing import and cleanup workers.

Run backend migrations before starting the updated frontend. Both API entry points must use the same database and upload directory or S3 bucket. Keep the existing public Blog API running for the website, including /api/v1/public/blog/feed, engagement, images and videos. Retiring the old frontend does not retire that API. No public API keys belong in frontend environment files.

Payment Ledger is available at /payment-ledger with the existing transaction filters, Nairobi dates, currency and direction totals, full transaction snapshots and CSV export. Manage access also enables allocation to meters or registered systems, delivery retry with a reason, synchronization and payment system registration, editing and credential rotation. Credentials appear once and disappear when dismissed or when the page is left. Grant administration links to Settings rather than the legacy access screen.

Ledger requests use /api/v1/ops/payment-ledger and reuse the existing payment_ledger_entries and payment_ledger_sync tables. The gateway connection remains server-side using PAYMENT_GATEWAY_URL and PAYMENT_GATEWAY_BRIDGE_KEY. Stored transactions remain readable when the gateway is unavailable; gateway actions require a configured, reachable connection. Ops and legacy modules share a sync provider within one backend process, and database leases coordinate separate processes. Existing gateway callbacks and production records have not been reseeded or converted.
