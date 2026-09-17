# AIMS Frontend

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
