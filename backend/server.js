import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { initializeDatabase } from './database.js';
import { getVessels, getVesselById, updateVessel, createVessel } from './routes/vessels.js';
import { getRecordings, getRecordingsByVessel, createRecording } from './routes/recordings.js';
import { getFlags, getFlagsByRecording, createFlag, resolveFlag } from './routes/flags.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database
initializeDatabase();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Fisheries Portal API running on http://localhost:${PORT}`);
  console.log(`✓ API docs available at http://localhost:${PORT}/api/health`);
});
