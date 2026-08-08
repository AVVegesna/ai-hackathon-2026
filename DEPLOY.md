# Deploying to Render

The portal deploys as **one Docker web service**. A single Express process serves
the built React bundle, the JSON API, and uploaded media.

**Detection is off by default.** The deployed image is Node-only: 375MB, builds in
about a minute, runs on the **free** plan. Upload and playback work; the app reports that
detection was **not run**, rather than reporting a clean result it never computed.
Turning the detector on costs a 3.76GB image and a 4GB plan — see
[Turning detection on](#turning-detection-on).

## Deploy

1. Push this branch to GitHub.
2. Render Dashboard → **New** → **Blueprint** → select the repo.
3. Render reads [`render.yaml`](render.yaml) and creates the `fisheries-portal`
   service. Click **Apply**.

Build takes about a minute. `autoDeploy` is off in the blueprint, so pushes don't
redeploy on their own — flip it to `true` in the dashboard if you want that.

## How "detection off" behaves

`DETECTION_ENABLED=false` doesn't hide the feature, it tells the truth about it:

| Endpoint | Response |
|---|---|
| `GET /api/config` | `{"detection_enabled": false, "detection_message": "…not enabled in this deployment."}` |
| `POST /api/detect/:id` | `503` with that message — no silent no-op |
| `GET /api/status/:id` | `{"status": "unavailable", "message": "…"}` |
| `GET /api/videos` | each video carries `analysed: false` |

`analysed` is the field that matters. It separates *"the model looked and found
nothing"* from *"nothing has looked at this yet"* — without it, `has_dolphin:
false` reads as a clean result on footage nobody examined. The UI should read
`/api/config` and hide the detection controls rather than offer an action that
503s.

Upload, storage, and playback all still work, so the demo keeps its full shape.

## Turning detection on

Two things have to change together — the image needs the detector installed, and
the plan needs the memory for it:

```sh
docker build --build-arg INSTALL_DETECTOR=true -t fisheries-portal:detector .
```

`DETECTION_ENABLED` defaults to whatever `INSTALL_DETECTOR` was, so a detector
image enables itself and a lean image can't pretend to have a model.

On Render: `plan: pro` in `render.yaml`, and the build arg. Render blueprints
don't expose Docker build args, so set it on the service in the dashboard
(**Settings → Docker Build Arguments**) or keep a separate Dockerfile.

**Why 4GB.** Measured on this image under a 1.9GB cap:

- Loading the detector — YOLO-World plus the CLIP text encoder `set_classes`
  requires — peaks at **1.61GB before a single frame is decoded**.
- A detection run is **OOM-killed** at that cap even on a 320×240 2-second clip.
  Fixed model overhead, not something short clips avoid.

So `free`/`starter` (512MB) and `standard` (2GB) all fail at the detection step.
The frame loop streams rather than buffering, so longer footage costs time, not
memory. 4GB is a sized estimate, not a measurement — the local Docker VM caps at
1.91GB, so 2GB is *proven* insufficient while 4GB is 1.61GB of model plus
inference tensors and the ffmpeg subprocess. Watch the first real run in Render's
metrics.

Detection on shared CPU is slow — budget a couple of minutes per minute of
footage, and demo with short clips.

## What is configurable

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `10000` | Render sets this; the server honours it. |
| `HOST` | `0.0.0.0` | Bind address. |
| `DATA_DIR` | `backend/data` | Holds `portal.db`. |
| `UPLOADS_DIR` | `backend/uploads` | Raw uploaded footage. |
| `RESULTS_DIR` | `backend/results` | Annotated video and detection metadata. |
| `DB_PATH` | `$DATA_DIR/portal.db` | SQLite file location. |
| `DETECTION_ENABLED` | follows `INSTALL_DETECTOR` | `false` reports detection as not run instead of running the model. |
| `PYTHON_BIN` | auto-detected | Detector interpreter. The detector image sets `/opt/venv/bin/python`. |
| `SEED_ON_START` | `true` | Seed demo data when the database is empty. `false` to leave it blank. |
| `VITE_API_BASE_URL` | _(empty)_ | Build-time. Leave empty for same-origin. Only needed if the frontend is hosted apart from the API. |

## State is ephemeral on free

Render container filesystems don't persist, and the free plan cannot mount a
disk. So on this setup:

- **The database is rebuilt on every boot.** `SEED_ON_START` seeds when the
  `vessels` table is empty, which without a disk is every time. That is what keeps
  the demo populated — no manual step.
- **Uploaded clips don't survive** a redeploy, a manual restart, or waking from the
  free plan's ~15 minute idle sleep. Re-upload during a demo.
- **First request after sleep is slow** — the container cold-starts.

### Keeping state

Add a disk and move to a paid plan. In `render.yaml`:

```yaml
    plan: starter
    disk:
      name: portal-data
      mountPath: /var/data
      sizeGB: 1
```

No env changes needed — `DATA_DIR`, `UPLOADS_DIR` and `RESULTS_DIR` already point
at `/var/data`, so the mount just starts persisting what is already written there.
Two things follow: a disk pins the service to one instance (fine — SQLite and the
in-memory `activeTasks` registry both assume a single process), and uploaded video
accumulates with nothing pruning it.

With a disk, seeding stops firing on every boot and a redeploy keeps whatever is
already there. `npm run seed` by hand stays destructive — it clears the tables
first.

## Before you hand out the URL

Two things this repo does not currently do, left as-is because changing them is a
product decision rather than a deployment one. Both matter the moment the service
has a public address:

- **No authentication.** Every route, including upload and the audit data, is open
  to anyone with the URL. Render has no built-in access control on web services.
- **No upload size limit.** `multer` is configured without `limits`, so a single
  large file can fill the container's filesystem and take the service down with
  it. Nothing prunes old uploads either.

For a hackathon demo behind a URL you don't publish, both are fine. For anything
else, fix them before sharing.

## Detector weights

The image pre-downloads `yolov8s-worldv2.pt` (26MB) and the CLIP text encoder that
YOLO-World needs for `set_classes` (354MB) at build time, so the first detection
request doesn't stall on a download. The build log ends with either
`✓ detector weights baked in` or a warning — check which.

[`docker/prefetch-weights.py`](docker/prefetch-weights.py) fetches bytes only and
deliberately never instantiates the model: loading it costs ~1.7GB and OOM-kills a
constrained builder. The step is best-effort, so a build without network still
succeeds and falls back to downloading on first use.

There is one trap worth knowing about, because it is invisible until it costs you
354MB per deploy. Ultralytics loads CLIP from its own `WEIGHTS_DIR` setting, which
defaults to the **relative** path `weights` — so the encoder normally lands in
whatever the current working directory happens to be, and on an ephemeral
filesystem it is re-downloaded every deploy. (The stray `weights/clip/` directory
in this repo is exactly that, from a local run.) The image therefore pins
`weights_dir` to an absolute path in an Ultralytics settings file baked in at
build time, and prefetches into precisely that directory. Verified: the model
loads with `--network none`.

Weights are gitignored, so they are never committed — the image fetches its own.

## Verifying a deploy

```sh
curl https://<service>.onrender.com/api/health     # {"status":"ok",...}
curl https://<service>.onrender.com/api/vessels    # seeded vessel list
curl https://<service>.onrender.com/api/config     # detection_enabled: false
```

Then open the service URL — the fleet view should load and Upload should accept a
short clip and play it back.

The serving path (app, API, seeding onto the mounted disk, SPA deep links, and the
detection-off responses) is verified in this container. If you later enable the
detector, **the detection path itself is unverified** — the local Docker VM can't
allocate enough memory to run it, so the first upload-and-detect on Render is the
real test.

## Local Docker check

To reproduce the deployed container before pushing:

```sh
docker build -t fisheries-portal .
docker run --rm -p 10000:10000 -v fisheries-data:/var/data fisheries-portal
# http://localhost:10000
```

Verified on the lean image: config reports detection off, upload succeeds,
`POST /api/detect` returns 503 with the message, status reads `unavailable`,
and the app and API serve normally.

## Running without Docker

Local development is unchanged and needs no container:

```sh
cd backend  && npm install && npm start   # API  :3000
cd frontend && npm install && npm run dev # app  :5173
```

Node 22 is required — `.tool-versions` pins it, and Vite 5.4 will not run on
Node 16. Vite proxies `/api`, `/uploads`, and `/results` to port 3000 in dev.

Detection additionally needs a Python venv. Use **Python 3.11 or 3.12** — 3.13+
has no `torch`/`ultralytics` wheels:

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r PythonScript/requirements.txt
.venv/bin/pip install "clip @ git+https://github.com/ultralytics/CLIP.git"
```

The server finds `.venv/bin/python` automatically; set `PYTHON_BIN` to override.
Without a working interpreter the app still runs and an upload reports the
detector as unavailable rather than failing silently.
