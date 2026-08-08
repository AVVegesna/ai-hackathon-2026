import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { initializeDatabase, migrateDatabase } from './database.js';
import { getVessels, getVesselById, updateVessel, createVessel } from './routes/vessels.js';
import { getRecordings, getRecordingsByVessel, createRecording } from './routes/recordings.js';
import { getFlags, getFlagsByRecording, getFlagById, createFlag, resolveFlag } from './routes/flags.js';
import { getQueue, getQueueStats, getQueueFacets } from './routes/stats.js';
import { getReviewsByVessel, createReview } from './routes/reviews.js';
import { getAudit } from './routes/audit.js';
import { getFleetOverview } from './routes/fleet.js';
import { UPLOADS_DIR, RESULTS_DIR, activeTasks, runDetectionTask } from './detectionService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve Static Uploads and Results
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/results', express.static(RESULTS_DIR));

// Serve Frontend Static Files
const FRONTEND_DIST = path.join(path.resolve(process.cwd(), '..'), 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
}

// Configure Multer for Video Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const videoId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${videoId}${ext}`);
  }
});
const upload = multer({ storage });

// Initialize database
initializeDatabase();
// Tables are created inside a db.serialize() block; give them a tick to land
// before the additive column migrations run against them.
setTimeout(() => {
  migrateDatabase().catch((err) => console.error('Migration failed:', err));
}, 300);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Review queue — the primary work surface. Filtered, sorted and paginated
// server-side so the client never pulls the whole flag table to narrow it.
// ---------------------------------------------------------------------------
app.get('/api/queue', async (req, res) => {
  try {
    res.json(await getQueue(req.query));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/queue/stats', async (req, res) => {
  try {
    res.json(await getQueueStats());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/queue/facets', async (req, res) => {
  try {
    res.json(await getQueueFacets());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/flags/:id', async (req, res) => {
  try {
    const flag = await getFlagById(req.params.id);
    if (!flag) return res.status(404).json({ error: 'Flag not found' });
    res.json(flag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reviews — append-only vessel-level determinations
app.get('/api/vessels/:vesselId/reviews', async (req, res) => {
  try {
    res.json(await getReviewsByVessel(req.params.vesselId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    if (!req.body.vessel_id) return res.status(400).json({ error: 'vessel_id is required' });
    res.status(201).json(await createReview(req.body));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Fleet overview — map positions and aggregate figures
app.get('/api/fleet/overview', async (req, res) => {
  try {
    res.json(await getFleetOverview());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audit trail — read-only by design
app.get('/api/audit', async (req, res) => {
  try {
    res.json(await getAudit(req.query));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Video Upload & Dolphin Detection API Endpoints
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }
  const filename = req.file.filename;
  const videoId = path.parse(filename).name;

  res.json({
    video_id: videoId,
    original_filename: req.file.originalname,
    filename: filename,
    url: `/uploads/${filename}`
  });
});

app.post('/api/detect/:videoId', (req, res) => {
  const videoId = req.params.videoId;
  const modelName = req.body.model_name || 'dolphin';
  const confidence = parseFloat(req.body.confidence || '0.25');

  let videoFile = null;
  const files = fs.readdirSync(UPLOADS_DIR);
  for (const f of files) {
    if (f.startsWith(videoId)) {
      videoFile = f;
      break;
    }
  }

  if (!videoFile) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  const inputPath = path.join(UPLOADS_DIR, videoFile);
  const outputFilename = `${videoId}_processed.mp4`;
  const outputPath = path.join(RESULTS_DIR, outputFilename);

  const vesselId = req.body.vessel_id ? Number(req.body.vessel_id) : null;
  runDetectionTask(videoId, inputPath, outputPath, modelName, confidence, vesselId);

  res.json({ status: 'started', video_id: videoId });
});

app.get('/api/status/:videoId', (req, res) => {
  const videoId = req.params.videoId;

  if (activeTasks[videoId]) {
    return res.json(activeTasks[videoId]);
  }

  const metaPath = path.join(RESULTS_DIR, `${videoId}_meta.json`);
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      return res.json({
        status: 'completed',
        progress: 100,
        message: 'Processing completed!',
        result: meta
      });
    } catch (e) {}
  }

  res.json({
    status: 'idle',
    progress: 0,
    message: 'Video uploaded, waiting to start detection.'
  });
});

app.get('/api/results/:videoId', (req, res) => {
  const videoId = req.params.videoId;
  const metaPath = path.join(RESULTS_DIR, `${videoId}_meta.json`);

  if (!fs.existsSync(metaPath)) {
    return res.status(404).json({ error: 'Results not ready or not found' });
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const processedVideo = `${videoId}_processed.mp4`;
    meta.processed_video_url = `/results/${processedVideo}`;
    res.json(meta);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read metadata results' });
  }
});

app.get('/api/videos', (req, res) => {
  const videos = [];
  if (!fs.existsSync(UPLOADS_DIR)) return res.json(videos);

  const files = fs.readdirSync(UPLOADS_DIR);
  for (const filename of files) {
    const videoId = path.parse(filename).name;
    const metaPath = path.join(RESULTS_DIR, `${videoId}_meta.json`);
    const hasMeta = fs.existsSync(metaPath);

    let status = 'uploaded';
    let hasDolphin = false;
    let peakDolphinCount = 0;

    if (activeTasks[videoId]) {
      status = activeTasks[videoId].status;
      if (activeTasks[videoId].result) {
        hasDolphin = activeTasks[videoId].result.has_dolphin || false;
        peakDolphinCount = activeTasks[videoId].result.peak_dolphin_count || 0;
      }
    } else if (hasMeta) {
      status = 'completed';
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        hasDolphin = meta.has_dolphin || false;
        peakDolphinCount = meta.peak_dolphin_count || 0;
      } catch (e) {}
    }

    videos.append ? null : videos.push({
      video_id: videoId,
      filename: filename,
      url: `/uploads/${filename}`,
      status: status,
      has_results: hasMeta,
      has_dolphin: hasDolphin,
      peak_dolphin_count: peakDolphinCount
    });
  }

  res.json(videos);
});

// Vessels endpoints
app.get('/api/vessels', async (req, res) => {
  try {
    const vessels = await getVessels();
    res.json(vessels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vessels/:id', async (req, res) => {
  try {
    const vessel = await getVesselById(req.params.id);
    if (!vessel) return res.status(404).json({ error: 'Vessel not found' });
    res.json(vessel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vessels', async (req, res) => {
  try {
    const vessel = await createVessel(req.body);
    res.status(201).json(vessel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vessels/:id', async (req, res) => {
  try {
    const vessel = await updateVessel(req.params.id, req.body);
    if (!vessel) return res.status(404).json({ error: 'Vessel not found' });
    res.json(vessel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recordings endpoints
app.get('/api/recordings', async (req, res) => {
  try {
    const recordings = await getRecordings();
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vessels/:vesselId/recordings', async (req, res) => {
  try {
    const recordings = await getRecordingsByVessel(req.params.vesselId);
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recordings', async (req, res) => {
  try {
    const recording = await createRecording(req.body);
    res.status(201).json(recording);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Flags endpoints
app.get('/api/flags', async (req, res) => {
  try {
    const flags = await getFlags();
    res.json(flags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/recordings/:recordingId/flags', async (req, res) => {
  try {
    const flags = await getFlagsByRecording(req.params.recordingId);
    res.json(flags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/flags', async (req, res) => {
  try {
    const flag = await createFlag(req.body);
    res.status(201).json(flag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/flags/:id/resolve', async (req, res) => {
  try {
    const flag = await resolveFlag(req.params.id, req.body);
    if (!flag) return res.status(404).json({ error: 'Flag not found' });
    res.json(flag);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// SPA Fallback to index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/results')) {
    return next();
  }
  const indexFile = path.join(FRONTEND_DIST, 'index.html');
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Express.js Fisheries Portal API running on http://localhost:${PORT}`);
  console.log(`✓ Web Portal & App available at http://localhost:${PORT}`);
  console.log(`✓ API health check at http://localhost:${PORT}/api/health`);
});


