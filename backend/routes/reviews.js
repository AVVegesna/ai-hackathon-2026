import { get, run } from '../database.js';

async function getOwnedRecording(recordingId, userId) {
  return get(
    `SELECT
       r.id,
       r.vessel_id
     FROM recordings r
     JOIN vessels v ON r.vessel_id = v.id
     WHERE r.id = ? AND v.user_id = ?`,
    [recordingId, userId]
  );
}

export async function getReviewByRecording(recordingId, userId) {
  const ownedRecording = await getOwnedRecording(recordingId, userId);
  if (!ownedRecording) {
    return null;
  }

  return get(
    `SELECT
       id,
       user_id,
       vessel_id,
       recording_id,
       reviewed_by,
       status,
       notes,
       created_at,
       updated_at
     FROM reviews
     WHERE user_id = ? AND recording_id = ?
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [userId, recordingId]
  );
}

export async function upsertReviewByRecording(recordingId, user, payload = {}) {
  const ownedRecording = await getOwnedRecording(recordingId, user.id);
  if (!ownedRecording) {
    return null;
  }

  const notes = payload.notes || '';
  const status = payload.status || 'submitted';

  const existing = await get(
    `SELECT id
     FROM reviews
     WHERE user_id = ? AND recording_id = ?
     LIMIT 1`,
    [user.id, recordingId]
  );

  if (existing) {
    await run(
      `UPDATE reviews
       SET notes = ?,
           status = ?,
           reviewed_by = ?,
           vessel_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [notes, status, user.display_name, ownedRecording.vessel_id, existing.id]
    );
  } else {
    await run(
      `INSERT INTO reviews
        (user_id, vessel_id, recording_id, reviewed_by, status, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [user.id, ownedRecording.vessel_id, recordingId, user.display_name, status, notes]
    );
  }

  return getReviewByRecording(recordingId, user.id);
}
