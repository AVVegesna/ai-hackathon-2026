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

// An uploaded clip needs a recording row before anything can be flagged
// against it: the queue joins flags -> recordings -> vessels, so a flag whose
// recording does not exist is invisible everywhere in the UI. Detection used to
// hardcode recording_id 1, which stopped resolving the moment the database was
// re-seeded and silently dropped every detection it raised.
//
// Idempotent on media_url, so re-running detection over the same upload reuses
// the recording instead of creating a duplicate each time.
export async function getOrCreateRecordingForUpload({
  videoId,
  mediaUrl,
  processedMediaUrl,
  vesselId,
  durationSeconds
}) {
  const existing = await get(`SELECT * FROM recordings WHERE media_url = ?`, [mediaUrl]);
  if (existing) {
    // A re-run produces a fresh annotated render and may now be attributed to a
    // vessel, so refresh those on the existing row instead of leaving it stale.
    await run(
      `UPDATE recordings
          SET processed_media_url = COALESCE(?, processed_media_url),
              vessel_id = COALESCE(?, vessel_id)
        WHERE id = ?`,
      [processedMediaUrl || null, vesselId || null, existing.id]
    );
    return get(`SELECT * FROM recordings WHERE id = ?`, [existing.id]);
  }

  // Uploads carry no vessel of their own. Rather than attribute footage to an
  // arbitrary real vessel, park it against a clearly-labelled holding record
  // that a reviewer can see is unattributed.
  let vessel_id = vesselId;
  if (!vessel_id) {
    const holding = await get(`SELECT id FROM vessels WHERE imo = ?`, ['UNASSIGNED']);
    if (holding) {
      vessel_id = holding.id;
    } else {
      const created = await run(
        `INSERT INTO vessels (name, imo, licence, gear, captain, crew_count, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Unattributed uploads', 'UNASSIGNED', 'UNASSIGNED', 'Unknown', null, null, 'holding']
      );
      vessel_id = created.id;
    }
  }

  const minutes = durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : null;
  const { id } = await run(
    `INSERT INTO recordings
       (vessel_id, recording_date, start_time, end_time, duration_minutes,
        cameras_count, hauls_count, status, media_url, processed_media_url)
     VALUES (?, date('now'), time('now'), time('now'), ?, 1, 1, 'active', ?, ?)`,
    [vessel_id, minutes, mediaUrl, processedMediaUrl || null]
  );

  return get(`SELECT * FROM recordings WHERE id = ?`, [id]);
}

export default {
  getRecordings,
  getRecordingsByVessel,
  createRecording,
  getOrCreateRecordingForUpload
};
