# Fisheries Monitoring Review Portal

A review tool for MPI fisheries compliance. Reviewers work a queue of flagged
events from vessel camera footage, watch the moment in question, and record a
determination that lands in an append-only audit trail. Automated detection over
uploaded footage proposes flags; a person decides every one of them.

## Getting started

**→ [SETUP.md](SETUP.md)** — install steps, environment variables, and how to
get the Python detection model running.

The short version:

```sh
cd backend  && npm install && npm run seed && npm start   # API  :3000
cd frontend && npm install && npm run dev                 # app  :5173
```

Detection needs **Python 3.11 or 3.12** and its own venv — 3.13+ has no
`torch`/`ultralytics` wheels. See [SETUP.md](SETUP.md#3-detection-model-optional).

Node 22, pinned in `.tool-versions`. The API seeds demo data on first start when
the database is empty.

Set `DETECTION_ENABLED=false` to run without the Python stack; everything except
detection still works, and the UI reports detection as not run rather than
implying a clean result.

## Screens

| Route | Purpose |
|---|---|
| `/queue` | Home. Open flags sorted by statutory deadline. Filters live in the URL, so a filtered queue is a shareable link. |
| `/review/:flagId` | Watch the footage with flags marked on the scrubber, multi-camera grid, and record a determination. Keyboard-driven — press `?` for shortcuts. |
| `/vessels` | Vessel roster and per-vessel records, history and prior determinations. |
| `/ingest` | Upload footage, set a detection confidence threshold, compare before/after, review proposed flags. |
| `/reports` | Audit trail with CSV export. |

## Layout

```
backend/       Express API + SQLite (schema and migrations in database.js)
frontend/      React + Vite. Routes in src/routes, styles in src/styles
PythonScript/  YOLO detection model driven as a subprocess by the API
design/        The Industry design system the UI is built on
```

## Design notes

`UI_OVERHAUL_PLAN.md` records the information architecture, the design-system
deviations (semantic severity colour, surface elevation), and the reasoning
behind them.

Two conventions worth knowing before changing the UI:

- **No invented figures.** Every number on screen traces to an API field. If it
  cannot be derived from the database, the UI says so rather than estimating.
- **Colour never carries meaning alone.** Severity pairs a tint with a text
  label and a distinct glyph, so it survives greyscale printing and
  colour-blind vision.
