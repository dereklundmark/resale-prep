# Changelog

Versions follow [semantic versioning](https://semver.org): **MAJOR.MINOR.PATCH**:
patch for fixes, minor for new features, major for big changes. The version shows in the
footer of the TOTAL screen, next to the commit it was built from.

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
