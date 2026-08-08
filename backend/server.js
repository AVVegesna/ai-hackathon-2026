import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { initializeDatabase } from './database.js';
import authRouter from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';
import { getVessels, getVesselById, updateVessel, createVessel } from './routes/vessels.js';
import { getRecordings, getRecordingsByVessel, createRecording } from './routes/recordings.js';
import { getFlags, getFlagsByRecording, createFlag, resolveFlag } from './routes/flags.js';
import { getReviewByRecording, upsertReviewByRecording } from './routes/reviews.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database
initializeDatabase();

// Auth routes
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Vessels endpoints
app.get('/api/vessels', requireAuth, async (req, res) => {
  try {
    const vessels = await getVessels(req.user.id);
    res.json(vessels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vessels/:id', requireAuth, async (req, res) => {
  try {
    const vessel = await getVesselById(req.params.id, req.user.id);
    if (!vessel) return res.status(404).json({ error: 'Vessel not found' });
    res.json(vessel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vessels', requireAuth, async (req, res) => {
  try {
    const vessel = await createVessel(req.body, req.user.id);
    res.status(201).json(vessel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vessels/:id', requireAuth, async (req, res) => {
  try {
    const vessel = await updateVessel(req.params.id, req.body, req.user.id);
    if (!vessel) return res.status(404).json({ error: 'Vessel not found' });
    res.json(vessel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recordings endpoints
app.get('/api/recordings', requireAuth, async (req, res) => {
  try {
    const recordings = await getRecordings(req.user.id);
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vessels/:vesselId/recordings', requireAuth, async (req, res) => {
  try {
    const recordings = await getRecordingsByVessel(req.params.vesselId, req.user.id);
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recordings', requireAuth, async (req, res) => {
  try {
    const recording = await createRecording(req.body, req.user.id);
    res.status(201).json(recording);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Flags endpoints
app.get('/api/flags', requireAuth, async (req, res) => {
  try {
    const flags = await getFlags(req.user.id);
    res.json(flags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/recordings/:recordingId/flags', requireAuth, async (req, res) => {
  try {
    const flags = await getFlagsByRecording(req.params.recordingId, req.user.id);
    res.json(flags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/flags', requireAuth, async (req, res) => {
  try {
    const flag = await createFlag(req.body, req.user.id);
    res.status(201).json(flag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/flags/:id/resolve', requireAuth, async (req, res) => {
  try {
    const flag = await resolveFlag(req.params.id, req.body, req.user.id);
    if (!flag) return res.status(404).json({ error: 'Flag not found' });
    res.json(flag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reviews endpoints
app.get('/api/reviews/recordings/:recordingId', requireAuth, async (req, res) => {
  try {
    const review = await getReviewByRecording(req.params.recordingId, req.user.id);
    if (!review) {
      return res.json({ review: null });
    }
    res.json({ review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reviews/recordings/:recordingId', requireAuth, async (req, res) => {
  try {
    const review = await upsertReviewByRecording(req.params.recordingId, req.user, req.body || {});
    if (!review) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    res.json({ review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Fisheries Portal API running on http://localhost:${PORT}`);
  console.log(`✓ API docs available at http://localhost:${PORT}/api/health`);
});
