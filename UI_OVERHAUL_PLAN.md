# UI Overhaul Plan — Fisheries Monitoring Review Portal

**Status:** proposal · **Date:** 2026-08-08 · **Audience:** hackathon team
**Premise:** this is a commercial product for MPI. It has to be robust, simple, and clear. Right now it is a good-looking mockup wired to a real database, and the gap between those two things is the work.

---

## 1. What the product actually is

The current app is organised **vessel-first**: Fleet → pick a vessel → watch video. That mirrors how the data is stored, not how the job is done.

A compliance reviewer's job is: **clear a queue of flagged events before the statutory deadline, and leave a defensible record of each decision.** Everything in the UI should serve that sentence.

That single reframe drives most of the plan below.

---

## 2. Audit — what's wrong today

Grouped by how much it matters for a product MPI would actually buy.

### A. Integrity problems (fix first — these are disqualifying)

| # | Finding | Where |
|---|---|---|
| A1 | **Fabricated numbers shown next to real ones.** "Fishing now" is `Math.floor(totalVessels * 0.25)`. "Flags by category" is a hardcoded array (8/4/2/1). The 7-day "Review backlog by age" chart is invented. None of it touches the DB. | `FleetView.jsx:22-58` |
| A2 | **The core workflow doesn't exist.** `PUT /api/flags/:id/resolve` exists on the server and is never called. The `reviews` table (notes, compliance_score) has no endpoint and no UI. "Submit review" and "Export clip" are dead buttons. Observer notes textarea saves nowhere. | `server.js:121`, `VesselView.jsx:29-36,183` |
| A3 | **No audit trail in the UI.** `resolved_by` / `resolved_at` / `resolution` columns exist and are invisible. For a regulatory system the audit record *is* the product. | `database.js:58-70` |
| A4 | **No deep links.** View is `useState('fleet')`. You cannot link to a vessel or a flag, browser back doesn't work, and nothing is citable in an enforcement file. | `App.jsx:10` |
| A5 | **The whole repo is served as static assets** — `publicDir: '../'` publishes `backend/data/portal.db` over HTTP. | `vite.config.js:7` |
| A6 | **Hardcoded 3:45 duration** while recordings run up to 690 minutes, and `formatTime` has no hours field (690 min renders `690:00`). The scrubber is meaningless for real data. | `VesselView.jsx:9,11-15` |

### B. Workflow problems

| # | Finding |
|---|---|
| B1 | Nav lies — "Review queue" and "Reports" are dead links. The queue is the one screen the product most needs. |
| B2 | Flags are listed as text below the player, not marked on the scrubber. Reviewer reads "12:34" and seeks by hand. |
| B3 | Four cameras are an either/or segmented control. Verifying an event needs synchronised multi-cam, not tab-switching. |
| B4 | Mouse-only. No shortcuts at all. For someone scrubbing hours of footage per day this is the single biggest throughput lever left on the table. |
| B5 | High / Medium / Low all render in the same accent tint — severity is not visually readable. |
| B6 | No way to create a flag from the player, despite `POST /api/flags` existing. |
| B7 | Fetches *all* flags then filters client-side, while `GET /api/recordings/:id/flags` sits unused. |
| B8 | `useState(recordings[0])` never updates when recordings arrive → selection silently wrong. One global `loading` blanks the entire page on any fetch. |

### C. Craft / quality problems

| # | Finding |
|---|---|
| C1 | **~700 lines of inline `style={{}}`.** No classes, no reuse, no hover/focus states, no responsive rules, no theming. Every future change is a copy-paste. |
| C2 | **`var(--radius)` does not exist.** The tokens are `--radius-sm/md/lg`. Every one of the ~15 `border-radius: var(--radius)` declarations is invalid and silently dropped. Things are square by accident, not by design. |
| C3 | **The design system is loaded and then bypassed.** `index.html` re-implements `.btn`, `.tag`, `.blueprint`, `.table`, `.seg` in a `<style>` block, duplicating `design/_ds/.../styles.css`. Two sources of truth already drifting. |
| C4 | Accessibility: clickable `<div>`s for tabs and table rows (no role, no tabindex, no Enter), `<a>` without href as buttons, an `↻` icon button with no label, no `:focus-visible`, unlabelled textarea. A government product will have WCAG 2.1 AA obligations. |
| C5 | No empty states, no skeletons. Errors render a raw axios string in a red bar with no retry. |
| C6 | Not responsive. Fixed 1180/1400px widths, a 340px sidebar, `repeat(4,1fr)`. Breaks under ~1100px — and plenty of MPI staff are on 1366×768 laptops. |
| C7 | Wrong density for a work tool: 38px page titles, tall KPI tiles, generous whitespace. An operator wants rows on screen. |
| C8 | Blueprint corner marks on *everything*, including buttons. Decorative chrome competing with data — and because the DS forbids surface fills, nothing has elevation, so nothing draws the eye to what needs attention. |
| C9 | Light-only. Reviewers watch video for hours; a #f2f2f3 ground around dark footage is fatiguing and hides detail. |
| C10 | The map is a placeholder with positions derived from array index, labelled "MAP PLACEHOLDER". A fake map in an MPI demo reads as vapour. |

---

## 3. Target information architecture

Four screens. Queue is home.

```
/queue                 Review Queue      ← home. the work list.
/review/:flagId        Review Workspace  ← one flag at a time. the deep screen.
/vessels               Fleet             ← roster + situational awareness.
/vessels/:imo          Vessel Record     ← history, past determinations, compliance record.
/reports               Reports & Audit   ← exports, audit trail.
```

**Review Queue (home).** One row per unresolved flag, sorted by statutory deadline. Columns: due-in, severity, type, vessel, recording date, timecode, assignee. Filters for severity / type / vessel / age / assignee, all encoded in the URL so a filtered queue is shareable. Sticky header, compact rows, `j`/`k`/`Enter` navigation. Bulk-select for triage.

**Review Workspace (the screen that matters).** Full-height, dark, one flag at a time.
- Video with **flag markers on the scrubber** and a haul overlay track.
- **Multi-cam 2×2 grid** with synced playhead; click any pane to promote it to primary.
- **Determination panel**: uphold / dismiss / escalate, reason, free-text note. Writes through `PUT /api/flags/:id/resolve`. Save state is always visible.
- **Next / previous flag within the queue** — the reviewer never bounces back to a list between items.
- Evidence context: vessel, licence, gear, captain, crew, prior determinations for this vessel.

**Vessel Record.** Reference, not workflow. All recordings, all past determinations, compliance history, AIS summary.

**Fleet.** Demoted from home. A real roster: searchable, sortable, honest columns.

**Reports & Audit.** Append-only audit log, filterable, exportable. This is what makes the tool defensible.

---

## 4. Design language decisions

Keep the Industry design system's voice — Barlow Condensed over Barlow, steel accent, technical grid. It's a credible register for a government tool and it's already built. But it was authored as a *wireframe* aesthetic, and a dense operational tool needs three deliberate, documented deviations.

**4.1 — Add a semantic colour layer.** The DS is mono (one steel accent) and has no status vocabulary. A compliance tool cannot express severity in one colour.

| Role | Use | Rule |
|---|---|---|
| `--sev-high` | High severity, overdue | Distinct red, not the accent |
| `--sev-medium` | Medium, due soon | Amber |
| `--sev-low` | Low | Neutral steel |
| `--status-resolved` | Determination made | Green |
| `--status-escalated` | Escalated | Violet |

Every one of these must pair colour with a **text label and a distinct shape** — never colour alone. Colour-blind reviewers and printed evidence packs both need it. All text-on-tint pairs verified at ≥4.5:1 (use the DS 700/800 ramp steps on tinted fills, which is what the DS readme already prescribes for body-size accent text).

**4.2 — Introduce elevation.** The DS's "cards are transparent line drawings, no surface fill" rule is a mockup aesthetic. In a data-dense tool it means everything has identical visual weight and nothing signals priority. Add three surfaces: page ground → card surface → raised (dialogs, popovers, the determination panel). Use the existing `--shadow-sm/md/lg` tokens, which are already tuned to the ground.

**4.3 — Spend the blueprint marks where they earn it.** Retire corner registration marks from buttons, tabs, and dense data surfaces. Keep them on the few "official document" surfaces — the evidence panel, report headers, the determination record — where they genuinely signal *this is a formal record*. Restraint makes them mean something.

**4.4 — Dual theme.** Light for queue, fleet, reports, admin. **Dark by default in the Review Workspace** — video wants a dark surround. Global toggle, persisted. Both themes defined from the same token set.

**4.5 — Density and type for a work tool.**
- Default **compact** (≈36px table rows), with a comfortable option.
- Page titles drop from 38px → 24px. Barlow Condensed stays, at working sizes.
- `font-variant-numeric: tabular-nums` on every numeric column — IMOs, licences, timecodes, counts must align vertically.
- Timecodes in a monospace-figure treatment; `HH:MM:SS` always, so 690 minutes reads `11:30:00`.

---

## 5. Keyboard model

This is a throughput feature, not a nicety. Discoverable via a `?` overlay.

**Queue:** `j`/`k` move · `Enter` open · `x` select · `e` resolve inline · `/` focus search · `1`–`3` severity filter

**Workspace:** `Space` play/pause · `←`/`→` ±1s (`Shift` ±10s) · `,`/`.` frame step · `1`–`4` camera · `g` grid view · `f` new flag at playhead · `u`/`d`/`s` uphold / dismiss / escalate · `⌘↵` submit determination · `n`/`p` next / previous flag · `?` shortcuts

Target: **a determination in under five keystrokes** once the reviewer has seen the footage.

---

## 6. Robustness rules

Non-negotiable, applied everywhere.

1. **No fabricated figures.** Every number traces to an API field. If the backend can't supply it, the tile reads "Not available" — or we add the endpoint. Delete `generateCategories`, `generateBacklog`, `generatePositions` and the invented KPIs.
2. **Four states per async surface**, component-scoped, never one global blank: skeleton → empty (with reason + next action) → error (what failed, what to do, retry button) → content.
3. **Visible write state.** Optimistic update, rollback on failure, and a persistent saved / retrying / failed indicator with `aria-live`. A reviewer must never wonder whether their determination was recorded.
4. **Determinations are append-only.** Amending creates a new record citing the old one. Never overwrite an audit row.
5. **Honest permissions.** The header shows the real user and role; actions the role can't perform are disabled *with a reason*, not hidden and not dead.
6. **Degraded-connection handling.** Show connection state; queue writes and replay them. Realistic for this user base.
7. **Accessibility: WCAG 2.1 AA as a gate, not a phase.** Semantic `<button>`s, `:focus-visible` rings on everything, labelled controls, complete keyboard operation of the player, no colour-only meaning.
8. **Works at 1366×768.** Tested, not assumed.

---

## 7. Frontend engineering plan

**7.1 Foundation**
- Add `react-router-dom`. Routes replace `currentView`. Filters live in the query string.
- Add `@tanstack/react-query`. Kills the hand-rolled loading/error state, fixes the stale-selection bug, gives retry and mutation states for free.
- **Delete every inline `style={{}}`.** Replace with a real styles layer:
  ```
  frontend/src/styles/
    vendor/industry.css   ← the DS, imported as a dependency
    tokens.css            ← semantic colours, density, dark theme
    base.css              ← reset, type, focus rings
  frontend/src/components/**/*.module.css
  ```
- **Remove `publicDir: '../'`** from `vite.config.js` (stops serving the SQLite DB), and import the DS stylesheet properly instead of loading it by URL.
- **Delete the duplicated `<style>` block in `index.html`** — the DS is the single source of truth.
- **Fix `var(--radius)` → `var(--radius-md)`** everywhere. Then decide radius deliberately: square for data surfaces, `--radius-sm` for controls.

**7.2 Primitives** (build once, use everywhere)
`Button` · `Badge` / `SeverityBadge` / `StatusBadge` · `Field` · `Input` · `Select` · `DataTable` (sortable, sticky header, keyboard rows, tabular numerals) · `Card` · `Dialog` · `Toast` · `Skeleton` · `EmptyState` · `ErrorState` · `Timecode` · `DueBadge` · `ShortcutHint` · `SaveIndicator`

**7.3 `VideoPlayer`**
Real `<video>`, not a placeholder div. Flag markers on the scrubber, haul track, multi-cam grid with a synced playhead, full keyboard control, duration read from `duration_minutes`. Works against placeholder MP4s until real media exists.

**7.4 Backend work the UI needs**

The UI cannot be robust without these. Small changes, mostly SQL.

| Endpoint / change | Why |
|---|---|
| `GET /api/stats/queue` | Real counts by severity, type, and age — computed in SQL. Replaces every fabricated number. |
| `PUT /api/flags/:id/resolve` — wire it up | Exists, unused. The core write path. |
| `POST /api/reviews`, `GET /api/reviews?vessel_id=` | The `reviews` table has no endpoint at all. |
| `GET /api/audit?entity=&id=` + an `audit_log` table | The evidentiary backbone. |
| `flags.due_at`, `flags.assigned_to` | Statutory 7-day window and ownership — the queue's two most important columns. |
| `recordings` → per-camera media URLs | There is currently no video anywhere in the system. |
| Server-side filter/sort/paginate on `/api/flags` | Client-side filtering of all flags won't survive real volume. |

---

## 8. Phasing

Hackathon-realistic. Each phase is demoable on its own.

| Phase | Scope | Est. |
|---|---|---|
| **0 — Foundation** | Router, styles layer, DS as single source of truth, `--radius` fix, remove the DB-serving publicDir, primitives, light/dark, density tokens. No visible feature change; everything after gets cheap. | ~½ day |
| **1 — Review Queue** | Queue as home. `GET /api/stats/queue`. Delete all fabricated data. Four states everywhere. Keyboard queue nav. URL-encoded filters. | ~1 day |
| **2 — Review Workspace** | Player with flag markers + multi-cam + keyboard. Determination panel with a real write path, audit record, and visible save state. Next/prev flag. **This is the demo.** | ~1–1½ days |
| **3 — Vessel Record + Reports** | Vessel history and past determinations. Audit log with export. | ~½ day |
| **4 — Hardening** | WCAG AA pass, 1366×768 pass, empty/error copy, `?` shortcut sheet. | ~½ day |

**Cut list.** The map either becomes real (Leaflet + actual AIS points) or comes out entirely — a labelled placeholder is worse than nothing in front of MPI. Reports stays shallow: audit log and CSV export, no analytics.

---

## 9. How we'll know it's better

- **Zero** figures on screen that don't trace to an API field.
- A determination takes **under five keystrokes** and under 30 seconds once footage is seen.
- Every flag and every filtered queue has a **shareable URL**.
- Every determination produces an **audit row** visible in the UI.
- Automated a11y audit clean at **WCAG 2.1 AA**; the workspace fully operable without a mouse.
- Usable at **1366×768** with no horizontal scroll.
- No `style={{}}` left in the codebase.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| No video media exists anywhere in the system | Ship with a few placeholder MP4s and a real `<video>` element; the player is honest about what it's playing. Don't fake a canvas. |
| Deviating from the DS (elevation, semantic colour, fewer corner marks) could read as off-brand | Document the three deviations as an extension layer built from DS tokens, not a replacement. Keep type, accent, and grid untouched. |
| Phase 2 is the largest chunk and the demo depends on it | Phase 0 exists precisely to de-risk it. If time runs short, ship single-cam with flag markers — markers are the insight, multi-cam is the polish. |
| Statutory review window (7 days) is currently an assumption | Confirm the real obligation before it's rendered as a deadline. Until confirmed, label it as configurable, not as law. |
