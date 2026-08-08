# Fisheries Monitoring Review Portal — single-container image.
#
# One Express process serves the built React app, the API, and uploaded media.
#
# By default the image is Node-only (~250MB, builds in about a minute) and the
# app reports detection as not run. The Python/YOLO detector is opt-in:
#
#   docker build --build-arg INSTALL_DETECTOR=true -t fisheries-portal:detector .
#
# Turning it on adds Python, CPU torch and ~380MB of weights — roughly 3.5GB of
# image — and needs ~4GB of RAM at runtime. Keep it off unless detection has to
# actually run, and set DETECTION_ENABLED=true to match.
ARG INSTALL_DETECTOR=false

# ---------------------------------------------------------------------------
# Stage 1 — build the React bundle
# ---------------------------------------------------------------------------
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — backend node_modules (sqlite3 may need to compile from source)
# ---------------------------------------------------------------------------
FROM node:22-slim AS backend-deps
WORKDIR /app/backend

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 3 — runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime
ARG INSTALL_DETECTOR

ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHON_BIN=/opt/venv/bin/python \
    YOLO_CONFIG_DIR=/app/.ultralytics \
    WEIGHTS_ROOT=/app/.ultralytics/weights

# Detector stack, installed only when opted in. libgl1 + libglib2.0-0 are
# opencv-python's runtime shared libraries, ffmpeg backs the video encode, and
# git is needed to install Ultralytics' CLIP fork. CPU-only torch keeps this
# ~2GB instead of ~6GB.
COPY PythonScript/requirements.txt /tmp/requirements.txt
RUN if [ "$INSTALL_DETECTOR" = "true" ]; then \
      set -eux; \
      apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-venv libgl1 libglib2.0-0 ffmpeg git ca-certificates; \
      rm -rf /var/lib/apt/lists/*; \
      python3 -m venv /opt/venv; \
      /opt/venv/bin/pip install --no-cache-dir --upgrade pip; \
      /opt/venv/bin/pip install --no-cache-dir \
        --index-url https://download.pytorch.org/whl/cpu torch torchvision; \
      /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt; \
      /opt/venv/bin/pip install --no-cache-dir \
        "clip @ git+https://github.com/ultralytics/CLIP.git"; \
    else \
      echo "skipping detector stack (INSTALL_DETECTOR=$INSTALL_DETECTOR)"; \
    fi

WORKDIR /app

COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
COPY PythonScript/ ./PythonScript/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Bake the detector weights and the CLIP text encoder into the image. Without
# this the first detection request stalls for minutes downloading ~380MB.
#
# Download only — deliberately never instantiates the model. Loading YOLO-World
# plus CLIP costs ~1.7GB of RAM, which OOM-kills constrained build environments.
# Best-effort: on failure the detector downloads on first use instead.
COPY docker/prefetch-weights.py /tmp/prefetch-weights.py
RUN if [ "$INSTALL_DETECTOR" = "true" ]; then \
      mkdir -p "$YOLO_CONFIG_DIR" "$WEIGHTS_ROOT"; \
      /opt/venv/bin/python /tmp/prefetch-weights.py \
        || echo "! weight prefetch failed — the detector will download on first use"; \
      if [ -f "$WEIGHTS_ROOT/clip/ViT-B-32.pt" ] \
         && [ -f /app/PythonScript/models/yolov8s-worldv2.pt ]; then \
        echo "✓ detector weights baked in — no download on first request"; \
      else \
        echo "! detector weights missing — first detection will download ~380MB"; \
      fi; \
    fi

# Detection follows what was actually installed, so a lean image reports
# "not run" by default rather than depending on the deploy setting the flag.
ENV DETECTION_ENABLED=${INSTALL_DETECTOR}

# Writable state. Override these to a mounted disk so uploads and the database
# survive a redeploy (see render.yaml).
ENV DATA_DIR=/var/data \
    UPLOADS_DIR=/var/data/uploads \
    RESULTS_DIR=/var/data/results
RUN mkdir -p /var/data/uploads /var/data/results

ENV PORT=10000
EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||10000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/backend
CMD ["node", "server.js"]
