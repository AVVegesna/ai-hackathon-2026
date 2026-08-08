import { all, get } from '../database.js';

// Every figure the UI renders comes from here, computed in SQL.
// Nothing in this file is estimated, sampled, or invented — if a number
// cannot be derived from the database it is not returned at all.

export async function getQueueStats() {
  const [totals, bySeverity, byType, byAge, byVessel] = await Promise.all([
    get(`
      SELECT
        (SELECT COUNT(*) FROM vessels)                                        AS vessels_total,
        (SELECT COUNT(*) FROM recordings)                                     AS recordings_total,
        (SELECT COUNT(*) FROM flags WHERE resolved = 0)                       AS flags_open,
        (SELECT COUNT(*) FROM flags WHERE resolved = 1)                       AS flags_resolved,
        (SELECT COUNT(*) FROM flags WHERE resolved = 0
           AND due_at IS NOT NULL AND due_at < CURRENT_TIMESTAMP)             AS flags_overdue
    `),
    all(`
      SELECT severity, COUNT(*) AS count
      FROM flags WHERE resolved = 0
      GROUP BY severity
    `),
    all(`
      SELECT flag_type AS type, COUNT(*) AS count
      FROM flags WHERE resolved = 0
      GROUP BY flag_type
      ORDER BY count DESC
    `),
    all(`
      SELECT
        CAST(julianday('now') - julianday(created_at) AS INTEGER) AS days_old,
        COUNT(*) AS count
      FROM flags WHERE resolved = 0
      GROUP BY days_old
      ORDER BY days_old ASC
    `),
    all(`
      SELECT v.id AS vessel_id, v.name AS vessel_name, COUNT(f.id) AS count
      FROM flags f
      JOIN recordings r ON f.recording_id = r.id
      JOIN vessels v    ON r.vessel_id = v.id
      WHERE f.resolved = 0
      GROUP BY v.id
      ORDER BY count DESC
    `),
  ]);

  return { totals, by_severity: bySeverity, by_type: byType, by_age: byAge, by_vessel: byVessel };
}

// Filter / sort / paginate server-side. The queue must not depend on the
// client pulling every flag and narrowing it in the browser.
const SORTABLE = {
  due_at: 'f.due_at',
  created_at: 'f.created_at',
  severity: `CASE f.severity WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 ELSE 1 END`,
  vessel: 'v.name',
  type: 'f.flag_type',
};

export async function getQueue(query = {}) {
  const where = [];
  const params = [];

  where.push(query.resolved === 'true' ? 'f.resolved = 1' : 'f.resolved = 0');

  if (query.severity) {
    const list = String(query.severity).split(',').filter(Boolean);
    if (list.length) {
      where.push(`f.severity IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }
  if (query.type) {
    const list = String(query.type).split(',').filter(Boolean);
    if (list.length) {
      where.push(`f.flag_type IN (${list.map(() => '?').join(',')})`);
      params.push(...list);
    }
  }
  if (query.vessel_id) {
    where.push('v.id = ?');
    params.push(query.vessel_id);
  }
  if (query.overdue === 'true') {
    where.push('f.due_at IS NOT NULL AND f.due_at < CURRENT_TIMESTAMP');
  }
  if (query.q) {
    where.push('(v.name LIKE ? OR v.imo LIKE ? OR v.licence LIKE ? OR f.flag_type LIKE ? OR f.description LIKE ?)');
    const like = `%${query.q}%`;
    params.push(like, like, like, like, like);
  }

  const sortKey = SORTABLE[query.sort] || SORTABLE.due_at;
  const dir = String(query.dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const limit = Math.min(parseInt(query.limit, 10) || 100, 500);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const rows = await all(
    `SELECT
       f.*,
       r.vessel_id, r.recording_date, r.start_time, r.duration_minutes,
       r.cameras_count, r.media_url, r.processed_media_url,
       v.name AS vessel_name, v.imo, v.licence, v.gear,
       CAST(julianday('now') - julianday(f.created_at) AS INTEGER) AS days_old
     FROM flags f
     JOIN recordings r ON f.recording_id = r.id
     JOIN vessels v    ON r.vessel_id = v.id
     ${whereSql}
     ORDER BY ${sortKey} ${dir}, f.id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const { total } = await get(
    `SELECT COUNT(*) AS total
     FROM flags f
     JOIN recordings r ON f.recording_id = r.id
     JOIN vessels v    ON r.vessel_id = v.id
     ${whereSql}`,
    params
  );

  return { rows, total, limit, offset };
}

// Distinct values for the filter controls, so the UI never hardcodes a
// severity or flag-type list that could drift from the data.
export async function getQueueFacets() {
  const [severities, types, vessels] = await Promise.all([
    all(`SELECT DISTINCT severity AS value FROM flags ORDER BY value`),
    all(`SELECT DISTINCT flag_type AS value FROM flags ORDER BY value`),
    all(`SELECT id AS value, name AS label FROM vessels ORDER BY name`),
  ]);
  return { severities, types, vessels };
}

export default { getQueueStats, getQueue, getQueueFacets };
