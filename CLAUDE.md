# CLAUDE.md

Orientation for Claude Code sessions working in this repo. For human-facing setup, data schema, scraper CLI, and deployment, read [`README.md`](./README.md) — don't duplicate it here.

## What this is

**SoCal Fishing Dashboard** — a static site (vanilla HTML/CSS/JS) that renders fish-count data scraped from sandiegofishreports.com. A Python scraper runs every 12h via GitHub Actions and commits updated JSON back to `data/fishing_reports.json`. No backend, no build step, no framework, no tests.

## Commands

```bash
# Serve the dashboard (must be from repo root — paths are relative)
python -m http.server 8000           # → http://localhost:8000

# Run scraper (writes to data/fishing_reports.json)
pip install -r requirements.txt      # once
python automated_scraping/scripts/sandiego_fish_reports_scraper.py           # last 7 days
python automated_scraping/scripts/sandiego_fish_reports_scraper.py --dry_run --verbose --date 2026-04-18
```

Scraper logs go to `scraper_v3.log` in the working directory. See `README.md` for full CLI flags.

## Repo map

| Path | Role |
|---|---|
| `index.html` | Single entry point. DOM mounts: `#reportsSection`, `#trendsSection`. Script load order (lines 46–51) is load-bearing — see below. |
| `static/js/dashboard.js` | **Daily Reports** view controller. Owns `_rt` state. |
| `static/js/trends.js` | **Trends** chart controller. Owns `_tr` state. Uses Chart.js. |
| `static/js/tripDuration.js` | Trip string parser + multi-day allocation. Reuse for any per-day math. |
| `static/js/moon.js` | Moon phase util (`moonPhase`, `daysToNearestNewOrFull`). |
| `static/js/ui.js` | Shared primitives (multi-select, segmented control) on `window.UI`. Reuse before building new widgets. |
| `static/css/style.css` | Design tokens in `:root` (colors, spacing, type scale, chart palette). Edit the token, not the rule. |
| `data/fishing_reports.json` | **Generated output.** Don't hand-edit — it's overwritten by the scraper. |
| `automated_scraping/scripts/sandiego_fish_reports_scraper.py` | `FishReportsScraper` class + CLI. Python 3.10, type-hinted. |
| `.github/workflows/scrape.yml` | Cron `0 */12 * * *`. Needs `contents: write` permission. |

## Frontend architecture

- **Script load order matters.** `index.html` loads `moon.js` → `ui.js` → `tripDuration.js` → `trends.js` → `dashboard.js`. Later files depend on globals defined earlier. Don't reorder without tracing dependencies.
- **No modules, no bundler.** Each JS file is a `<script>` tag; module scope is achieved with IIFEs / file-level closures.
- **State lives in one object per view.** `_rt` in `dashboard.js`, `_tr` in `trends.js`. No Redux, no observers — just module-scoped objects mutated by event handlers.
- **Public vs. private.** Underscore-prefixed helpers (`_rtChangeDate`, `_trRender`) are file-internal. Anything callable from another file or from HTML is attached to `window`.

## Scraper notes

- `scrape_date_range` is **idempotent**: when new records are saved, any existing records for the dates present in the new batch are dropped first. Re-running for the same date never produces duplicates.
- Dedup key: `(date, location, boat, species, count)`. The JSON file is capped at 100,000 records (oldest pruned).
- Validate parsing changes with `--dry_run --verbose` before touching the committed JSON.

## Gotchas

- **Multi-day trip allocation.** The source credits a trip's entire catch to its *return* date. `static/js/tripDuration.js` exposes two modes: **as-reported** (what the JSON stores) and **spread** (catch divided across the days the trip spanned). `trends.js` uses spread; `dashboard.js` surfaces a "Days" column and per-day rate. Any new per-day aggregation should reuse `tripDuration.js` — don't reimplement.
- **Moon phase is approximate.** Synodic cycle anchored to 2000-01-06, ±1 day accuracy. Fine for fishing. Don't swap in an astronomy dependency.
- **Relative paths.** The dashboard fetches `data/fishing_reports.json` relatively — it must be served from the repo root, not a subpath.
- **GitHub Actions needs write access.** For private repos, confirm *Settings → Actions → Workflow permissions → Read and write*.

## Conventions

- JS: underscore prefix for private module state and helpers; public API on `window`. kebab-case for CSS classes and DOM IDs.
- CSS: change tokens in `:root` rather than individual rules.
- Python: type hints, `logging` to both stdout and `scraper_v3.log`, constants UPPER_CASE at module top.

## Verifying a change (no test suite exists)

- **Scraper:** `python automated_scraping/scripts/sandiego_fish_reports_scraper.py --dry_run --verbose --date <recent-date>` and inspect stdout + `scraper_v3.log`. Check a few parsed records match the source page.
- **Frontend:** `python -m http.server 8000`, open the dashboard, exercise date nav, species filter, and the Trends section. Watch the browser console. If you can't actually open a browser in your environment, say so explicitly — don't claim the UI works.
- **Both:** `git diff data/fishing_reports.json` should be empty unless you intentionally ran the scraper without `--dry_run`.
