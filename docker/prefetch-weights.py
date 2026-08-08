"""Download detector weights into the image at build time.

Fetches bytes only — it must never instantiate YOLO-World or CLIP, because
loading them costs ~1.7GB of RAM and OOM-kills constrained build environments.
The goal is purely to avoid a ~380MB download on the first detection request.

The CLIP part is subtler than it looks. YOLO-World's `set_classes()` needs CLIP's
text encoder, and Ultralytics loads it with
`clip.load(..., download_root=WEIGHTS_DIR / "clip")`. `WEIGHTS_DIR` comes from
Ultralytics' own settings and defaults to the *relative* path `weights`, so
out of the box the 354MB encoder lands in whatever the current working directory
happens to be — and on a host with an ephemeral filesystem it is re-downloaded on
every single deploy. So we pin `weights_dir` to an absolute path in the settings
file baked into the image, then prefetch into exactly that directory.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, "/app/PythonScript")

# Must match ENV WEIGHTS_ROOT / YOLO_CONFIG_DIR in the Dockerfile.
WEIGHTS_ROOT = Path(os.environ.get("WEIGHTS_ROOT", "/app/.ultralytics/weights"))


def pin_ultralytics_weights_dir():
    """Persist an absolute weights_dir so runtime and build agree on the path."""
    from ultralytics.utils import SETTINGS, USER_CONFIG_DIR

    WEIGHTS_ROOT.mkdir(parents=True, exist_ok=True)
    SETTINGS["weights_dir"] = str(WEIGHTS_ROOT)
    print(f"ultralytics config dir: {USER_CONFIG_DIR}")
    print(f"pinned weights_dir -> {SETTINGS['weights_dir']}")

    # Ultralytics writes settings.json under <YOLO_CONFIG_DIR>/Ultralytics, and
    # silently falls back to a temp dir when that is not writable. A setting
    # stored under /tmp would not survive into the running container, so the
    # prefetch would be pointless — fail the step loudly instead.
    if not Path(USER_CONFIG_DIR).is_relative_to(os.environ["YOLO_CONFIG_DIR"]):
        raise RuntimeError(
            f"ultralytics settings landed in {USER_CONFIG_DIR}, outside "
            f"{os.environ['YOLO_CONFIG_DIR']} — the config dir is not writable, "
            "so the pinned weights_dir would not persist."
        )


def prefetch_yolo():
    # get_model_path downloads the .pt without loading it into memory.
    from detector import MODEL_CONFIGS, get_model_path

    for name in ("dolphin", "albatross"):
        if name in MODEL_CONFIGS:
            print(f"fetched {name} weights -> {get_model_path(name)}")


def prefetch_clip():
    import clip

    root = WEIGHTS_ROOT / "clip"
    root.mkdir(parents=True, exist_ok=True)
    url = clip.clip._MODELS["ViT-B/32"]
    # _download verifies the SHA256 in the URL and no-ops if already correct.
    path = clip.clip._download(url, str(root))
    print(f"fetched CLIP ViT-B/32 -> {path}")


pin_ultralytics_weights_dir()
prefetch_yolo()
prefetch_clip()
print("prefetched detector weights")
