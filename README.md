# Weekly Task Manager

A personal weekly task manager where **the week is the unit of work**. Tasks live in a weekly list (the source of truth) and can be assigned to individual days; unfinished tasks can be carried into the next week. Built to replace Apple Notes + manual weekly copy-paste.

- **`SPEC.md`** — full build spec (behavior, data model, layout, carry-over rules, future features).
- **`WeeklyTasks.jsx`** — the approved visual/interaction prototype. Match its look and feel; see the spec for what it fakes (persistence, real carry-over trigger, multi-hop history).

---

## Prerequisites

- **Node.js 18+** and npm (check with `node -v`).

## Getting started

```bash
# install dependencies
npm install

# start the local dev server (hot reload)
npm run dev
```

Then open the URL it prints (Vite defaults to http://localhost:5173).

## Scripts

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the dev server with hot reload          |
| `npm run build`   | Produce a production build in `dist/`         |
| `npm run preview` | Serve the production build locally to test it |

*(These assume a Vite + React scaffold, as recommended in `SPEC.md`. Adjust if the project ends up on a different setup.)*

## Suggested project layout

```
src/
  data/        # storage module (localStorage now; swappable for a backend later)
  lib/         # date/week helpers, sorting, carry-over logic
  components/  # WeeklyPanel, DayColumn, TaskRow, CarryOverModal, ...
  theme.js     # the color palette (single source of truth)
  App.jsx
SPEC.md
WeeklyTasks.jsx  # reference prototype
```

## Deploying to Vercel

The app is a static client-side build (no backend required), so deployment is straightforward.

**Option A — Git import (recommended):**
1. Push the repo to GitHub/GitLab/Bitbucket.
2. In the Vercel dashboard, **Add New → Project** and import the repo.
3. Vercel auto-detects Vite. Confirm: **Build Command** `npm run build`, **Output Directory** `dist`. Deploy.
4. Every push to the main branch redeploys automatically.

**Option B — Vercel CLI:**
```bash
npm i -g vercel
vercel        # first run links/creates the project (a preview deploy)
vercel --prod # promote to production
```

## Notes

- Data persists in the browser via `localStorage`, so it's **per-device** for now. Keep storage behind the `data/` module so a sync backend can be added later without touching the UI.
- Past weeks are never deleted — they remain browsable.
