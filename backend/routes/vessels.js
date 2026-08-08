import { all, get, run } from '../database.js';

export function getVessels(userId) {
  return new Promise((resolve, reject) => {
    all(`
      SELECT 
        v.*,
        (SELECT COUNT(*) FROM recordings WHERE vessel_id = v.id) as recordings_count,
        (SELECT COUNT(*) FROM flags f 
         JOIN recordings r ON f.recording_id = r.id 
         WHERE r.vessel_id = v.id AND f.resolved = 0) as unresolved_flags,
        (SELECT MAX(recording_date) FROM recordings WHERE vessel_id = v.id) as last_recording_date
      FROM vessels v
      WHERE v.user_id = ?
      ORDER BY v.last_ais_ping DESC
    `, [userId])
      .then(resolve)
      .catch(reject);
  });
}

export function getVesselById(id, userId) {
  return new Promise((resolve, reject) => {
    get(`
      SELECT 
        v.*,
        (SELECT COUNT(*) FROM recordings WHERE vessel_id = v.id) as recordings_count,
        (SELECT COUNT(*) FROM flags f 
         JOIN recordings r ON f.recording_id = r.id 
         WHERE r.vessel_id = v.id AND f.resolved = 0) as unresolved_flags
      FROM vessels v
      WHERE v.id = ? AND v.user_id = ?
    `, [id, userId])
      .then(resolve)
      .catch(reject);
  });
}

export function createVessel(data, userId) {
  return run(
    'INSERT INTO vessels (user_id, name, imo, licence, gear, captain, crew_count, status, last_ais_ping) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [userId, data.name, data.imo, data.licence, data.gear, data.captain || null, data.crew_count || null, data.status || 'active']
  ).then(result => getVesselById(result.id, userId));
}

export function updateVessel(id, data, userId) {
  return new Promise((resolve, reject) => {
    run(`
      UPDATE vessels
      SET 
        name = COALESCE(?, name),
        status = COALESCE(?, status),
        captain = COALESCE(?, captain),
        crew_count = COALESCE(?, crew_count),
        last_ais_ping = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [data.name, data.status, data.captain, data.crew_count, id, userId])
      .then(() => getVesselById(id, userId))
      .catch(reject);
  });
}

export default {
  getVessels,
  getVesselById,
  createVessel,
  updateVessel
};
