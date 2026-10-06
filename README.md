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

The app icon source is `scripts/icon.svg`; the PNGs in `public/icons/` were generated from
it with `@vite-pwa/assets-generator`.

## Decisions

- **Cost: must be 100% free.** Only use services with a permanent free tier.
- **Built in layers**, each usable on its own:
  1. **Frontend** ✅ All screens. Data in this browser (IndexedDB).
  2. **Gemini** ✅ `api/src/functions/generate.ts` (Azure Functions) calls Gemini (free tier)
     server-side with a JSON schema, so the key never reaches the browser. Model is set by
     `GEMINI_MODEL` in `local.settings.json`.
  3. **Azure** Azure Static Web Apps (Free plan) + Azure SQL Database free offer (set to
     **"Auto-pause the database until next month"**) + budget alert of 1 kr in Cost
     Management → Budgets. Replace `src/data/db.ts` with API calls. Move existing data with
     the Export/Import backup on the TOTAL screen.
  4. **Backfill** the 15 past sales.
- **Photos are stored in Azure SQL**, not Blob Storage. Blob Storage is only free for 12
  months. Photos are shrunk on the phone to ~150 KB, so the 32 GB free SQL tier is plenty.
  Blob Storage is learned **locally with Azurite** (Microsoft's free emulator), behind the
  same photo-storage interface.
- **Login: owner only.** Static Web Apps built-in auth, with every route requiring a custom
  `owner` role that only your own account is invited to.
- **Frontend:** React + Vite + TypeScript, installable as a home-screen app (PWA).
- **Source + CI/CD: all Microsoft.** Azure Repos + Azure Pipelines (free tier). A public
  GitHub copy is pushed by the pipeline for recruiters; GitHub is never the source of truth.

## Where things are

| Path | What |
|---|---|
| `src/lib/types.ts` | Data model (mirrors the planned SQL tables) |
| `src/lib/stats.ts` | Everything derived: days listed, days to sell, group totals |
| `src/lib/generate.ts` | The AI suggestion contract, API call + mock |
| `api/src/functions/generate.ts` | The Gemini call (Azure Function) |
| `src/data/db.ts` | Storage (IndexedDB now, API later) |
| `src/data/backup.ts` | Export / import of all data as JSON |
| `src/screens/` | NEW, ACTIVE, SOLD, TOTAL |
| `src/components/DetailSheet.tsx` | Item detail overlay |

## Additions beyond the design

- "Redo" link next to "Edit item" on the result screen (the spec asks for regenerate).
  Confirmed (black) fields survive a redo.
- Editable sold date on the "Sold for" bar: tap "today" to pick a date.
- Detail sheet shows the saved categories and has "Edit" and "Delete item" links. Edit
  changes title, price, group, condition, description and (for sold items) the sale date
  or month.
- TOTAL has Export / Import backup links and the build version at the bottom.
