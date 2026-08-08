import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { createFlag } from './routes/flags.js';
import { getOrCreateRecordingForUpload } from './routes/recordings.js';

const BASE_DIR = process.cwd();
export const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
export const RESULTS_DIR = path.join(BASE_DIR, 'results');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

export const activeTasks = {};

// How far apart two detections must be to count as separate sightings.
const SIGHTING_GAP_SECONDS = Number(process.env.SIGHTING_GAP_SECONDS || 3);

// Collapse a run of per-frame detections into distinct sightings. Returns the
// start timestamp of each run and the peak count observed during it.
export function coalesceEvents(events = [], gap = SIGHTING_GAP_SECONDS) {
  const sorted = [...events]
    .filter((e) => e && Number.isFinite(e.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  const out = [];
  for (const ev of sorted) {
    const last = out[out.length - 1];
    if (last && ev.timestamp - last.last_timestamp < gap) {
      last.last_timestamp = ev.timestamp;
      last.count = Math.max(last.count, ev.count || 0);
      last.frames += 1;
    } else {
      out.push({
        timestamp: ev.timestamp,
        last_timestamp: ev.timestamp,
        count: ev.count || 0,
        frames: 1
      });
    }
  }
  return out;
}

export function runDetectionTask(videoId, inputPath, outputPath, modelName = 'dolphin', confidence = 0.15, vesselId = null) {
  activeTasks[videoId] = {
    status: 'starting',
    progress: 0,
    message: 'Initializing dolphin detection model...',
    current_count: 0
  };

  // The directory to put on sys.path — whichever one actually holds
  // detector.py. Resolved rather than hardcoded because it has moved three
  // times already (PythonScript/, PythonScript/backend/, and a folder outside
  // the checkout on the original author's machine). DETECTOR_ROOT wins if it
  // ends up somewhere else again.
  const candidateDirs = [
    process.env.DETECTOR_ROOT,
    path.resolve(BASE_DIR, '..', 'PythonScript'),
    path.resolve(BASE_DIR, '..', 'PythonScript', 'backend'),
    path.resolve(BASE_DIR, '..'),
  ].filter(Boolean);

  const pythonScriptDir = candidateDirs.find((dir) =>
    fs.existsSync(path.join(dir, 'detector.py'))
  );

  // Fail immediately and name every path tried. Without this the import error
  // surfaces as an opaque exit code and the task hangs at 'starting'.
  if (!pythonScriptDir) {
    activeTasks[videoId] = {
      status: 'failed',
      progress: 100,
      message:
        'detector.py was not found. Looked in: ' +
        candidateDirs.join(', ') +
        '. Set DETECTOR_ROOT to the directory that contains it.',
      current_count: 0
    };
    return;
  }
  
  // Python script execution to run detector.py
  const pythonScript = `
import sys
import json
import os
sys.path.insert(0, r"${pythonScriptDir}")

from detector import process_video_frames

def progress_cb(pct, status, msg, current_count=0):
    print(json.dumps({
        "type": "progress",
        "percent": pct,
        "status": status,
        "message": msg,
        "current_count": current_count
    }), flush=True)

try:
    meta = process_video_frames(
        input_path=r"${inputPath}",
        output_path=r"${outputPath}",
        model_name=r"${modelName}",
        confidence=${confidence},
        progress_callback=progress_cb
    )
    print(json.dumps({"type": "result", "meta": meta}), flush=True)
except Exception as e:
    import traceback
    traceback.print_exc()
    print(json.dumps({"type": "error", "error": str(e)}), flush=True)
sys.exit(0)
`;

  // macOS and most modern distros ship `python3` and no bare `python`, so
  // spawning 'python' fails with ENOENT before the detector is ever reached.
  // PYTHON_BIN points at the venv interpreter that has the model deps.
  const interpreter = process.env.PYTHON_BIN || 'python3';
  const pyProc = spawn(interpreter, ['-c', pythonScript], { cwd: pythonScriptDir });

  pyProc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed.type === 'progress') {
          activeTasks[videoId].status = parsed.status;
          activeTasks[videoId].progress = parsed.percent;
          activeTasks[videoId].message = parsed.message;
          activeTasks[videoId].current_count = parsed.current_count;
        } else if (parsed.type === 'result') {
          const meta = parsed.meta;
          const metaPath = path.join(RESULTS_DIR, `${videoId}_meta.json`);
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

          activeTasks[videoId].status = 'completed';
          activeTasks[videoId].progress = 100;
          activeTasks[videoId].message = 'Dolphin detection completed!';
          activeTasks[videoId].result = meta;

          // The detector reports a hit per sampled frame, so one continuous
          // sighting arrives as a run of events a fraction of a second apart.
          // Raising a flag for each would put a dozen near-identical items in
          // the queue for a single dolphin, and a reviewer would have to
          // determine every one. Coalesce runs into sightings instead: group
          // events less than SIGHTING_GAP_SECONDS apart, keep the peak count,
          // and anchor the flag at the start of the run. Nothing is dropped —
          // distinct sightings all still produce a flag.
          const sightings = coalesceEvents(meta.dolphin_events);

          if (meta.has_dolphin && sightings.length > 0) {
            getOrCreateRecordingForUpload({
              videoId,
              mediaUrl: `/uploads/${path.basename(inputPath)}`,
              processedMediaUrl: `/results/${path.basename(outputPath)}`,
              vesselId,
              durationSeconds: meta.duration_seconds
            })
              .then(async (recording) => {
                for (const ev of sightings) {
                  await createFlag({
                    recording_id: recording.id,
                    flag_type: 'Bycatch species',
                    severity: 'High',
                    timestamp_seconds: Math.round(ev.timestamp),
                    description:
                      `Automated detection: ${ev.count} dolphin over ` +
                      `${(ev.last_timestamp - ev.timestamp).toFixed(1)}s ` +
                      `from ${Math.round(ev.timestamp)}s ` +
                      `(${ev.frames} frame${ev.frames === 1 ? '' : 's'}, ` +
                      `confidence threshold ${confidence})`,
                    camera_id: 1,
                    raised_by: 'detector'
                  });
                }
                console.log(
                  `✓ Raised ${sightings.length} flag(s) from ` +
                    `${meta.dolphin_events.length} detections on recording ` +
                    `${recording.id} for ${videoId}`
                );
              })
              .catch((err) => console.error('Error raising detection flags:', err));
          }
        } else if (parsed.type === 'error') {
          activeTasks[videoId].status = 'failed';
          activeTasks[videoId].progress = 100;
          activeTasks[videoId].message = `Detection error: ${parsed.error}`;
        }
      } catch (e) {
        // Non-JSON stdout
        console.log(`[Python Detector]: ${line}`);
      }
    }
  });

  pyProc.stderr.on('data', (data) => {
    console.error(`[Python Detector STDERR]: ${data.toString()}`);
  });

  pyProc.on('error', (err) => {
    activeTasks[videoId].status = 'failed';
    activeTasks[videoId].progress = 100;
    activeTasks[videoId].message =
      err.code === 'ENOENT'
        ? `Python interpreter '${interpreter}' was not found. Install Python 3, or set PYTHON_BIN to its path.`
        : `Failed to start detector process: ${err.message}`;
  });

  // A non-zero exit with no JSON result means the detector itself failed —
  // most often an ImportError because backend/detector.py is absent. Without
  // this the task would sit at 'starting' forever and the UI would spin.
  pyProc.on('close', (code) => {
    const task = activeTasks[videoId];
    if (!task || task.status === 'completed' || task.status === 'failed') return;
    task.status = 'failed';
    task.progress = 100;
    task.message = `Detector exited with code ${code} before returning a result. Check the backend log.`;
  });
}
