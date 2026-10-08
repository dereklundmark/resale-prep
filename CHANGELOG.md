# Changelog

Versions follow [semantic versioning](https://semver.org): **MAJOR.MINOR.PATCH**:
patch for fixes, minor for new features, major for big changes. The version shows in the
footer of the TOTAL screen, next to the commit it was built from.

## 1.3.0 (2026-10-08)

- **Posted checklist.** Picking Tradera and Blocket on NEW now means "to post there", not
  "live". Open an item on ACTIVE and tick each platform once the listing is actually live
  (the tick saves the day). On the ACTIVE list a solid stripe is live, an outline stripe is
  still to post, and the row says "to post: Blocket".
- **Skip Gemini.** NEW has a "Skip Gemini · write it yourself" link that goes straight to
  the listing form (title from "What is it?", your own description, categories and price),
  so you can save to ACTIVE without photos or waiting for Gemini. Generate is still there.
- **Laptop layout.** On a laptop or desktop (mouse and a wide window) the app is wider: NEW
  has the photo beside the fields, ACTIVE and SOLD show two columns, and an item opens as a
  centred window with its photos beside the details. The iPhone layout is unchanged.
- **Easier swipe to mark sold.** iOS used to cancel the swipe whenever the thumb moved a
  little up or down at the start, so most swipes turned into a tiny scroll. A touch that
  moves more sideways than up/down is now always a swipe, and the row follows your finger
  before snapping open. Up/down still scrolls the list. On a laptop you can drag a row with
  the mouse.
- Fix: a typed category with no Gemini suggestions no longer disappears after one letter.
- Fix: the hidden "Mark sold" button no longer shows as a thin line on the edge of rows.
- Database: `item_platforms.posted_on` (`sql/007_posted.sql`). Items listed before this
  count as posted on the day they were listed. **Run the script before deploying.**

## 1.2.1 (2026-10-07)

- TOTAL hides the Ungrouped row when nothing is ungrouped.

## 1.2.0 (2026-10-07)

- Generate wait: a large price tag sways from its hole ("Pricing it up…"), replacing the
  photo scan.
- New home-screen icon: the same outline price tag in ink on cream.
- Fix: editing an item or marking it sold no longer makes its photo disappear from the
  lists. The photo was never deleted; the API's reply to an edit just left the photo list
  out, and the app replaced its copy of the item with that reply.

## 1.1.2 (2026-10-07)

- An expired login now sends you through GitHub sign-in and back automatically. Before,
  the installed app opened from its offline copy and every request failed with "Could not
  reach the server", because the redirect to the login page was blocked.
- The app's update file (service worker, now a single sw.js) is reachable without a login, so an installed
  app still updates itself after its session expires. Data stays behind the owner login.

## 1.1.1 (2026-10-07)

- Sharper home-screen icon: each size is drawn with its straight edges on whole pixels
  instead of scaled down from 512 px, which left a blurred grey line along every edge.

## 1.1.0 (2026-10-07)

Group funds (design v3).

- A group can double as a fund: give it a purpose (e.g. "Photo gear fund") and add
  purchases paid from its earnings. TOTAL shows spent, left (or over) and a Bought section;
  the "kr earned" totals stay sales-only.
- Tap a purchase to edit it, move it to another group or delete it.
- Deleting a group that still has items or purchases asks where to move them first.
  Moving to Ungrouped keeps the items but deletes the purchases (a purchase needs a real
  group), with a warning.
- Database: `groups.purpose`, `purchases` table and `group_funds` view
  (`sql/005_purchases.sql`). API: `/api/purchases`, group purpose, delete with `moveTo`.
- Backups include purchases and purposes.

## 1.0.1 (2026-10-07)

- The "database settings missing" message now names exactly which SQL_* setting is missing,
  and setting values are trimmed so a stray space doesn't break the connection.

## 1.0.0 (2026-10-07)

First real release: live on Azure, data in Azure SQL.

- **Listings:** photo + short description → Gemini drafts a title, description, category per
  platform and a price range, in the market's language. AI drafts are grey until edited.
- **Tracking:** ACTIVE (days listed, swipe left to mark sold), SOLD (with backfilled past
  sales), TOTAL (revenue, sell-through, per-group breakdown).
- **Groups:** create, rename and delete (items become Ungrouped).
- **Design v2, one-handed:** pill tab bar at the bottom, pinned action button, photo-scan
  animation while generating, List / Photo switch on every list.
- **Azure:** Static Web Apps (owner-only login), Azure Functions API, Azure SQL free offer
  with auto-pause, CI/CD in Azure Pipelines with a mirror to GitHub.
- **Built to scale:** platforms, markets (country, language, currency) and conditions are
  rows in SQL, so adding Vinted or moving country needs no code change.
