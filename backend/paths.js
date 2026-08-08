import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

// Resolve everything from this file's location rather than process.cwd(), so the
// server behaves the same whether it is started from backend/, the repo root, or
// a container WORKDIR.
const BACKEND_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(BACKEND_DIR, '..');
export const PYTHON_SCRIPT_DIR = path.join(PROJECT_ROOT, 'PythonScript');
export const FRONTEND_DIST = path.join(PROJECT_ROOT, 'frontend', 'dist');

// Writable state. On a host with an ephemeral filesystem (Render, Fly, Heroku)
// point these at a mounted disk so uploads and the database survive a redeploy.
const fromEnv = (name, fallback) =>
  process.env[name] ? path.resolve(process.env[name]) : fallback;

export const DATA_DIR = fromEnv('DATA_DIR', path.join(BACKEND_DIR, 'data'));
export const UPLOADS_DIR = fromEnv('UPLOADS_DIR', path.join(BACKEND_DIR, 'uploads'));
export const RESULTS_DIR = fromEnv('RESULTS_DIR', path.join(BACKEND_DIR, 'results'));
export const DB_PATH = fromEnv('DB_PATH', path.join(DATA_DIR, 'portal.db'));

export function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, RESULTS_DIR, path.dirname(DB_PATH)]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// The detector runs as a Python subprocess. Which interpreter that is differs by
// machine (venv, python3, py), so resolve it once at startup and report clearly
// if none of the candidates exist.
let cachedPython;
export function resolvePythonBin() {
  if (cachedPython !== undefined) return cachedPython;

  const candidates = process.env.PYTHON_BIN
    ? [process.env.PYTHON_BIN]
    : [
        path.join(PROJECT_ROOT, '.venv', 'bin', 'python'),
        path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe'),
        'python3',
        'python',
      ];

  for (const bin of candidates) {
    const probe = spawnSync(bin, ['--version'], { stdio: 'ignore' });
    if (!probe.error && probe.status === 0) {
      cachedPython = bin;
      return cachedPython;
    }
  }

  cachedPython = null;
  return cachedPython;
}
