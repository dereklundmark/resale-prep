# Resale Prep (working name)

Personal, single-user web app for prepping items for resale on **Tradera**, **Blocket** and
**Facebook Marketplace**, and tracking what's for sale, what sold, and revenue per group.
Mobile-first (iPhone). UI in English, listing text in Swedish.

The design handoff is in [`docs/design/`](docs/design/). Its `README.md` is the spec; open
`ResaleFinal.dc.html` in a browser to click through the prototype.

## Run it

One-time setup:

```bash
npm install
npm --prefix api install
```

Then copy `api/local.settings.example.json` to `api/local.settings.json` and paste your
Gemini key (from aistudio.google.com) into `GEMINI_API_KEY`. Git ignores that file, so the
key is never committed. Never put the key anywhere else in the code.

```bash
npm run dev
```

Open **http://localhost:4280**. That's the Static Web Apps emulator: it serves the app (Vite
on :5175) and the API (Azure Functions on :7071) from one address, the same way Azure will.
On your iPhone (same Wi-Fi) use `http://<your-pc-ip>:4280`. After changing anything in
`api/` or `local.settings.json`, stop with Ctrl+C and run `npm run dev` again.

`npm run dev:mock` runs the frontend alone with a placeholder Generate (no API, no key).

Other scripts: `npm test`, `npm run lint`, `npm run build`, `npm run icons` (regenerates
`public/icons/` from `scripts/icon.svg`).

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

## Where things are

| Path | What |
|---|---|
| `src/lib/types.ts` | Data model (mirrors the planned SQL tables) |
| `src/lib/stats.ts` | Everything derived: days listed, days to sell, group totals |
| `src/lib/generate.ts` | The AI suggestion contract, API call + mock |
| `api/src/functions/generate.ts` | The Gemini call (Azure Function) |
| `scripts/dev.mjs` | Starts Functions host + SWA emulator for `npm run dev` |
| `src/data/db.ts` | Storage (IndexedDB now, API later) |
| `src/data/backup.ts` | Export / import of all data as JSON |
| `src/screens/` | NEW, ACTIVE, SOLD, TOTAL |
| `src/components/DetailSheet.tsx` | Item detail overlay |

## Additions beyond the design

- "Redo" link next to "Edit item" on the result screen (the spec asks for regenerate).
  Confirmed (black) fields survive a redo.
- Editable sold date on the "Sold for" bar: tap "today" to pick a date.
- Detail sheet shows the saved categories and has a small "Delete item" link.
- TOTAL has Export / Import backup links and the build version at the bottom.
