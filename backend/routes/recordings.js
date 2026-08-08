import { all, get, run } from '../database.js';

export function getRecordings() {
  return new Promise((resolve, reject) => {
    all(`
      SELECT 
        r.*,
        v.name as vessel_name,
        (SELECT COUNT(*) FROM flags WHERE recording_id = r.id AND resolved = 0) as unresolved_flags
      FROM recordings r
      JOIN vessels v ON r.vessel_id = v.id
      ORDER BY r.recording_date DESC
    `)
      .then(resolve)
      .catch(reject);
  });
}

export function getRecordingsByVessel(vesselId) {
  return new Promise((resolve, reject) => {
    all(`
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM flags WHERE recording_id = r.id AND resolved = 0) as unresolved_flags
      FROM recordings r
      WHERE r.vessel_id = ?
      ORDER BY r.recording_date DESC
    `, [vesselId])
      .then(resolve)
      .catch(reject);
  });
}

export function createRecording(data) {
  return new Promise((resolve, reject) => {
    run(`
      INSERT INTO recordings (vessel_id, recording_date, start_time, end_time, duration_minutes, cameras_count, hauls_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.vessel_id,
      data.recording_date,
      data.start_time,
      data.end_time,
      data.duration_minutes,
      data.cameras_count || 4,
      data.hauls_count || 1,
      data.status || 'active'
    ])
      .then(result => get(`
        SELECT 
          r.*,
          v.name as vessel_name,
          (SELECT COUNT(*) FROM flags WHERE recording_id = r.id) as flags_count
        FROM recordings r
        JOIN vessels v ON r.vessel_id = v.id
        WHERE r.id = ?
      `, [result.id]))
      .then(resolve)
      .catch(reject);
  });
}

export default {
  getRecordings,
  getRecordingsByVessel,
  createRecording
};
