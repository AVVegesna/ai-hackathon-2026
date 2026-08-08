import { all, get, run } from '../database.js';
import { record } from './audit.js';

// Statutory review window, in days from upload. Configurable rather than
// hardcoded as law — confirm the real obligation before treating it as one.
export const REVIEW_WINDOW_DAYS = Number(process.env.REVIEW_WINDOW_DAYS || 7);

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

const FLAG_SELECT = `
  SELECT
    f.*,
    r.vessel_id, r.recording_date, r.start_time, r.duration_minutes,
    r.cameras_count, r.media_url,
    v.name AS vessel_name, v.imo, v.licence, v.gear
  FROM flags f
  JOIN recordings r ON f.recording_id = r.id
  JOIN vessels v    ON r.vessel_id = v.id
  WHERE f.id = ?
`;

export function getFlagById(id) {
  return get(FLAG_SELECT, [id]);
}

export async function createFlag(data) {
  const { id } = await run(
    `INSERT INTO flags
       (recording_id, flag_type, severity, timestamp_seconds, description,
        camera_id, resolved, due_at, assigned_to)
     VALUES (?, ?, ?, ?, ?, ?, 0,
             datetime(CURRENT_TIMESTAMP, '+' || ? || ' days'), ?)`,
    [
      data.recording_id,
      data.flag_type,
      data.severity || 'Medium',
      data.timestamp_seconds,
      data.description || null,
      data.camera_id || null,
      REVIEW_WINDOW_DAYS,
      data.assigned_to || null,
    ]
  );

  const flag = await getFlagById(id);

  await record({
    entity_type: 'flag',
    entity_id: id,
    action: 'flag_raised',
    actor: data.raised_by || 'system',
    detail: `${data.flag_type} (${data.severity || 'Medium'}) at ${data.timestamp_seconds}s`,
    vessel_id: flag?.vessel_id,
  });

  return flag;
}

export const DETERMINATIONS = ['upheld', 'dismissed', 'escalated'];

export async function resolveFlag(id, data) {
  const existing = await getFlagById(id);
  if (!existing) return null;

  const determination = String(data.determination || '').toLowerCase();
  if (!DETERMINATIONS.includes(determination)) {
    const err = new Error(`determination must be one of: ${DETERMINATIONS.join(', ')}`);
    err.status = 400;
    throw err;
  }
  if (!data.resolved_by) {
    const err = new Error('resolved_by is required — determinations must be attributable');
    err.status = 400;
    throw err;
  }

  // An escalated flag stays open: escalation routes it onward, it does not close it.
  const closes = determination !== 'escalated';

  await run(
    `UPDATE flags
     SET resolved = ?, determination = ?, resolved_by = ?, resolution = ?,
         resolved_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [closes ? 1 : 0, determination, data.resolved_by, data.resolution || null, id]
  );

  await record({
    entity_type: 'flag',
    entity_id: Number(id),
    action: `flag_${determination}`,
    actor: data.resolved_by,
    detail: data.resolution || null,
    vessel_id: existing.vessel_id,
  });

  return getFlagById(id);
}

export default {
  getFlags,
  getFlagsByRecording,
  getFlagById,
  createFlag,
  resolveFlag
};
