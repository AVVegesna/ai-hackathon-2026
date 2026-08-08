import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { createFlag } from './routes/flags.js';

const BASE_DIR = process.cwd();
export const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
export const RESULTS_DIR = path.join(BASE_DIR, 'results');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

export const activeTasks = {};

export function runDetectionTask(videoId, inputPath, outputPath, modelName = 'dolphin', confidence = 0.15) {
  activeTasks[videoId] = {
    status: 'starting',
    progress: 0,
    message: 'Initializing dolphin detection model...',
    current_count: 0
  };

  // PythonScript folder containing detector.py (c:\Users\admin\Downloads\AI_Hackathon_2026\ai-hackathon-2026\PythonScript)
  const pythonScriptDir = path.resolve(BASE_DIR, '..', 'PythonScript');
  
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

  const pyProc = spawn('python', ['-c', pythonScript], { cwd: pythonScriptDir });

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

          // Auto-generate SQLite DB flags if dolphins or albatross were detected
          if (meta.has_dolphin && meta.dolphin_events && meta.dolphin_events.length > 0) {
            const sampledEvents = meta.dolphin_events.slice(0, 5);
            for (const ev of sampledEvents) {
              createFlag({
                recording_id: 1,
                flag_type: 'Bycatch species',
                severity: 'High',
                timestamp_seconds: Math.round(ev.timestamp),
                description: `Dolphin detected in video feed (Count: ${ev.count}) at ${Math.round(ev.timestamp)}s`,
                camera_id: 1
              }).catch(err => console.error('Error recording dolphin flag:', err));
            }
            console.log(`✓ Auto-generated ${sampledEvents.length} dolphin flags in SQLite database for ${videoId}`);
          }

          if (meta.has_albatross && meta.albatross_events && meta.albatross_events.length > 0) {
            const sampledEvents = meta.albatross_events.slice(0, 5);
            for (const ev of sampledEvents) {
              createFlag({
                recording_id: 1,
                flag_type: 'Bycatch species',
                severity: 'High',
                timestamp_seconds: Math.round(ev.timestamp),
                description: `Albatross / Seabird detected in video feed (Count: ${ev.count}) at ${Math.round(ev.timestamp)}s`,
                camera_id: 1
              }).catch(err => console.error('Error recording albatross flag:', err));
            }
            console.log(`✓ Auto-generated ${sampledEvents.length} albatross flags in SQLite database for ${videoId}`);
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
    activeTasks[videoId].message = `Failed to start detector process: ${err.message}`;
  });
}
