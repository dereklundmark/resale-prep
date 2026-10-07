# Handoff: Resale Prep Tool (mobile-first web app) · v3

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

`ResaleFinal_v3.dc.html` is the current design. Earlier versions are `ResaleFinal_v2.dc.html` (v2) and It opens in a browser as long as `support.js` sits next to it. It is fully clickable and uses mock data and a fake 1.3 s "generate" delay. The logic class at the bottom of the file, `class Component`, is a readable spec of every state transition. `ResaleFinal_v1.dc.html` (v1), kept for diffing.

## Fidelity
**High-fidelity.** Colors, type, spacing and interactions are final. Recreate them closely. The only intentional placeholders are the striped photo boxes, which should be replaced by real uploaded images.

---

## What changed in v3 (vs. v2)
v3 adds one side feature: **a group can double as a fund**. Nothing else changes: same tokens, type, spacing, light pill tab bar and v2 flags. Groups without a purpose or purchases look and behave exactly as in v2.

### Rules
- **A purchase belongs to exactly one real group.** "Ungrouped" can't have purchases or a purpose. Fields: `what` (text), `amount` (whole kr), `date` (YYYY-MM-DD). No photo.
- **Each group has an optional `purpose`** (text), e.g. "Photo gear fund".
- **`left = earned − spent`.** `earned` is the sum of the group's sold prices, and `spent` is the sum of its purchases. Always calculate it; never store it.
- **The TOTAL hero and "kr earned" stay sales-only.** Purchases never change them, and they don't affect the group revenue bar either.
- A group "has a fund" when `purpose` is set **or** it has at least one purchase. Only then do the fund elements below appear.

### 1. Collapsed group row (TOTAL)
- When the group has a fund, a second line sits under the name: 12 px, weight 600, `{purpose || 'Fund'} · {left} kr left`, in green `oklch(0.5 0.12 150)`.
- When it's overspent (left < 0), the line reads `… · {|left|} kr over` in stale orange `oklch(0.52 0.15 38)`.
- The rest of the row (square, counts, revenue, caret) is unchanged.

### 2. Expanded group
The order is:
1. **Fund indicator** (only if the group has a fund), at the top:
   - A 10 px bar, radius 5, track `#e3ddd2`. The fill width is `min(100, spent/earned × 100)%` in ink. When overspent, the fill is 100% in stale orange.
   - Under it: "Spent {spent}" on the left and "Left {left}" on the right in green (or "Over by {x}" in orange). Both 13 px, weight 600.
   - Then "of {earned} earned" in 11 px `#9a9489`.
2. **Sold** and **For sale** sections, unchanged from v2.
3. **Bought section** (only if the group has a fund):
   - Header: 11 px uppercase, weight 700, in **ink**. "BOUGHT · {spent}" on the left, "{n} ITEM(S)" on the right.
   - Rows use the same layout as Sold rows (14 px, 7 px padding, dashed dividers).
   - Each row has a **"bought" pill**: solid ink background with `#f6f3ed` text. This tells it apart from the green "sold" pill and the outlined "for sale" pill.
   - Then the title, followed by " · 20 Sep" in 12 px `#9a9489`, then the amount as **"−3 900 kr"** (weight 600, ink). Sorted newest first.
   - Empty state: "Nothing bought yet. All {earned} is still in the fund." (13 px, `#8a847a`).
4. **Link row** (real groups only, hidden while a panel is open):
   - 13 px, weight 600, `space-between`, 8 px vertical hit padding.
   - Left: "+ Add purchase" in ink, underlined.
   - Right, 12 px gap: "Set purpose" (reads "Purpose" once set), "Rename" (`#6f6a62`), and "Delete" (orange). The first tap on Delete turns it into "Tap again"; the second tap deletes the group.
   - Deleting a group moves its items and sales to Ungrouped, and **deletes its purchases and purpose**.

### 3. "+ Add purchase" panel
- An inline dark panel (`#2a2723`, text `#f6f3ed`, `padding: 14px 16px 16px`) in place of the link row. It contains:
  - The label "ADD PURCHASE · {group}" (11 px uppercase, `#cfc8bc`).
  - "What did you buy?" input (18 px, weight 600).
  - A 2-column grid: kr (numeric) and date (`type="date"`, default today).
  - A live preview line: "After this: {x} kr left / over" (12 px, `#cfc8bc`).
  - A "Cancel" link.
- **Save follows the v2 pinned pattern:**
  - With `pinned` on (recommended), SAVE PURCHASE is the pinned band above the tab bar. It is grey (`#c9c2b6`) until both "what" and amount are filled.
  - In-flow, a cream "SAVE" chip sits next to Cancel instead.
- On save, the panel closes and the toast shows "−{amount} kr".
- This is a single save, not "save + next", because purchases are rare.

### 4. Purpose and Rename
- Both replace the link row with a cream inline form:
  - An 11 px label ("PURPOSE" / "GROUP NAME").
  - A 17 px weight-600 input with a 1.5 px ink underline. The purpose placeholder is "e.g. Photo gear fund".
  - "Save" and "Cancel" links.
- Purpose also shows "Remove purpose" (orange) on the right once a purpose is set. Saving an empty purpose also removes it.
- Rename updates every reference: items, sales, purchases, the purpose and the active filters. Duplicate or empty names are ignored.

### 5. Purchase sheet (tap a purchase)
- Same overlay as the item sheet (covers the tab bar), but slimmer: **no photo, platforms or condition**, and `padding: 16px 20px 40px`.
- **Top row:** status "PURCHASE · {group}" (11 px uppercase, `#6f6a62`) and a ✕ (36 px circle, `#e8e3da`).
- **View:**
  - The "what" as the title (22 px, weight 600).
  - A 3-column facts grid: Amount (−3 900 kr) / Date (20 Sep 2026) / Fund (2 120 kr left in green, or "… over" in orange).
  - Link row: "Edit" on the left; "Delete purchase" on the right in orange, with a "Tap again to delete" confirm.
- **Edit:**
  - The status reads "EDITING PURCHASE" in ink.
  - Fields: What, then Amount and Date in a 2-column grid, then a "Paid from group" select (real groups only, so a purchase can be moved).
  - A "Save changes" pill and a "Cancel" link.

### Data model additions
```
groups:    + purpose NVARCHAR NULL
purchases: id, group_id (FK, NOT NULL, cascade delete), what NVARCHAR, amount INT, date DATE, created_at
```
- Left, spent and earned are views or queries, never columns.
- Add `purchases` (and `purposes`) to the backup export/import JSON.

### Prototype props (demo only)
These exist only to stage screenshots. Ignore them when building:
- `fundSeed`: `normal` | `over` | `empty`
- `openGroup`
- `fundUi`: `add` | `purpose` | `rename`
- `purchaseId`
- `purchaseEdit`
- `scrollTop`

The mock data adds two Garage Cleanout sales, so the group earns 6 020 kr as in your example.

---

## What changed in v2 (vs. v1)
v2 is driven by one-handed use: phone in the right hand, thumb only. The look is unchanged: same tokens, type scale, spacing, no icons. Each item below is specced in full further down.

1. **Tab bar moved to the bottom, as a light pill.**
   - The four text tabs sit in a sand-coloured pill above the home indicator, padded for the bottom safe area. It's the same visual as the Days / Photo switch.
   - The active tab is a cream capsule. There is no underline and no top rule.
   - Tabs share the width equally, and each is a 46 px tall hit target.
   - The hero line stays at the top.
   - The iOS keyboard covering the bar while typing is acceptable.
2. **Toast moved above the tab bar.** It used to sit at the very bottom of the screen. It's now 52 px tall and sits directly above the pill bar, or above the pinned action band if one is showing.
3. **The item detail sheet covers the tab bar.** It overlays everything (z-index above the bar). Its bottom padding is 40 px for the safe area.
4. **TOTAL, expanded group:** Sold and For-sale are now visually distinct sections, each with tagged rows. See *TOTAL*.
5. **Detail sheet: Edit and Delete.**
   - "Edit" and "Delete item" text links sit at the bottom of the sheet.
   - Edit turns the sheet into a form. Delete needs a confirmation tap.
6. **Past-sale panel:** a "GROUP ▾" label now sits above the group picker.
7. **NEW result:**
   - A "Redo" link sits next to "Edit item". It regenerates the drafts.
   - When Generate fails, an error line in the stale orange appears above the action band.
8. **ACTIVE "Sold for" bar:** the date word ("today") is tappable and opens a native date picker. The label then shows e.g. "3 Oct".
9. **TOTAL footer:** "Backup: Export · Import" links and a version line.
10. **Two explorations, both behind flags.** Pick one before building. Recommendations are marked.
    - `pinned` (default **off** in the prototype; **recommended on**): the main action band sticks just above the tab bar instead of ending the content. This applies to GENERATE (form), SAVE (result) and SAVE + NEXT (past-sale panel). The in-flow copies of these buttons are hidden when it's on.
    - `markSold: 'pill' | 'swipe'` (**recommended: swipe**): in swipe mode the right-edge pill is removed. Swiping a row left reveals a full-height MARK SOLD button. The detail sheet keeps its full-width Mark sold pill as the tap path.
11. **Data:** sold items now store a full date (`YYYY-MM-DD`). Backfilled sales store a month (`YYYY-MM`). The sold date shown in the detail sheet uses "14 Sep 2026" or "Jun 2025".

---

## Global Layout
- **Target viewport:** iPhone, 390 × 844 CSS px, fluid down to 360 and up to around 430.
  - On desktop, center the same layout in a column with `max-width: 560px`. No separate desktop design was made.
- **Structure,** top to bottom:
  1. iOS safe-area top padding (the mock shows a 50 px status bar).
  2. **Scrollable content area** (`flex: 1; overflow-y: auto`). It starts with the **hero line**, then the screen body, then a 24 px spacer.
  3. **Pinned action band** (only when `pinned` is on and the screen has a primary action). Height 54, ink, full-width. If there's a Generate error, an orange error line (13 px, weight 600, 10 × 20 px padding, 1 px `#ddd6ca` top rule) sits directly on top of it.
  4. **Bottom tab bar (light pill):**
     - Wrapper: `padding: 8px 16px env(safe-area-inset-bottom)` (the mock uses 30 px of bottom padding), background `#f6f3ed`, no top rule.
     - Pill: `display: flex; gap: 2px; padding: 5px; border-radius: 999px; background: #e8e3da`.
     - Each tab: `flex: 1; height: 46px; border-radius: 999px`, centered. The label is 13 px, weight 600, uppercase, letter-spacing .06em.
     - Active tab: background `#f6f3ed`, text `#2a2723`. Inactive tab: transparent, text `#6f6a62`.
     - The total bar height is about 94 px, including the safe area. Content scrolls above it, and it is not translucent.
     - *Explored and rejected:* a flat bar with a top line, a sand flat bar, a black flat bar, and a dark pill.
- No icons anywhere. The whole UI is typographic.
- **Hero line** (stays at the top; it's for reading, not tapping): `padding: 10px 20px 0`, flex row, `justify-content: space-between`, `align-items: center`.
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
- **Top row:** 11 px, uppercase, weight 700. On the left, a legend "Grey = AI draft · Black = yours" in `#6f6a62`. On the right, two underlined links with a 12 px gap:
  - **v2:** "Redo" re-runs Generate with the same inputs.
  - "Edit item" returns to Stage A with the inputs kept.
- **v2 error line:** if Generate (or Redo) fails, keep the current stage and show a line in `oklch(0.52 0.15 38)` (13 px, weight 600) directly above the action band. In-flow it has 20 px side padding; when pinned it sits on top of the pinned band. Copy: "Couldn’t generate drafts. Check your connection and try again." The next attempt clears it.
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
- **Save band:** same style as Generate, with the label "SAVE" and 22 px of margin above. When pinned, it sits above the tab bar instead.
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
- **v2, swipe variant (`markSold: 'swipe'`, recommended):**
  - The right-edge pill is removed.
  - A hint line sits under the filters: "← Swipe a row left to mark sold" (11 px, weight 700, uppercase, `#9a9489`).
  - Swiping a row left more than 30 px slides it by -116 px (`transition: transform .22s`). This reveals a full-height ink button behind it: "MARK SOLD", 13 px, weight 700, uppercase, `#f6f3ed`.
  - Swiping right, or tapping the row, closes it. Only one row is open at a time.
  - Set `touch-action: pan-y` on the row so vertical scrolling still works.
  - A tap that isn't a swipe opens the detail sheet.
- Tapping the row opens the **Item detail sheet**. Tapping **Mark sold** (the pill, or the revealed swipe button) does not open the sheet (stop propagation). Instead it expands an inline dark bar under the row:
  - The bar: height 64, background `#2a2723`.
  - It contains a "SOLD FOR" label, a numeric input prefilled with the asking price (24 px, weight 500), a date word, ✕ to cancel (`#cfc8bc`), and an **OK** chip.
  - **v2:** the date word is "today" by default, 13 px, weight 600, with a 1 px dotted `#cfc8bc` underline. Tapping it opens the native date picker (a hidden `<input type="date">` plus `showPicker()`). After picking, the label shows "3 Oct".
  - OK moves the item to sold with `price_sold`, `date_sold` (the picked date) and days-to-sell, then shows the toast `+{price} kr`.

### 3. SOLD
- **"+ PAST SALE" band:** height 56, 17 px, weight 500, uppercase, with a count on the right ("backlog" / "{n} added").
  - Tapping it toggles an inline dark panel (`#2a2723`, text `#f6f3ed`) containing:
    - item title
    - a 2-column row with kr and month (`yyyy-mm`)
    - a group select, with a **v2** label above it: "GROUP ▾" (11 px, weight 700, uppercase, letter-spacing .1em, `#cfc8bc`)
    - a **SAVE + NEXT** chip. When pinned, the chip is hidden and SAVE + NEXT becomes the pinned band.
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
- **Tapping a group expands it** (22 px left indent, 2 px top / 18 px bottom padding). **v2:** two clearly separate sections with a 22 px gap between them:
  - **Sold section (first):**
    - Header: 11 px, weight 700, uppercase, letter-spacing .1em, in green `oklch(0.5 0.12 150)`. "SOLD · {group revenue}" on the left, "{n} ITEMS" on the right.
    - Rows: 14 px, 7 px vertical padding, 1 px dashed `#ddd6ca` dividers, 10 px gap.
    - Each row has a **"sold" pill** (11 px, weight 600, 2 × 8 px padding, pill radius, background `oklch(0.94 0.04 150)`, text `oklch(0.4 0.1 150)`), then the title (flex 1, ink), then the sold price (weight 600, ink, right).
  - **For-sale section:**
    - Header: same style in `#6f6a62`. "FOR SALE · {asking total} ASKING" on the left, "{n} ITEMS" on the right.
    - Each row has an **outlined "for sale" pill** (1 px `#bdb6aa` border, 1 × 7 px padding, `#6f6a62` text), then the title and asking price, both in `#6f6a62`.
  - Empty states: "Nothing sold yet" / "All sold" (13 px, `#8a847a`).
  - Only one group is open at a time. Tapping an item opens the detail sheet.
- An **"Ungrouped"** bucket is always included.
- **Grand total row:** a 1.5 px solid top border, "ALL" on the left and total revenue on the right.
- **v2 backup footer** (6 px below):
  - "Backup: **Export** · **Import**" in 12 px `#6f6a62`, with the links in ink, weight 600, underlined.
  - Export downloads `resale-backup-YYYY-MM-DD.json` containing `{app, version, exported, groups, items, sold}`.
  - Import opens a file picker for `.json`, validates the `items` and `sold` arrays, replaces the data, and shows the toast "Backup imported" (or "Not a backup file").
  - Under the links, a version line: "Resale Prep · version 1.2" (11 px, `#9a9489`). Wire it to the real build version.

### 5. Item detail sheet (overlay)
- **v2:** the sheet overlays **everything, including the bottom tab bar**, and slides up from the bottom.
- **Backdrop:** `rgba(42,39,35,.4)`. Tapping it closes the sheet.
- **Sheet:** bottom-anchored, `max-height: 90%`, scrolls internally, background `#f6f3ed`, radius 16 px 16 px 0 0.
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
  - **v2 link row** (bottom, `space-between`, 14 px, weight 600, underlined, 8 px vertical hit padding):
    - "Edit" on the left, in ink.
    - "Delete item" on the right, in `oklch(0.52 0.15 38)`. The first tap changes the label to "Tap again to delete". The second tap deletes the item, closes the sheet and shows the toast "Deleted".
- **v2 edit mode** (opened from "Edit"):
  - The photo shrinks to 120 px. The status line reads **"Editing"** in ink, and the title heading is hidden.
  - Form fields, using the New-form styles (11 px uppercase grey labels, 1 px ink bottom borders):
    - **Title:** a 2-row textarea, 20 px, weight 600.
    - A 2-column grid containing:
      - **Asking, kr** (or **Sold for, kr**): numeric
      - **Group** select: None plus the groups
      - **Condition** select
      - Sold items only: **Sale date** (`type="date"`), or **Sold (month)** (`type="month"`) for backfilled sales
    - **Description:** a 5-row textarea with a 2 px solid ink left border.
  - Actions: a "Save changes" pill (flex 1, height 50, ink) and a "Cancel" underlined link to its right.
  - Save writes the changes, returns to view mode and shows the toast "Saved". Cancel discards the changes.

### Toast
- **v2:** a full-width band, height 52, `padding: 0 20px`, background `#2a2723`, text `#f6f3ed`, 18 px, weight 500, uppercase.
- It sits **directly above the tab bar**, or above the pinned band if one is visible. It never covers the tabs.
- It sits beneath the detail sheet in z-order.
- It auto-hides after 1.6 s.

---

## State (from the prototype)
```
tab: 'new' | 'inv' | 'sold' | 'dash'
new-listing: name, condition, group, plats{T,B,F}, stage('form'|'generating'|'result'),
             title, titleOk, desc, descOk, cats{T,B,F}, catsOk{…}, ask
active: fGroup, leftMode('days'|'photo'), sellId, sellPrice, sellDate, swipeId
sold:   sfGroup, pastOpen, past{title,price,date,group}, pastCount
total:  openGroup
new:    + genError (string|null)
global: detail{kind:'active'|'sold', id} | null, editing, ed{title,price,group,cond,desc,date}, delConfirm, toast
flags:  pinned (bool), markSold ('pill'|'swipe'), barColor (final: 'pillLight'; other values are rejected explorations)
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
- `ResaleFinal_v3.dc.html` is the **current** clickable prototype, with the v3 fund feature. Its props are the same as v2's plus the fund demo props.
- `ResaleFinal_v2.dc.html` is the v2 prototype. Open it in a browser with `support.js` next to it. The logic class at the bottom holds the mock data and every interaction.
  - Flags are props on the component: `pinned`, `markSold`, `barColor` (default `pillLight` = final), `leftMode`, `startTab`.
  - Demo props (`seedStage`, `detailId`, `detailEdit`, `demoError`, `sellOpenId`, `swipeOpenId`, `demoToast`, `pastOpen`, `openGroup`) exist only to stage screenshots. Ignore them when building.
- `ResaleFinal_v1.dc.html` is the previous version, for reference and diffing.
- `support.js` is the runtime needed to open the prototype. It is not part of the app.
- `resale-prep-tool-handoff.md` is the original product brief (screens, data model, stack).
