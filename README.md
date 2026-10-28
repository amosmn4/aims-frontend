# AIMS Frontend

## Household readings and reconciliation

Under Water > Household balances, choose Record household reading and capture both Cumulative
usage (the lifetime units used) and Remaining prepaid units at the same date and time. A counter
change from 519 to 525 means 6 m³ consumed. The remaining balance stays separate from that counter.

Choose a reconciliation month to compare purchases, counter usage and prepaid balances. Opening
balance + purchases - remaining balance is usage from credit. For an opening balance of zero,
50 units purchased and 20 remaining means 30 used. Credit carried from earlier months is included.
The counter/credit difference compares only meters where both calculations are available.

Capture both values near the beginning and end of the month. Reports show reading coverage and
mark incomplete or interpolated intervals as provisional. Older balances remain editable without
inventing a lifetime reading; add a historical counter only if it was recorded. The overview,
monthly report, PDF/Word downloads and subscribed CEO email show the same reconciliation figures.

Deploy the backend cumulative-usage migration before publishing this frontend release.

## Water expenses

Open Water > Expenses and choose Add expense to record electricity/pumping, maintenance,
repairs, equipment, staff costs or other costs. Date, category, description and KES amount are
required. Supplier and reference are optional. Already paid records the payment date; switch
it off for an unpaid bill and use Mark paid when payment is made. Existing entries can be edited.

Monthly reports and PDF/Word downloads include recorded costs, category totals, payments,
currently unpaid bills and collections less paid expenses. Recorded costs follow the expense
date while cash paid follows the payment date. Older bills paid this month affect this month's
cash figure. The Water overview shows expenses for the whole project, without allocating them
to zones. Water records also appear in Finance's expense list without being entered twice.

Deploy the backend Water expense migration before publishing this frontend release.

## Work reporting workflow

Navigation stays navy across Home, project pages, reports and specialist views, including mobile.
Department navigation focuses on Home, Projects and Reports; specialist features are under Tools.
Home puts New project, Log work update and Open team report first, with shared company projects
alongside department work. Personal reports remain available under Tools without automatic prompts.
Department specialist datasets load when their tools are expanded.

The project workspace starts with Work, Updates and Reports. Files and deliverables are under More;
project details, milestones and client/service tools can be expanded. Short report summaries stay
visible while optional work, blockers and next steps are grouped together. Existing report content
is preserved when these sections are collapsed.

The CEO dashboard shows project status, open work by team and department reporting charts,
plus figures for completed projects, overdue tasks and reports awaiting review. Financial and
project analytics remain available. Water and blog module workflows are preserved.

## Shared company projects and minimal interface

The common layout uses fewer navigation groups, compact shortcuts and optional guidance.
This applies across department, Tender, Finance, administration and CEO screens. Water and blog
retain their existing module layouts and workflows.

Any staff member can choose Company projects, create a project and add colleagues from any
department. Every teammate has equal access to edit the project, manage the team, record work,
manage tasks and share files. There are no lead or viewer choices for company teams.

Short actions use dialogs, including project setup, team management, task creation and file
attachment. Open team report opens the shared draft for the selected period. Any teammate can
edit it and send it to the CEO. If someone else saves first, the editor keeps your writing and
asks you to load the latest report before saving again. CEO feedback reaches the whole team.
Files on company projects, tasks and reports are visible to the team and CEO automatically.
Company work remains in the team report rather than being repeated in personal reports.

## Tender work and CEO views

Tender home puts closing bids, checklist gaps and awards awaiting handover first.
Register a bid with its title and delivering department; client and deadline are visible,
with optional details behind More bid details. The bid opens on its checklist after saving.
Use Activity to record work and forward awarded bids through the existing delivery flow.

The CEO dashboard starts with decisions, delivery risks, department reporting coverage and
recent work updates. Financial and project analytics remain available from that overview.
The reports inbox supports search, department and period filters and paginated rows.
See [the implementation and security review](../backend/docs/tender-ceo-review.md) for access
rules, verification and rollout notes.

## Department daily workflow

IT, Marketing, Finance and Operations home pages put personal work, project creation, work updates
and Reports to the CEO first. Expand the department's figures and tools for its specialist views.
The introductory steps stay available until dismissed, even for accounts created more than two
weeks ago. Read-only visitors can open projects and reports; writing actions follow department
access and report submission still requires the existing capability.

Project setup starts with the name, optional client and service. More details contains work type,
dates, contracts and access restrictions. Dated updates use the same project activity service as
HR. Department-visible updates feed monthly work reports; restricted and company updates remain
in their project reports.

Finance's monthly work report uses the shared report editor. Its existing financial snapshot
reports remain under Financial snapshots with their original review workflow. Operations request
intake keeps the request, client and routing visible; contact, source, service, value and notes are
under More details. Existing blog functionality remains unchanged.

## HR daily workflow

HR provides services to clients. On HR home, create a project with its name, client and HR service.
Use More details when you need to change the suggested work type, set dates, link a contract,
describe the work or restrict project access. Existing client and contract tools remain available.

Use Log work update to record the work handled, its date, a blocker and a next step. Open the
project's Updates & discussion tab for the history. Company-wide work uses the same action inside
its company project.

Open Reports to the CEO to start or continue the department report. Refresh from work includes
later updates; review the figures and fill the required sections. Save and finish later keeps a
draft. Send to the CEO submits it for review. Personal reports are available under Tools.

TanStack Start (React) built with Vite and served by Nitro's `node-server` preset. `npm run build`
produces `.output/`:

- `.output/server/index.mjs` — the server that renders pages
- `.output/public/assets/*` — the hashed JS and CSS the browser loads
- `.output/public/*` — everything copied from `public/` (logo, icons, manifest, sw.js)

**All three parts must be deployed together.** The server's pages reference asset file names by
hash, so a server bundle without its matching `assets/` folder makes every page load fail.

## Deploying (after `git pull`)

Run these from the `frontend/` folder, in order:

```bash
# 1. Install dependencies (dev dependencies are needed to build — don't set NODE_ENV=production)
npm ci

# 2. Build, which also checks the output is complete
npm run build

# 3. Restart the app with PM2 (use the name from `pm2 list`)
pm2 restart aims-frontend
```

Deploy the backend first when a release changes both: `npx prisma migrate deploy` and
`npx prisma generate` there, or the app will error on new features.

If you build somewhere else and copy the result, copy the **whole** `.output` folder.

After deploying, purge the Cloudflare cache for this site (or at least `/assets/*`), then check an
asset really comes from the server rather than the cache:

```bash
curl -o /dev/null -s -w "%{http_code}\n" "https://management.amsol.africa/assets/<a-file-from-.output/public/assets>.js?cb=1"
```

`200` is correct. Anything else means the browser will show a blank or broken page.

## If pages load but the console shows 500s on `/assets/*.js`

The server is running, but its `assets/` folder is missing or unreadable. On the server:

```bash
ls .output/public/assets | wc -l          # expect a few hundred files
ls .output/public/assets/*.js | wc -l     # expect > 0
df -h                                      # a full disk breaks builds halfway
free -m                                    # the build needs roughly 2 GB
npm run verify:build                       # says what's missing
```

Then rebuild (step 2 above) and restart. If the build is killed for memory, either build on another
machine and copy `.output`, or give Node more room:

```bash
NODE_OPTIONS=--max-old-space-size=2048 npm run build
```

Note that a page can keep "working" for a while on Cloudflare's cache after the files have gone
from the server, so test with a cache-buster (`?cb=1`) when checking.

## Everyday commands

```bash
npm run dev            # local development
npm run lint           # eslint
npm run verify:build   # check .output is complete without rebuilding
```
