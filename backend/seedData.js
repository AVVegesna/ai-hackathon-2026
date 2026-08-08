// Seed data. The schema lives in database.js — this file must never redeclare it,
// or the two definitions drift (which is how media_url and due_at went missing).
import { fileURLToPath } from 'url';
import db, { initializeDatabase, migrateDatabase, run } from './database.js';


// Positions are SAMPLE data, not AIS. They are plausible working grounds inside
// the NZ EEZ so the fleet map has something to draw, and every row records
// position_source: 'sample' so the UI can say so plainly. When a real feed is
// connected it should write 'ais' and the map caveat disappears on its own.
const seedVessels = [
  { name: 'FV Kaituna Star', imo: '9284117', licence: 'NZ-TR-4421', gear: 'Bottom trawl', captain: 'James Smith', crew_count: 8 , latitude: -41.62, longitude: 174.55, activity: 'fishing' },
  { name: 'FV Ocean Wave', imo: '9275432', licence: 'NZ-TR-4389', gear: 'Pelagic trawl', captain: 'Robert Johnson', crew_count: 10 , latitude: -43.9, longitude: 173.3, activity: 'fishing' },
  { name: 'FV Sea Hunter', imo: '9198765', licence: 'NZ-TR-4156', gear: 'Longliner', captain: 'Michael Chen', crew_count: 6 , latitude: -36.55, longitude: 175.35, activity: 'transit' },
  { name: 'FV Trawler 2', imo: '9654321', licence: 'NZ-TR-3892', gear: 'Bottom trawl', captain: 'David Williams', crew_count: 9 , latitude: -46.35, longitude: 167.2, activity: 'fishing' },
  { name: 'FV Port Vessel', imo: '9876543', licence: 'NZ-TR-2101', gear: 'Seine', captain: 'Sarah Wilson', crew_count: 7 , latitude: -41.29, longitude: 174.78, activity: 'in_port' },
  { name: 'FV Pacific Dream', imo: '9123456', licence: 'NZ-TR-4500', gear: 'Demersal trawl', captain: 'Emma Brown', crew_count: 8 , latitude: -38.95, longitude: 177.95, activity: 'fishing' },
  { name: 'FV Southern Breeze', imo: '9345678', licence: 'NZ-TR-4501', gear: 'Bottom trawl', captain: 'Thomas Anderson', crew_count: 7 , latitude: -44.75, longitude: 170.95, activity: 'transit' },
];

// The clips we actually hold media for, paired with the detector's annotated
// render. Everything else is metadata only, and the player says so rather
// than pretending to have footage.
const ALBATROSS_CLIP = '/uploads/1786156325478_aqi8no.mp4';
const ALBATROSS_PROCESSED = '/results/1786156325478_aqi8no_processed.mp4';
const DOLPHIN_CLIP_1 = '/uploads/1786229258928_u3g659.mp4';
const DOLPHIN_PROCESSED_1 = '/results/1786229258928_u3g659_processed.mp4';
const DOLPHIN_CLIP_2 = '/uploads/1786229763906_k9c53i.mp4';
const DOLPHIN_PROCESSED_2 = '/results/1786229763906_k9c53i_processed.mp4';

const seedRecordings = [
  { vessel_id: 1, recording_date: '2024-01-15', start_time: '09:30:00', end_time: '12:15:00', duration_minutes: 165, cameras_count: 4, hauls_count: 5, media_url: ALBATROSS_CLIP, processed_media_url: ALBATROSS_PROCESSED },
  { vessel_id: 1, recording_date: '2024-01-14', start_time: '08:45:00', end_time: '14:30:00', duration_minutes: 345, cameras_count: 4, hauls_count: 3 },
  { vessel_id: 1, recording_date: '2024-01-13', start_time: '10:00:00', end_time: '15:20:00', duration_minutes: 320, cameras_count: 4, hauls_count: 4 },
  { vessel_id: 2, recording_date: '2024-01-15', start_time: '07:00:00', end_time: '16:30:00', duration_minutes: 570, cameras_count: 4, hauls_count: 6 },
  { vessel_id: 2, recording_date: '2024-01-14', start_time: '08:00:00', end_time: '17:00:00', duration_minutes: 540, cameras_count: 4, hauls_count: 5 },
  { vessel_id: 3, recording_date: '2024-01-15', start_time: '06:30:00', end_time: '18:00:00', duration_minutes: 690, cameras_count: 2, hauls_count: 8 },
  { vessel_id: 4, recording_date: '2024-01-14', start_time: '09:00:00', end_time: '15:30:00', duration_minutes: 390, cameras_count: 3, hauls_count: 4 },
  { vessel_id: 5, recording_date: '2024-01-12', start_time: '10:00:00', end_time: '16:45:00', duration_minutes: 405, cameras_count: 2, hauls_count: 3 },
  // Recordings 9 and 10 are the two dolphin detector sample clips, so the
  // model's dolphin_events have somewhere to attach as flags below.
  { vessel_id: 2, recording_date: '2024-01-16', start_time: '11:00:00', end_time: '11:15:00', duration_minutes: 10, cameras_count: 1, hauls_count: 1, media_url: DOLPHIN_CLIP_1, processed_media_url: DOLPHIN_PROCESSED_1 },
  { vessel_id: 3, recording_date: '2024-01-16', start_time: '13:00:00', end_time: '13:15:00', duration_minutes: 10, cameras_count: 1, hauls_count: 1, media_url: DOLPHIN_CLIP_2, processed_media_url: DOLPHIN_PROCESSED_2 },
];

// days_ago drives due_at, so the seeded queue has a realistic spread of
// deadlines — including genuinely overdue items, which the queue must surface.
const seedFlags = [
  // Recording 1 is the clip we hold media for: keep these timestamps inside it
  // so the scrubber markers land on real frames.
  { recording_id: 1, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 2, description: 'Possible dolphin in net during haul', camera_id: 1, days_ago: 9, assigned_to: 'M. Okafor' },
  { recording_id: 1, flag_type: 'Net damage', severity: 'Medium', timestamp_seconds: 5, description: 'Net hole visible during haul 3', camera_id: 2, days_ago: 6, assigned_to: 'M. Okafor' },
  { recording_id: 1, flag_type: 'Catch handling', severity: 'Low', timestamp_seconds: 8, description: 'Catch handling to review', camera_id: 3, days_ago: 2, assigned_to: null },
  { recording_id: 2, flag_type: 'Net damage', severity: 'High', timestamp_seconds: 3600, description: 'Significant net damage across upper panel', camera_id: 1, days_ago: 11, assigned_to: 'M. Okafor' },
  { recording_id: 2, flag_type: 'Foreign material', severity: 'Low', timestamp_seconds: 5400, description: 'Debris in catch', camera_id: 2, days_ago: 4, assigned_to: null },
  { recording_id: 3, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 7200, description: 'Protected species detected in haul 6', camera_id: 3, days_ago: 8, assigned_to: 'R. Tane' },
  { recording_id: 4, flag_type: 'Net damage', severity: 'Medium', timestamp_seconds: 1200, description: 'Minor tear in net', camera_id: 1, days_ago: 5, assigned_to: 'R. Tane' },
  { recording_id: 5, flag_type: 'Catch handling', severity: 'Low', timestamp_seconds: 2400, description: 'Handling practice to confirm', camera_id: 2, days_ago: 1, assigned_to: null },
  { recording_id: 6, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 3600, description: 'Dolphin detected in net', camera_id: 1, days_ago: 7, assigned_to: 'M. Okafor' },
  { recording_id: 7, flag_type: 'Gear configuration', severity: 'Medium', timestamp_seconds: 900, description: 'Possible unreported gear change', camera_id: 2, days_ago: 3, assigned_to: null },
  { recording_id: 8, flag_type: 'Foreign material', severity: 'Low', timestamp_seconds: 1500, description: 'Plastic waste in catch', camera_id: 1, days_ago: 0, assigned_to: null },
  // Recordings 9 and 10 hold real media, so keep these timestamps inside the
  // detector's actual dolphin_events for that clip (see backend/results/*_meta.json).
  { recording_id: 9, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 1, description: 'Dolphin detected in net (YOLO-World, peak count 1)', camera_id: 1, days_ago: 1, assigned_to: null },
  { recording_id: 9, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 5, description: 'Dolphin detected in net (YOLO-World, peak count 1)', camera_id: 1, days_ago: 1, assigned_to: null },
  { recording_id: 10, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 1, description: 'Dolphin detected in net (YOLO-World, peak count 1)', camera_id: 1, days_ago: 0, assigned_to: null },
  { recording_id: 10, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 5, description: 'Dolphin detected in net (YOLO-World, peak count 1)', camera_id: 1, days_ago: 0, assigned_to: null },
];

export async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...');

    // initializeDatabase resolves once the last statement has run, so there is
    // nothing left to wait out here.
    await initializeDatabase();
    await migrateDatabase();

    // Clear existing data
    console.log('📋 Clearing existing data...');
    await run('DELETE FROM flags');
    await run('DELETE FROM recordings');
    await run('DELETE FROM reviews');
    await run('DELETE FROM audit_log');
    await run('DELETE FROM vessels');
    
    // The vessel_id / recording_id fields above are 1-based positions in these
    // arrays, not database ids. DELETE FROM does not reset SQLite's
    // AUTOINCREMENT counter, so on any re-seed the real ids drift upward and
    // hardcoded foreign keys would join to nothing. Map positions to real ids.
    const vesselIds = [];
    const recordingIds = [];

    // Seed vessels
    console.log('🚢 Adding vessels...');
    for (const vessel of seedVessels) {
      const { id } = await run(
        `INSERT INTO vessels
           (name, imo, licence, gear, captain, crew_count, status, last_ais_ping,
            latitude, longitude, activity, position_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, 'sample')`,
        [vessel.name, vessel.imo, vessel.licence, vessel.gear, vessel.captain,
         vessel.crew_count, 'active', vessel.latitude ?? null,
         vessel.longitude ?? null, vessel.activity ?? null]
      );
      vesselIds.push(id);
    }

    // Seed recordings
    console.log('📹 Adding recordings...');
    for (const recording of seedRecordings) {
      const { id } = await run(
        'INSERT INTO recordings (vessel_id, recording_date, start_time, end_time, duration_minutes, cameras_count, hauls_count, status, media_url, processed_media_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [vesselIds[recording.vessel_id - 1], recording.recording_date, recording.start_time, recording.end_time, recording.duration_minutes, recording.cameras_count, recording.hauls_count, 'active', recording.media_url || null, recording.processed_media_url || null]
      );
      recordingIds.push(id);
    }

    // Seed flags. created_at is backdated by days_ago and due_at derives from it,
    // so the queue opens on a realistic mix of fresh, due-soon and overdue work.
    console.log('🚩 Adding flags...');
    for (const flag of seedFlags) {
      const daysAgo = flag.days_ago ?? 0;
      await run(
        `INSERT INTO flags
           (recording_id, flag_type, severity, timestamp_seconds, description,
            camera_id, resolved, assigned_to, created_at, due_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?,
                 datetime(CURRENT_TIMESTAMP, '-' || ? || ' days'),
                 datetime(CURRENT_TIMESTAMP, '-' || ? || ' days', '+7 days'))`,
        [recordingIds[flag.recording_id - 1], flag.flag_type, flag.severity, flag.timestamp_seconds,
         flag.description, flag.camera_id, flag.assigned_to || null, daysAgo, daysAgo]
      );
    }
    
    console.log('✅ Database seeded successfully!');
    console.log(`   ✓ ${seedVessels.length} vessels`);
    console.log(`   ✓ ${seedRecordings.length} recordings`);
    console.log(`   ✓ ${seedFlags.length} flags`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Only take over the process when run directly (`npm run seed`). The server
// imports this to seed a fresh deployment, and must not have its process exited
// or its shared database connection closed underneath it.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  seedDatabase()
    .then(() => {
      db.close();
      process.exit(0);
    })
    .catch(() => process.exit(1));
}
