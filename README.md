# Resale Prep (working name)

Personal, single-user web app for prepping items for resale on **Tradera**, **Blocket** and
**Facebook Marketplace**, and tracking what's for sale, what sold, and revenue per group.
Mobile-first (iPhone). UI in English, listing text in Swedish.

The design handoff is in [`docs/design/`](docs/design/). Its `README.md` is the spec; open
`ResaleFinal.dc.html` in a browser to click through the prototype.

## Run it

**Live only.** The code lives in **Azure Repos** (Azure DevOps). Pushing to `main` runs
[`azure-pipelines.yml`](azure-pipelines.yml): **Build** (install, lint, test, build app +
API) → **Deploy** to Azure Static Web Apps (environment `production`) → **Mirror** the
tested code to a public GitHub copy. Test on the live URL. Nothing is installed locally (no
`node_modules`), to save disk space.

To check a change before pushing, `npm install` then `npm run build` / `npm test` /
`npm run lint` work, and deleting `node_modules` afterwards frees the space again. Running
the app or API locally was removed; commit 3802edc has the setup if it's ever wanted again.

The Gemini key lives in Azure: Static Web App → Settings → Environment variables
(`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`). Never put it in the code.

The app icon (an ink price tag) is `scripts/icon.svg`. The PNGs in `public/icons/` are rendered
from it at each size with no extra padding, e.g.
`npx -p sharp-cli sharp -i scripts/icon.svg -o public/icons/pwa-512x512.png resize 512 512`.

## Versions

Semantic versioning (MAJOR.MINOR.PATCH), bumped in the same commit as each change; see
[CHANGELOG.md](CHANGELOG.md). The TOTAL footer shows the version, commit and build date.

## Decisions

- **Cost: must be 100% free.** Only use services with a permanent free tier.
- **Built in layers**, each usable on its own:
  1. **Frontend** ✅ All screens.
  2. **Gemini** ✅ `api/src/functions/generate.ts` (Azure Functions) calls Gemini (free tier)
     server-side with a JSON schema, so the key never reaches the browser. Models are set by
     `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` in the Static Web App's environment variables.
  3. **Azure** ✅ Azure Static Web Apps (Free plan) + Azure SQL Database free offer
     (**"Auto-pause the database until next month"**) + budget alert of 1 kr. The app talks to
     SQL only through the API in `api/` (see the table below); the database login is in the
     `SQL_*` environment variables.
  4. **Backfill** the 15 past sales.
- **Photos are stored in Azure SQL**, not Blob Storage. Blob Storage is only free for 12
  months. Photos are shrunk on the phone to ~150 KB, so the 32 GB free SQL tier is plenty.
  Blob Storage is learned **locally with Azurite** (Microsoft's free emulator), behind the
  same photo-storage interface.
- **Login: owner only.** Static Web Apps built-in auth, with every route requiring a custom
  `owner` role that only your own account is invited to.
- **Frontend:** React + Vite + TypeScript, installable as a home-screen app (PWA).
- **Built to scale by data, not code.** Platforms, markets (country + listing language +
  currency) and condition labels are rows in SQL (`dbo.platforms`, `dbo.markets`,
  `dbo.condition_labels`). Adding Vinted or eBay, or moving country, is an INSERT (see
  `sql/003_seed.sql`), not a code change. Each item keeps its own market, currency and
  language.
- **Source + CI/CD: all Microsoft.** Azure Repos + Azure Pipelines (free tier). A public
  GitHub copy is pushed by the pipeline for recruiters; GitHub is never the source of truth.

## Where things are

| Path | What |
|---|---|
| `sql/` | Database scripts: tables (001), app login (002), starting data (003), backfills (004), funds (005) |
| `api/src/functions/` | The API: `config`, `items` (+ groups, purchases), `photos`, `generate` |
| `api/src/lib/db.ts` | SQL connection; retries while the paused database wakes up |
| `src/lib/types.ts` | Data model (mirrors the SQL tables and the API's JSON) |
| `src/lib/stats.ts` | Everything derived: days listed, days to sell, group totals |
| `src/lib/generate.ts` | The AI suggestion call from the app |
| `src/data/api.ts` | Every request to the API; waits out a waking database |
| `src/data/StoreProvider.tsx` | App data: loads from the API, saves through it |
| `src/data/backup.ts` | Export / import of all data as JSON |
| `src/screens/` | NEW, ACTIVE, SOLD, TOTAL |
| `src/components/DetailSheet.tsx` | Item detail overlay (view, edit, delete) |
| `src/components/PurchaseSheet.tsx` | A fund purchase: view, edit, move, delete |
| `src/components/Pinned.tsx` | Puts a screen's main action band in the dock above the tab bar |

## Design version

Built from **design v2 + v3** (v3 adds group funds) ([`docs/design/ResaleFinal_v2.dc.html`](docs/design/ResaleFinal_v2.dc.html),
spec in [`docs/design/README.md`](docs/design/README.md)), with its explorations set to: light
pill tab bar at the bottom,
**pinned** action band (GENERATE / SAVE / SAVE + NEXT above the tabs), and **swipe left** to
mark sold on ACTIVE.

Where the app deliberately differs from the v2 spec:
- Generate errors show the real reason (busy, free-tier limit, which model failed) instead
  of the generic "Couldn't generate drafts" copy.
- Import asks for confirmation before replacing all data, and the backup file keeps the
  app's own format (items, groups, photos), which is what Import reads.
- Confirmed (black) fields survive a Redo; only grey AI drafts are replaced.
- The detail sheet also lists the saved category per platform, and the edit form's group
  picker can create a new group.
- Deleting a group with items or purchases asks where to move them (v3 moved items to
  Ungrouped and deleted purchases without asking), and TOTAL keeps hiding empty Sold /
  For sale sections.
- Backfilled sales are stored as the 1st of their month (`YYYY-MM-01`, with `isBackfill`)
  rather than as `YYYY-MM`; the UI shows them as months.
