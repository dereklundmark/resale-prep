# Handoff: Resale Prep Tool (mobile-first web app)

## Overview
This is a personal, single-user web app for prepping items for resale on three Swedish marketplaces: **Tradera**, **Blocket** and **Facebook Marketplace**.

The user adds a photo and a short description of an item. The app suggests a title, a description, a category per platform and a price range, all editable, and the user saves it to inventory. The app then tracks:
- active listings
- sold items, including backfilled past sales
- revenue per group (e.g. "Garage Cleanout", "Old Baby Room")

The app is used mostly on an **iPhone**. The UI is in English and the listing content is in Swedish.

The original product brief is included as `resale-prep-tool-handoff.md`. Where the brief and this README differ, this README reflects the final design decisions.

## About the Design Files
The files in this bundle are **design references created in HTML**. They are prototypes showing the intended look and behavior, not production code to copy.

Your task is to **recreate these designs in the target codebase**. The planned stack is:
- Azure Static Web Apps (frontend and API functions)
- Azure SQL
- Google Gemini for AI suggestions

If no frontend framework has been chosen, a lightweight React (Vite) or Svelte SPA is a good fit.

`ResaleFinal.dc.html` opens in a browser as long as `support.js` sits next to it. It is fully clickable and uses mock data and a fake 1.3 s "generate" delay. The logic class at the bottom of the file, `class Component`, is a readable spec of every state transition.

## Fidelity
**High-fidelity.** Colors, type, spacing and interactions are final. Recreate them closely. The only intentional placeholders are the striped photo boxes, which should be replaced by real uploaded images.

---

## Global Layout
- **Target viewport:** iPhone, 390 × 844 CSS px, fluid down to 360 and up to around 430.
  - On desktop, center the same layout in a column with `max-width: 560px`. No separate desktop design was made.
- **Structure,** top to bottom:
  1. iOS safe-area top padding (the mock shows a 50 px status bar).
  2. **Tab bar at the top:** a text-only row, `padding: 4px 20px 0`, `gap: 18px`.
     - Tabs: `NEW`, `ACTIVE`, `SOLD`, `TOTAL`.
     - Tab text: 13 px, weight 600, uppercase, letter-spacing .06em.
     - Active tab: color `#2a2723` with a 2 px bottom border in the same color.
     - Inactive tab: `#9a9489` with a transparent border.
     - Tab padding: 8 px 0.
  3. **Scrollable content area** (`flex: 1; overflow-y: auto`). It starts with a **hero line**, then the screen body. The bottom spacer is 40 px.
- There is **no bottom tab bar** and there are no icons. The whole UI is typographic.
- **Hero line:** `padding: 6px 20px 0`, flex row, `justify-content: space-between`, `align-items: center`.
  - Hero text: weight 500, letter-spacing -0.025em, line-height 1.05.
  - Hero size is 34 px on New, Active and Sold. It is 44 px on Total, where the hero is the revenue figure.
  - Hero copy per tab:
    - New → `New listing`
    - Active → `{n} for sale`
    - Sold → `{n} sold`
    - Total → `{revenue} kr`
  - On the Active tab only, the **Days / Photo segmented switch** sits right-aligned on this row.

## Screens

### 1. NEW (listing prep)
**Stage A: Input form**
- **Photo area:** `margin: 0 20px`, height 210 px, background `#ebe6dc` with 1 px horizontal lines every 9 px (`#e5dfd4`).
  - Caption bottom-left, in monospace 11 px `#6f6a62`.
  - `+1` bottom-right (add another photo), 12 px, weight 800, uppercase.
  - In the real app this is a file input (`accept="image/*"`, `capture` allowed). Show the first photo full-bleed and add a thumbnail strip if there are multiple photos.
- **Fields block:** `padding: 18px 20px 0`, column, `gap: 20px`.
  - **Item name input:** 24 px, weight 600, no box. It has a 1.5 px bottom border in `#2a2723` and 6 px bottom padding. Placeholder: "What is it?".
  - **Condition + Group row:** a 2-column grid, `gap: 16px`. Each column has:
    - a label: 11 px, weight 700, uppercase, letter-spacing .1em, `#6f6a62`
    - a native `<select>`: height 40, no border except a 1 px bottom border in `#2a2723`, 16 px, weight 600
  - **Condition options:** Ny, Nyskick, Mycket bra skick, Bra skick, Använt skick, Renoveringsobjekt. Default: Mycket bra skick.
  - **Group options:** `None`, each existing group, `+ New group…`. The last option should open an inline text input or prompt to create a group.
- **Platform toggles:** full-width rows, margin-top 24 px, height 46, `padding: 0 20px`, 1 px top border `#ddd6ca`.
  - Label: 17 px, weight 600, uppercase.
  - A state word on the right: `On` / `Off`, 14 px, weight 600.
  - On: tinted background with dark text (see tokens).
  - Off: transparent background, text `#aaa397`, label struck through.
  - All three platforms are **on by default**.
- **Generate button:** a full-width band, height 54, background `#2a2723`, text `#f6f3ed`. Content: "GENERATE" on the left and "→" on the right, 19 px, weight 500, uppercase.

**Stage B: Generating.** Large grey text "READING / PHOTO / …" (30 px, weight 500, `#cfc8bc`). Replace this with a real pending state while the Gemini call runs.

**Stage C: Result (all fields editable, nothing saved yet)**
- **Top row:** 11 px, uppercase, weight 700. On the left, a legend "Grey = AI draft · Black = yours" in `#6f6a62`. On the right, an underlined "Edit item" link that returns to Stage A with the inputs kept.
- **AI-draft vs. confirmed.** This is the core visual rule.
  - **Draft:** text color `#8a847a` with a **dashed** border.
  - **Confirmed:** text color `#2a2723` with a **solid** border.
  - A field becomes confirmed as soon as the user edits it, or changes the select value for categories.
- **Title:** a 2-row textarea, 20 px, weight 600, line-height 1.15, 2 px bottom border (dashed or solid).
- **Description:** a 6-row textarea, 15 px, line-height 1.5, 2 px left border (dashed or solid), 12 px left padding.
- **Category per checked platform:** one row per platform with a 1 px top border `#ddd6ca`.
  - A 10 px color stripe on the left in the platform's strong color.
  - The platform name as a label: 11 px, uppercase, weight 700.
  - A native `<select>` of suggested categories, 14 px. The last option is `Other…`, which should reveal a free-text input.
- **AI estimate** (read-only):
  - label "AI estimate"
  - the range, e.g. `350–550`, in 40 px, weight 500, `#8a847a`
  - 1–2 sentences of reasoning, 13 px, `#6f6a62`
- **Your price, kr:** a numeric input, 40 px, weight 500, 1.5 px solid bottom border. Placeholder "———". Digits only.
- **Save band:** same style as Generate, with the label "SAVE" and 22 px of margin above.
  - Its background is `#c9c2b6` (disabled) until an asking price is entered.
  - On save:
    1. Insert the item with status `active`, `date_listed = today`, the chosen platforms, the categories, the description and the condition.
    2. Reset the form.
    3. Switch to the ACTIVE tab.
    4. Show the toast "SAVED →".

### 2. ACTIVE
- **Hero row:** `{n} for sale`, with the **Days / Photo** segmented switch on the right.
  - Switch container: `#e8e3da`, pill shape, 2 px padding, 2 px gap.
  - Each segment: 5 × 12 px padding, 12 px, weight 600, pill shape.
  - Selected segment: background `#f6f3ed`, text `#2a2723`. Unselected: transparent, `#6f6a62`.
  - Persist the choice in localStorage.
- **Group filter row:** `padding: 14px 20px 12px`, `gap: 14px`, scrolls horizontally.
  - Filters: `All`, each group, `Ungrouped`. Text 13 px, weight 700, uppercase.
  - Selected: `#2a2723` with a 1.5 px underline. Unselected: `#aaa397`.
- **Rows** (sorted by days listed, longest first), each with a 1 px top border `#ddd6ca` and `padding: 12px 20px`, `gap: 14px`:
  - **Left column (Days mode):** the number of days in 30 px, weight 500, with a "DAYS" label under it (10 px, uppercase). The number is `#2a2723`, and **`oklch(0.52 0.15 38)` (muted orange) once it reaches 30 days or more**. Column width is 46 px.
  - **Left column (Photo mode):** a 64 × 64 thumbnail of the first photo. The days count moves into the meta line (`{group} · {n} days`), using the same orange rule.
  - **Middle:**
    - title: 16 px, weight 700
    - group: 12 px, `#6f6a62`
    - platform stripes: one 18 × 5 px bar per listed platform, in its strong color, 3 px gap
  - **Right:**
    - asking price: 17 px, weight 600, e.g. "1 200 kr"
    - a **Mark sold** pill: 12 px, weight 600, 6 × 11 px padding, 1.5 px solid `#2a2723` border, pill radius. On hover it fills with `#2a2723` and the text turns `#f6f3ed`.
- Tapping the row opens the **Item detail sheet**. Tapping **Mark sold** does not open the sheet (stop propagation). Instead it expands an inline dark bar under the row:
  - The bar: height 64, background `#2a2723`.
  - It contains a "SOLD FOR" label, a numeric input prefilled with the asking price (24 px, weight 500), the word "today", ✕ to cancel, and an **OK** chip.
  - OK moves the item to sold with `price_sold`, `date_sold = today` and days-to-sell, then shows the toast `+{price} kr`.
  - The brief mentions an editable sold date. Add a date field to this bar, defaulting to today.

### 3. SOLD
- **"+ PAST SALE" band:** height 56, 17 px, weight 500, uppercase, with a count on the right ("backlog" / "{n} added").
  - Tapping it toggles an inline dark panel (`#2a2723`, text `#f6f3ed`) containing:
    - item title
    - a 2-column row with kr and month (`yyyy-mm`)
    - a group select
    - a **SAVE + NEXT** chip
  - After saving, the title and price clear, while the **group and month stay filled** for fast backlog entry.
  - Backfilled items have no photo, description or days-to-sell.
- **Group filter row:** the same component as ACTIVE, with its own state. Padding: 16 px 20px 12 px.
- **Rows:** 1 px top border, `padding: 10px 20px`.
  - Left (flex 1):
    - title: 15 px, weight 700
    - meta: 12 px, `#6f6a62`, formatted `{group} · {Mon YYYY} · {n} days to sell` or `· backfilled`
  - **Right:** the sold price, 17 px, weight 600, right-aligned, e.g. "2 200 kr".
  - Sorted by date sold, newest first.
  - Tapping a row opens the Item detail sheet.
- **Footer total:** a 1.5 px solid `#2a2723` top border, `padding: 10px 20px 0`.
  - Left: "{filter} · {n} items" (11 px, uppercase, `#6f6a62`).
  - Right: the filtered sum, 17 px, weight 600, **aligned with the row prices above**.

### 4. TOTAL (dashboard)
- The hero is total revenue, e.g. "7 430 kr", at 44 px.
- A subline: "KR EARNED · {sold} OF {total} ITEMS SOLD", 13 px, weight 700, uppercase.
- **Sell-through bar:** height 10, radius 5, track `#e3ddd2`, fill `#2a2723` at `sold/total`. Under it, "{pct}% SOLD" on the left and "{n} LEFT" on the right in `#8a847a`, both 19 px, weight 500, uppercase.
- **Revenue by group:** a label "Revenue by group · tap to open", then a stacked 10 px bar with one segment per group. Segment width is proportional to revenue, and the fills are `#2a2723`, `#6f6a62`, `#bdb6aa`, in that order.
- **Group rows:** 1 px top border, 12 px vertical padding. Each row shows:
  - a 12 px color square
  - the name, weight 700
  - the sold/total count, 12 px grey
  - revenue, 20 px, weight 600, right-aligned in a 90 px column
  - `+` / `–` caret
- **Tapping a group expands it** (22 px left indent, 16 px bottom padding) into two lists:
  - **Sold · {n}:** a header with the group revenue, then rows of title and price (14 px, dashed dividers `#ddd6ca`).
  - **Still for sale · {n}:** a header with the total asking price, then rows in grey `#6f6a62`.
  - Empty states: "Nothing sold yet" / "All sold".
  - Only one group is open at a time. Tapping an item opens the detail sheet.
- An **"Ungrouped"** bucket is always included.
- **Grand total row:** a 1.5 px solid top border, "ALL" on the left and total revenue on the right.

### 5. Item detail sheet (overlay)
- **Backdrop:** `rgba(42,39,35,.4)`. Tapping it closes the sheet.
- **Sheet:** bottom-anchored, `max-height: 88%`, scrolls internally, background `#f6f3ed`, radius 16 px 16 px 0 0.
- **Photo:** 220 px tall, the first photo (swipe for more in the real app). A ✕ close button sits top-right: 36 px circle, background `#f6f3ed`.
- **Body:** `padding: 18px 20px 36px`, `gap: 16px`.
  - **Status label:** 11 px, uppercase. For active items it reads "For sale · {n} days" (orange at 30 days or more, otherwise grey). For sold items it reads "Sold" in `oklch(0.5 0.12 150)`.
  - **Title:** 22 px, weight 600.
  - **Facts grid:** 3 columns between 1 px `#ddd6ca` rules, 12 px vertical padding. Each fact has a 10 px uppercase label and a 15 px weight-600 value.
    - Active: Asking / Condition / Group.
    - Sold: Sold for / Condition / Sold (month).
  - **Platform pills:** tinted background with dark text, 12 px, weight 600, 4 × 10 px padding.
  - **Description:** 15 px, line-height 1.55. If a backfilled item has none, show "No description saved. This sale was backfilled."
  - **Active items only:** a "Mark sold" button, height 50, pill shape, background `#2a2723`. It closes the sheet and opens the inline sold bar on that row.

### Toast
Full-width at the bottom, height 84, background `#2a2723`, text `#f6f3ed`, 18 px, weight 500, uppercase. It auto-hides after 1.6 s.

---

## State (from the prototype)
```
tab: 'new' | 'inv' | 'sold' | 'dash'
new-listing: name, condition, group, plats{T,B,F}, stage('form'|'generating'|'result'),
             title, titleOk, desc, descOk, cats{T,B,F}, catsOk{…}, ask
active: fGroup, leftMode('days'|'photo'), sellId, sellPrice
sold:   sfGroup, pastOpen, past{title,price,date,group}, pastCount
total:  openGroup
global: detail{kind:'active'|'sold', id} | null, toast
```
Everything is derived at render time: days listed (today − `date_listed`), days-to-sell, sums, sell-through and per-group totals. Nothing is stored as an aggregate.

## Data model (extends the brief)
`items` gets these columns:
- `condition` (one of the 6 values)
- `photos` (a child table or a JSON array of blob URLs; the first is the thumbnail)
- `is_backfill` (bit)

The `platforms_listed` field can be three bits or a child table.

Keep one category per platform: `category_tradera`, `category_blocket`, `category_facebook`.

Backfilled items have `date_listed = NULL`, so days-to-sell is null and the UI shows "backfilled".

## AI call (Gemini)
- **Input:** photo(s), name, condition.
- **Return JSON:**
  ```
  { title, description, categories:{tradera, blocket, facebook}, estimate:{low, high, reasoning} }
  ```
- Titles and descriptions are in **Swedish**. The reasoning is in English.
- Only request categories for the platforms that are checked.
- Let the user regenerate. Never auto-save.

## Design Tokens
| Token | Value |
|---|---|
| Background | `#f6f3ed` |
| Ink (text, primary buttons) | `#2a2723` |
| Grey text / labels | `#6f6a62` |
| AI-draft text | `#8a847a` |
| Inactive / disabled text | `#aaa397`, `#9a9489` |
| Rule / divider | `#ddd6ca` |
| Photo placeholder | `#ebe6dc` with `#e5dfd4` lines |
| Switch track | `#e8e3da` |
| Progress track | `#e3ddd2` |
| Disabled button | `#c9c2b6` |
| Hover row | `#efebe3` |
| Stale (≥30 days) | `oklch(0.52 0.15 38)` |
| Sold status | `oklch(0.5 0.12 150)` |
| Group shades | `#2a2723`, `#6f6a62`, `#bdb6aa` |
| Tradera strong / tint / text | `oklch(0.8 0.15 85)` / `oklch(0.93 0.05 85)` / `oklch(0.42 0.09 75)` |
| Blocket strong / tint / text | `oklch(0.6 0.19 27)` / `oklch(0.93 0.035 27)` / `oklch(0.47 0.14 27)` |
| Facebook strong / tint / text | `oklch(0.55 0.16 258)` / `oklch(0.93 0.03 258)` / `oklch(0.44 0.13 258)` |

**Typography**
- Family: **Archivo** (Google Fonts), normal width.
- Scale:
  - 44 (Total hero)
  - 40 (price input and estimate)
  - 34 (hero)
  - 30 (days number)
  - 24 (name input)
  - 22 (detail title)
  - 20 (result title, group revenue)
  - 19 (bands)
  - 17 (prices, toggles)
  - 16 (row titles)
  - 15 (body)
  - 14
  - 13 (tabs, filters)
  - 12 (meta)
  - 11 (uppercase labels, letter-spacing .1em)
  - 10 (micro labels)
- Weights: 500, 600, 700, 800.
- Money is formatted `sv-SE` with a space as the thousands separator and a trailing " kr", e.g. "1 200 kr".

**Spacing & shape**
- 20 px horizontal page gutter.
- Vertical rhythm: 10, 12, 14, 16, 20, 22, 24, 26.
- Sharp rectangles everywhere except pills (the Mark sold button, switch and platform pills) and the sheet's 16 px top corners.
- No shadows.

## Assets
There are no icons or image assets. The striped boxes are placeholders for the user's uploaded photos. The only glyphs used are →, ✕, + and –.

## Files
- `ResaleFinal.dc.html` is the final clickable prototype. Open it in a browser with `support.js` next to it. The logic class at the bottom holds the mock data and every interaction.
- `support.js` is the runtime needed to open the prototype. It is not part of the app.
- `resale-prep-tool-handoff.md` is the original product brief (screens, data model, stack).
