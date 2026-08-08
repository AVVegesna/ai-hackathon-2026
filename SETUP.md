# Setup

Three parts: the API, the frontend, and the Python detection model. The first
two are needed to run the portal; the third is only needed to run detection over
uploaded footage.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.x | Pinned in `.tool-versions` |
| Python | **3.11 or 3.12** | Detection only. **Not 3.13+** — see below |
| ffmpeg | any recent | Optional; supplied by `imageio-ffmpeg` |

> **Python version matters.** `torch` and `ultralytics` publish no wheels for
> Python 3.13 or 3.14, so `pip install` fails outright on those versions. If the
> system Python is newer, create a 3.12 environment as shown below — do not try
> to install the requirements into it.

## 1. API

```sh
cd backend
npm install
npm run seed     # creates and populates backend/data/portal.db
npm start        # http://localhost:3000
```

`npm run seed` is safe to re-run; it clears and repopulates the tables.

## 2. Frontend

```sh
cd frontend
npm install
npm run dev      # http://localhost:5173
```

The dev server proxies `/api`, `/uploads` and `/results` to the API on port
3000, so both must be running.

## 3. Detection model (optional)

The detector is `PythonScript/detector.py`, driven as a subprocess by
`backend/detectionService.js`. It needs its own Python environment.

### With uv (fastest — fetches Python 3.12 for you)

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r PythonScript/requirements.txt
```

### With a system Python 3.12

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r PythonScript/requirements.txt
```

### Point the API at that interpreter

The API spawns `python3` from `PATH` unless told otherwise, and that is almost
certainly not the interpreter holding these packages. Set `PYTHON_BIN` to the
venv's Python:

```sh
cd backend
PYTHON_BIN="$(cd .. && pwd)/.venv/bin/python" npm start
```

Or put it in `backend/.env` so it applies every run:

```
PYTHON_BIN=/absolute/path/to/repo/.venv/bin/python
```

### Model weights

`detector.py` downloads its weights on first run into `PythonScript/weights/`
and `PythonScript/models/`. Both are gitignored — expect the first detection to
take noticeably longer while they download.

## Environment variables

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | API port |
| `PYTHON_BIN` | `python3` | Interpreter used to run the detector |
| `DETECTOR_ROOT` | auto-detected | Directory containing `detector.py`, if it is not in one of the usual places |
| `REVIEW_WINDOW_DAYS` | `7` | Statutory review window used to set flag deadlines |

## Verifying detection works

```sh
# Upload a clip through the Ingest page, then check the backend log for:
#   ✓ Raised N flag(s) on recording <id> for <videoId>
```

Common failures and what they mean:

| Message | Cause |
|---|---|
| `Python interpreter 'python3' was not found` | No `python3` on `PATH`; set `PYTHON_BIN` |
| `detector.py was not found. Looked in: …` | Detector missing or moved; set `DETECTOR_ROOT` |
| `No module named 'cv2'` / `'ultralytics'` / `'clip'` | Requirements not installed in the interpreter `PYTHON_BIN` points at |
| `Detector exited with code 1 …` | Check the backend log for the Python traceback |
