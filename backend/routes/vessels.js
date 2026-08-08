import { all, get, run } from '../database.js';

export function getVessels() {
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
      ORDER BY v.last_ais_ping DESC
    `)
      .then(resolve)
      .catch(reject);
  });
}

export function getVesselById(id) {
  return new Promise((resolve, reject) => {
    get(`
      SELECT 
        v.*,
        (SELECT COUNT(*) FROM recordings WHERE vessel_id = v.id) as recordings_count,
        (SELECT COUNT(*) FROM flags f 
         JOIN recordings r ON f.recording_id = r.id 
         WHERE r.vessel_id = v.id AND f.resolved = 0) as unresolved_flags
      FROM vessels v
      WHERE v.id = ?
    `, [id])
      .then(resolve)
      .catch(reject);
  });
}

export function createVessel(data) {
  return run(
    'INSERT INTO vessels (name, imo, licence, gear, captain, crew_count, status, last_ais_ping) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [data.name, data.imo, data.licence, data.gear, data.captain || null, data.crew_count || null, data.status || 'active']
  ).then(result => getVesselById(result.id));
}

export function updateVessel(id, data) {
  return new Promise((resolve, reject) => {
    run(`
      UPDATE vessels
      SET 
        name = COALESCE(?, name),
        status = COALESCE(?, status),
        captain = COALESCE(?, captain),
        crew_count = COALESCE(?, crew_count),
        last_ais_ping = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [data.name, data.status, data.captain, data.crew_count, id])
      .then(() => getVesselById(id))
      .catch(reject);
  });
}

export default {
  getVessels,
  getVesselById,
  createVessel,
  updateVessel
};
