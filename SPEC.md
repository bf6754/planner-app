# Weekly Task Manager — Build Spec

## What this is
A personal weekly task manager web app. **The week is the unit of work.** It's replacing Apple Notes + manual weekly copy-paste, so the bar is *ease of use*. Single user, personal use.

## The reference prototype
`WeeklyTasks.jsx` is the **approved visual + interaction prototype**. Treat it as the source of truth for **layout, styling, and behavior** — reproduce its look and feel faithfully. Do **not** treat it as the source of truth for **architecture**: it's a single in-memory component with seeded data and a few faked behaviors (called out below). The real app should be properly structured and persistent.

## Tech direction
- **React.** Use Vite for the scaffold (simple, fast, Vercel-friendly). Next.js is fine if routing/SSR is wanted later, but not required.
- Runs locally in the browser; **deployable to Vercel** with zero backend for v1.
- **Persistence:** start with `localStorage` (or IndexedDB for more headroom), accessed through a small data-access module so a backend/sync layer can replace it later **without touching the UI**. No auth needed initially.
- Keep the **color palette centralized** (see the `C` object in the prototype) so it can be retuned in one place.

## Data model
Persist all weeks forever, keyed by the **ISO Monday date** of the week (`yyyy-mm-dd`). Nothing is ever deleted.

```
Task = {
  id, text, done, carried, claimedDay,         // core
  subtasks: Subtask[], createdAt,
  priority, type, deadline, notes,              // reserved for future — keep in schema
  originId, originKey, carriedAway, checkedAway // carry-over bookkeeping
}
Subtask = { id, text, done, claimedDay }
```

## Core behaviors (match prototype exactly)
- **Weekly list is the source of truth.** Day columns are *views* filtered by `claimedDay`. Checking a task anywhere updates it everywhere.
- **Add (Notes-style):** every list ends with a persistent empty slot. Type + Enter creates the task and keeps focus for rapid entry. A `+` button also focuses that slot. (Implementation note: keep rows as inline render output, not nested components, or the input loses focus on each keystroke.)
- **Done tasks float to the bottom** of each list automatically when visible; strikethrough + muted + filled mint checkbox. Header has a **Hide/show done** toggle.
- **Week navigation:** prev/next arrows + a "This week" shortcut.

## Subtasks
- **Visible by default**, slightly indented, **same text size** as the parent.
- Parent **auto-checks** when all its subtasks are done.
- A subtask can be **claimed to its own day** independently of its parent. On a day it renders with the **parent name in small italic above it**.
- Subtasks **count as individual units** toward a day's progress bar and total.

## Sorting
- **Weekly default:** grouped by assigned day (Mon→Sun), unassigned tasks last; within a day, first-claimed on top.
- **Manual reorder** within the weekly list via drag (overrides default order).
- Future: additional sort options (priority, type).

## Drag & drop
- Task: weekly → day (assign), day → day (move), day/weekly → weekly panel (un-assign).
- Drag a **whole task** (subtasks ride along) **or a single subtask** to a day.
- Reorder within the weekly list by dropping on another task. Positional reorder *within* a day is **not required for v1** (dropping into a day appends).

## Carried-over tasks
- In the week they currently live in, carried tasks look **identical to normal tasks** — no color, no label. The `carried` flag + origin info are still stored.
- In the **origin (past) week**, the original shows a small grey **"Carried over"** label. If the forward copy is later completed, the original instead shows **"Checked [date]"** in a distinct style (italic mint — *not* strikethrough, to distinguish from tasks completed within that week).
- **Generalize "checked elsewhere" to multi-hop:** a task may be carried week → week → week. Completing it anywhere should resolve back to wherever it was actually done, and each prior instance should reflect that it moved on / was eventually checked. *(The prototype only models a single hop.)*

## Carry-over ritual — the real trigger (prototype fakes this)
The prototype just auto-opens the modal on load. Real behavior:
- A "week" begins **Monday 05:00 local time.**
- The carry-over screen appears the **first time the app is opened in a new week** (the first open at/after that Monday-5am boundary for which carry-over hasn't run yet).
- **Leftovers** = unchecked, not-already-carried tasks from the **last week the user actually opened the app** — not necessarily the previous calendar week. If the app isn't opened for over a week, the leftovers come from that last-opened week (they accumulate across skipped weeks).
- Tasks in the modal default to **unchecked**; the user **checks the ones to carry forward.** On confirm: checked → new carried tasks in the current week; unchecked → remain as leftovers in their week, available later.
- A header **"Carry-over" button** reopens the screen showing the **remaining leftovers** (the not-yet-carried ones) so they can be pulled in anytime.

## Layout & responsiveness (match prototype)
- **Header:** title, week nav, "This week", Carry-over button, Hide/show done.
- **Weekly panel** (white card) on top: title, `done/total` counter next to a progress bar, prominent **Add task** button. **No internal scroll — the whole page scrolls.**
- **Day columns** below (white cards). Today's column is **wider** in multi-column modes, marked **"TODAY Mon 8"** with a thin mint top edge; other day names are slightly greyed. **Past days are slightly greyed.**
- **Collapsible days** (chevron): collapsing keeps the header + progress bar visible. **Auto-collapse only past + fully-complete days, and only in single-column mode.** Today/future/empty days stay expanded by default. Manual collapse works everywhere.
- Each day has a **small progress bar** (no counter).
- Day cards have a **minimum height** and **equal heights** (expanded cards in a row match the tallest; collapsed cards stay compact).
- **Breakpoints** (use `minmax(0,1fr)` tracks so columns shrink instead of overflowing):
  - ≥ 1340px → **6 columns**, Sat+Sun stacked in the 6th.
  - ≥ 900px → **5 columns** Mon–Fri, weekend in an **accordion** below (auto-expands when it has content).
  - < 900px → **single column** (no two-column step).

## Colors
Cool soft pastel, all in one `C` object: page bg `#F4F6FB`, white cards, mint `#92CBBA` for done/progress, soft-blue `#8FB4E8` for the primary Add action, periwinkle `#AAB5E8` reserved, plus greys for structure. The user may tweak these directly.

## Future features (don't build, don't make impossible)
- Task properties: priority/urgency, type (5-min vs big project) — sortable.
- Deadline field; task detail popup (created date, checked date, deadline, notes).
- Events / notes on day columns, separate from tasks.
- Possible backend + sync for multi-device.

## Suggested v1 scope
Get the core working **end-to-end with persistence**: weekly list + day columns + inline add + check (syncing) + drag & drop + the real carry-over trigger + browsing past weeks. Then layer the future features on top.
