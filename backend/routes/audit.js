import { all, run } from '../database.js';

// Append-only. There is deliberately no update or delete export here —
// an audit row, once written, is permanent.
export function record({ entity_type, entity_id, action, actor, detail, vessel_id }) {
  return run(
    `INSERT INTO audit_log (entity_type, entity_id, action, actor, detail, vessel_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entity_type, entity_id, action, actor || 'unknown', detail || null, vessel_id || null]
  );
}

export function getAudit(query = {}) {
  const where = [];
  const params = [];

  if (query.entity_type) {
    where.push('a.entity_type = ?');
    params.push(query.entity_type);
  }
  if (query.entity_id) {
    where.push('a.entity_id = ?');
    params.push(query.entity_id);
  }
  if (query.vessel_id) {
    where.push('a.vessel_id = ?');
    params.push(query.vessel_id);
  }
  if (query.actor) {
    where.push('a.actor = ?');
    params.push(query.actor);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(parseInt(query.limit, 10) || 200, 1000);

  return all(
    `SELECT a.*, v.name AS vessel_name
     FROM audit_log a
     LEFT JOIN vessels v ON a.vessel_id = v.id
     ${whereSql}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ?`,
    [...params, limit]
  );
}

export default { record, getAudit };
