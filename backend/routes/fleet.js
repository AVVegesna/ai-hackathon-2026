import { all, get } from '../database.js';

// Fleet overview. Everything here is aggregated in SQL from the tables — there
// are no estimated or sampled figures. Where the data cannot answer a question
// (how many vessels are fishing right now, without a live AIS feed) the shape
// returned makes that explicit rather than guessing.

export async function getFleetOverview() {
  const [totals, byActivity, byGear, positions, coverage, workload] = await Promise.all([
    get(`
      SELECT
        (SELECT COUNT(*) FROM vessels WHERE status != 'holding')            AS vessels_total,
        (SELECT COUNT(*) FROM vessels
           WHERE latitude IS NOT NULL AND longitude IS NOT NULL
             AND status != 'holding')                                      AS vessels_with_fix,
        (SELECT COUNT(*) FROM recordings)                                   AS recordings_total,
        (SELECT COUNT(*) FROM recordings WHERE media_url IS NOT NULL)       AS recordings_with_media,
        (SELECT COALESCE(SUM(duration_minutes), 0) FROM recordings)         AS minutes_recorded,
        (SELECT COUNT(*) FROM flags WHERE resolved = 0)                     AS flags_open,
        (SELECT COUNT(*) FROM flags WHERE resolved = 0
           AND due_at IS NOT NULL AND due_at < CURRENT_TIMESTAMP)           AS flags_overdue
    `),
    all(`
      SELECT COALESCE(activity, 'unknown') AS activity, COUNT(*) AS count
      FROM vessels
      WHERE status != 'holding'
      GROUP BY COALESCE(activity, 'unknown')
      ORDER BY count DESC
    `),
    all(`
      SELECT gear, COUNT(*) AS count
      FROM vessels
      WHERE status != 'holding'
      GROUP BY gear
      ORDER BY count DESC
    `),
    // Only vessels with an actual fix are returned, so the map cannot plot a
    // vessel whose position is unknown.
    all(`
      SELECT
        v.id, v.name, v.imo, v.licence, v.gear, v.activity,
        v.latitude, v.longitude, v.last_ais_ping, v.position_source,
        (SELECT COUNT(*) FROM flags f
           JOIN recordings r ON f.recording_id = r.id
          WHERE r.vessel_id = v.id AND f.resolved = 0) AS unresolved_flags
      FROM vessels v
      WHERE v.latitude IS NOT NULL AND v.longitude IS NOT NULL
        AND v.status != 'holding'
      ORDER BY v.name
    `),
    // Vessels with no footage on file at all — a genuine monitoring gap, and
    // more useful to surface than a headline count.
    all(`
      SELECT v.id, v.name, v.imo,
             (SELECT MAX(recording_date) FROM recordings WHERE vessel_id = v.id) AS last_recording_date,
             (SELECT COUNT(*) FROM recordings WHERE vessel_id = v.id)            AS recordings_count
      FROM vessels v
      WHERE v.status != 'holding'
      ORDER BY last_recording_date IS NULL DESC, last_recording_date ASC
      LIMIT 10
    `),
    // Who is carrying the open review load.
    all(`
      SELECT COALESCE(assigned_to, 'Unassigned') AS assignee, COUNT(*) AS count
      FROM flags
      WHERE resolved = 0
      GROUP BY COALESCE(assigned_to, 'Unassigned')
      ORDER BY count DESC
    `),
  ]);

  return {
    totals,
    by_activity: byActivity,
    by_gear: byGear,
    positions,
    coverage,
    workload,
  };
}

export default { getFleetOverview };
