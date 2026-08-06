# Deploying the web app to GitHub Pages (free, static)

The web app can run with **no server**. A prebuilt `data.json` snapshot holds everything, so GitHub
Pages just serves static files.

## Build
```bash
npm run web:static      # = npm run snapshot  (pulls Sleeper + computes) then vite build
```
Output is in **`web/dist/`** — `index.html`, `assets/`, and `data.json`. The build uses relative asset
paths (`base: "./"`), so it works at a root page (`user.github.io`) or a project subpath
(`user.github.io/repo/`) with no config change. The app is a single page (tab state, no client-side
routing), so no 404 fallback is needed.

## Publish (pick one)

**A. `docs/` folder on your Pages repo (simplest)**
1. Copy the contents of `web/dist/` into a `docs/` folder in your GitHub Pages repo.
2. Commit & push.
3. Repo → Settings → Pages → Source: **Deploy from a branch**, Branch: `main`, Folder: `/docs`.
4. Visit the URL Pages shows.

**B. `gh-pages` branch**
1. Push the contents of `web/dist/` to a `gh-pages` branch of the repo.
2. Settings → Pages → Source: `gh-pages` / root.

## Updating the data (after trades / roster changes)
The site shows a **snapshot**, not live data. To refresh:
```bash
npm run web:static      # regenerate data.json + rebuild
```
…then re-copy `web/dist/` (or just the new `data.json`) to your Pages repo and push.

## Auto-refresh nightly (still $0) — GitHub Action

`.github/workflows/refresh.yml` does this: on a nightly cron (and a manual button) it checks out the
repo, runs `npm run web:static`, syncs `web/dist` → `docs/`, and commits if `data.json` changed. The
commit to `docs/` makes Pages redeploy automatically.

**Prerequisite:** the Action builds on GitHub's servers, so the **whole project must be in the repo**
(not just the built `docs/`), and Pages must serve from that repo's `/docs`. Committed files it needs:
`package-lock.json` (for `npm ci`) and `config/salaries.csv` (for exact salaries — it is *not*
gitignored). `web/dist/` and `web/public/data.json` are gitignored (generated); `docs/` is committed.

**Enable it:**
1. Push the project to the repo (with `.github/workflows/refresh.yml` and a committed `docs/`).
2. Repo → Settings → Actions → General → **Workflow permissions** = **Read and write**.
3. Repo → **Actions** tab → "Refresh data + deploy" → **Run workflow** to test it now.
4. It then runs nightly at 11:00 UTC — change the `cron:` in the workflow to adjust.

Notes: GitHub pauses scheduled workflows after ~60 days of no repo activity (a manual run re-arms it).
The runner has internet, so the snapshot fetches Sleeper live each night.

## Local preview of the static build (no server)
```bash
npm run web:static
npx --yes vite preview --outDir web/dist   # or any static file server
```
