import { all, get, run } from '../database.js';

export function getFlags(userId) {
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
      WHERE f.resolved = 0 AND v.user_id = ?
      ORDER BY f.created_at DESC
    `, [userId])
      .then(resolve)
      .catch(reject);
  });
}

export function getFlagsByRecording(recordingId, userId) {
  return new Promise((resolve, reject) => {
    all(`
      SELECT f.*
      FROM flags f
      JOIN recordings r ON f.recording_id = r.id
      JOIN vessels v ON r.vessel_id = v.id
      WHERE f.recording_id = ? AND v.user_id = ?
      ORDER BY timestamp_seconds ASC
    `, [recordingId, userId])
      .then(resolve)
      .catch(reject);
  });
}

export async function createFlag(data, userId) {
  const recording = await get(
    `SELECT r.id
     FROM recordings r
     JOIN vessels v ON r.vessel_id = v.id
     WHERE r.id = ? AND v.user_id = ?`,
    [data.recording_id, userId]
  );

  if (!recording) {
    throw new Error('Recording not found for this account');
  }

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
        WHERE f.id = ? AND v.user_id = ?
      `, [result.id, userId]))
      .then(resolve)
      .catch(reject);
  });
}

export function resolveFlag(id, data, userId) {
  return new Promise((resolve, reject) => {
    run(`
      UPDATE flags
      SET 
        resolved = 1,
        resolved_by = ?,
        resolution = ?,
        resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
      AND recording_id IN (
        SELECT r.id
        FROM recordings r
        JOIN vessels v ON r.vessel_id = v.id
        WHERE v.user_id = ?
      )
    `, [data.resolved_by, data.resolution, id, userId])
      .then(() => get(`
        SELECT 
          f.*,
          r.vessel_id,
          r.recording_date,
          v.name as vessel_name
        FROM flags f
        JOIN recordings r ON f.recording_id = r.id
        JOIN vessels v ON r.vessel_id = v.id
        WHERE f.id = ? AND v.user_id = ?
      `, [id, userId]))
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
