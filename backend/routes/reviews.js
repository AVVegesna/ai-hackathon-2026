import { all, get, run } from '../database.js';
import { record } from './audit.js';

export function getReviewsByVessel(vesselId) {
  return all(
    `SELECT r.*, v.name AS vessel_name
     FROM reviews r
     JOIN vessels v ON r.vessel_id = v.id
     WHERE r.vessel_id = ?
     ORDER BY r.created_at DESC`,
    [vesselId]
  );
}

// Reviews are append-only: submitting again creates a new record rather than
// mutating the previous one, so the history of determinations stays intact.
export async function createReview(data) {
  const { id } = await run(
    `INSERT INTO reviews (vessel_id, reviewed_by, status, compliance_score, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      data.vessel_id,
      data.reviewed_by || 'unknown',
      data.status || 'submitted',
      data.compliance_score ?? null,
      data.notes || null,
    ]
  );

  await record({
    entity_type: 'review',
    entity_id: id,
    action: 'review_submitted',
    actor: data.reviewed_by || 'unknown',
    detail: data.notes || null,
    vessel_id: data.vessel_id,
  });

  return get(`SELECT * FROM reviews WHERE id = ?`, [id]);
}

export default { getReviewsByVessel, createReview };
