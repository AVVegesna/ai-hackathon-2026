import { all, get, run } from '../database.js';

export function getFlags() {
  return new Promise((resolve, reject) => {
    all(`
      SELECT 
        f.*,
        r.vessel_id,
        r.recording_date,
        v.name as vessel_name
      FROM flags f
      JOIN recordings r ON f.recording_id = r.id
      JOIN vessels v ON r.vessel_id = v.id
      WHERE f.resolved = 0
      ORDER BY f.created_at DESC
    `)
      .then(resolve)
      .catch(reject);
  });
}

export function getFlagsByRecording(recordingId) {
  return new Promise((resolve, reject) => {
    all(`
      SELECT *
      FROM flags
      WHERE recording_id = ?
      ORDER BY timestamp_seconds ASC
    `, [recordingId])
      .then(resolve)
      .catch(reject);
  });
}

export function createFlag(data) {
  return new Promise((resolve, reject) => {
    run(`
      INSERT INTO flags (recording_id, flag_type, severity, timestamp_seconds, description, camera_id, resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.recording_id,
      data.flag_type,
      data.severity || 'Medium',
      data.timestamp_seconds,
      data.description || null,
      data.camera_id || null,
      0
    ])
      .then(result => get(`
        SELECT 
          f.*,
          r.vessel_id,
          r.recording_date,
          v.name as vessel_name
        FROM flags f
        JOIN recordings r ON f.recording_id = r.id
        JOIN vessels v ON r.vessel_id = v.id
        WHERE f.id = ?
      `, [result.id]))
      .then(resolve)
      .catch(reject);
  });
}

export function resolveFlag(id, data) {
  return new Promise((resolve, reject) => {
    run(`
      UPDATE flags
      SET 
        resolved = 1,
        resolved_by = ?,
        resolution = ?,
        resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [data.resolved_by, data.resolution, id])
      .then(() => get(`
        SELECT 
          f.*,
          r.vessel_id,
          r.recording_date,
          v.name as vessel_name
        FROM flags f
        JOIN recordings r ON f.recording_id = r.id
        JOIN vessels v ON r.vessel_id = v.id
        WHERE f.id = ?
      `, [id]))
      .then(resolve)
      .catch(reject);
  });
}

export default {
  getFlags,
  getFlagsByRecording,
  createFlag,
  resolveFlag
};
