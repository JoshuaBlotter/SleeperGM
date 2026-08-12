# Deploying the web app to GitHub Pages (free, static)

The web app runs with **no server**. A prebuilt `data.json` snapshot holds everything, so Pages just
serves static files. Live site: <https://joshuablotter.github.io/SleeperGM/>

## How it deploys: automatically, on every push to `main`

`.github/workflows/refresh.yml` is the whole deploy. In **one job** it checks out the repo, runs
`npm ci`, refreshes ADP values, runs `npm run web:static`, and uploads `web/dist` straight to Pages
via `actions/upload-pages-artifact` + `actions/deploy-pages`.

Nothing built is committed — there is no `docs/` folder, no `gh-pages` branch, and no second trigger
to wait for. **Pushing to `main` is the deploy.** It takes about a minute.

It also runs:
- **nightly** at 11:00 UTC (`schedule`), so the snapshot picks up trades and roster moves on its own;
- **on demand** — repo → **Actions** → "Refresh data + deploy" → **Run workflow**.

### Requirements (already configured)
- Settings → **Pages** → Build and deployment → Source = **GitHub Actions**.
- The whole project must be in the repo, since the build happens on GitHub's runner. Files it needs
  that are easy to gitignore by accident: `package-lock.json` (for `npm ci`), `config/salaries.csv`
  (exact salaries), and `config/values/*.csv` (value sources — imported ones bake in automatically).
- `web/dist/` and `web/public/data.json` stay gitignored; they are generated on every run.

Note: GitHub pauses scheduled workflows after ~60 days of no repo activity. A manual run re-arms it.

## Building locally

```bash
npm run web:static
```

That is `npm run snapshot` (pulls Sleeper + computes values → `web/public/data.json`) followed by
`vite build`. Output lands in **`web/dist/`** — `index.html`, `assets/`, and `data.json`. The build
uses relative asset paths (`base: "./"`), so it works at a root page or a project subpath with no
config change. The app is a single page (tab state, no client-side routing), so no 404 fallback is
needed.

Preview the static build with no server:

```bash
npm run web:preview
```

## Refreshing the data by hand

The site shows a **snapshot**, not live data. The nightly run and every push already refresh it; to
force one now, use the **Run workflow** button in the Actions tab rather than building and copying
files anywhere.
