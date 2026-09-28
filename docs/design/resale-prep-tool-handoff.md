# Resale Prep Tool — Design Handoff

## Project Summary

A personal web app to speed up prepping items for resale across three Swedish marketplaces: **Tradera**, **Blocket**, and **Facebook Marketplace**. The owner uploads a photo and a short description of an item; the app suggests a cleaned-up listing title, a draft description, a category for each of the three platforms, and a rough price estimate — all editable before use. The app also tracks inventory: what's currently listed, what's sold, and running profit totals, including grouped batches of items (e.g. "Garage Cleanout," "Old Baby Room").

**User:** a single person (not multi-user), managing roughly 20 items now and occasional small batches in the future (e.g. 10 items every several months). Also backfilling 15 items already sold over the past 2 years.

**Tone/style:** clean, fast, utilitarian — this is a personal tool, not a consumer product. Should feel closer to a lightweight admin dashboard than a polished SaaS marketing site. Should work well on both desktop and mobile (photos are often taken and uploaded from a phone).

---

## Screens

### 1. New Listing (the "prep" screen)

**Purpose:** turn one item into ready-to-post listing content for all three platforms.

**Inputs:**
- Photo upload (single photo is enough; multiple optional)
- Item name / short description (free text), e.g. "Ikea Poäng Chair"
- Condition (dropdown): Ny, Nyskick, Mycket bra skick, Bra skick, Använt skick, Renoveringsobjekt
- Platform checkboxes: Tradera, Blocket, Facebook Marketplace — **all checked by default**, user can uncheck any
- Optional: group assignment (dropdown of existing groups + "create new group" + "none")
- "Generate" button

**Generated output (all fields editable, nothing auto-saved without user confirmation):**
- Suggested listing title
- Draft description (a few sentences, editable text area)
- Suggested category per checked platform (shown as editable dropdown/select per platform, with a manual override option since category matching isn't always perfect)
- Rough price estimate (a range, plus 1–2 sentences of reasoning — e.g. based on retail price and typical depreciation)
- User's own final asking price (a number input the user fills in themselves, separate from the estimate)
- "Save to Inventory" button — writes this item into the Active Inventory list as status "active"

**Notes for design:** This screen should clearly separate "AI-suggested" content from "what you'll actually post" — e.g. suggestions in a lighter/muted style, editable fields in a clearly editable style. Nothing here should feel like it's final until the user hits Save.

---

### 2. Active Inventory

**Purpose:** at-a-glance view of everything currently for sale.

**Table/list columns:**
- Item title
- Thumbnail photo
- Asking price
- Platform(s) listed on (small icons or badges)
- Group (if any)
- Days listed (calculated from date added)
- Action: "Mark as Sold" button (opens a small form: final sold price, date sold — defaults to today)

**Notes for design:** Should support sorting/filtering (e.g. by group, by platform, by days listed) even if simple. This is the "checklist" screen — the user should be able to see at a glance what's still active without needing a separate notes app.

---

### 3. Sold Archive

**Purpose:** historical record of everything sold, including manual backfill of past sales.

**Table/list columns:**
- Item title
- Group (if any)
- Sold price
- Date sold
- Days-to-sell (if the item has a "date listed," else blank for backfilled items)

**"Add Past Sale" form** (separate, simpler flow — no photo/AI step needed):
- Item title
- Group (dropdown + create new)
- Sold price
- Date sold (approximate is fine)
- Optional notes

**Notes for design:** This is where the user's 15 historically-sold items get entered once, up front. Should feel quick to bulk-fill — this isn't a one-at-a-time precious flow, it's clearing a backlog.

---

### 4. Dashboard / Summary

**Purpose:** the "how's it going" view — totals and breakdowns.

**Top-level stats (always visible):**
- Total items ever listed
- Number sold vs. still active
- Total revenue (sum of all sold prices)
- Sell-through rate (%) — sold ÷ total listed

**Per-group breakdown (cards or rows, one per group):**
- Group name (e.g. "Garage Cleanout," "Old Baby Room")
- Item count in that group
- Total profit/revenue for that group
- An "Ungrouped" bucket for anything not assigned to a group
- A grand total row/card summing across all groups + ungrouped

**Notes for design:** This is the screen the user will look at most for a sense of "how am I doing" — should feel satisfying/clear, not just a raw data table. Simple bar or summary visualization welcome if it doesn't overcomplicate the build.

---

## Data Model (for reference — informs what fields exist)

```
items
├── id
├── title
├── description
├── category_tradera
├── category_blocket
├── category_facebook
├── platforms_listed (which of the 3 it's posted to)
├── price_listed (asking price)
├── price_sold (null until sold)
├── status (active / sold)
├── date_listed
├── date_sold (null until sold)
├── group_id (nullable, foreign key to groups)
└── notes

groups
├── id
├── name        e.g. "Garage Cleanout", "Old Baby Room"
└── description
```

Totals (per-group and grand total) are calculated on the fly from this data — not stored as separate fields.

---

## Planned Tech Stack (for context — not needed for visual design, but useful background)

- **Frontend + backend functions:** Azure Static Web Apps (free tier)
- **Database:** Azure SQL Database (free tier)
- **AI (photo → title/description/category/price):** Google Gemini API (free tier)
- **Source control / deploy:** GitHub, pushed via GitHub Desktop

This is a learning project (the user is pursuing data analyst → data engineer skills), so the build will be done "properly" — real SQL schema, real Azure resources — even though the app itself is small in scope.

---

## What's Needed From This Design Pass

1. Visual layout and component design for all 4 screens above
2. A consistent, simple style system (colors, type, spacing) — nothing elaborate, should read as a clean personal tool
3. Mobile-friendly layout, especially for the New Listing screen (photo upload is often done from a phone)
4. Clear visual distinction between "AI-suggested" and "user-confirmed/editable" content on the New Listing screen
