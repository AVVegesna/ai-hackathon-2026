import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'portal.db');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'));
}

const db = new sqlite3.Database(dbPath);

const run = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const initializeDatabase = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS vessels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        imo TEXT UNIQUE NOT NULL,
        licence TEXT UNIQUE NOT NULL,
        gear TEXT NOT NULL,
        captain TEXT,
        crew_count INTEGER,
        status TEXT DEFAULT 'active',
        last_upload DATETIME,
        last_ais_ping DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vessel_id INTEGER NOT NULL,
        recording_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        duration_minutes INTEGER,
        cameras_count INTEGER,
        hauls_count INTEGER,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS flags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recording_id INTEGER NOT NULL,
        flag_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        timestamp_seconds INTEGER NOT NULL,
        description TEXT,
        camera_id INTEGER,
        resolved BOOLEAN DEFAULT 0,
        resolved_by TEXT,
        resolution TEXT,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recording_id) REFERENCES recordings(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vessel_id INTEGER NOT NULL,
        reviewed_by TEXT,
        status TEXT DEFAULT 'pending',
        compliance_score INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id)
      )
    `);
  });
};

const seedVessels = [
  { name: 'FV Kaituna Star', imo: '9284117', licence: 'NZ-TR-4421', gear: 'Bottom trawl', captain: 'James Smith', crew_count: 8 },
  { name: 'FV Ocean Wave', imo: '9275432', licence: 'NZ-TR-4389', gear: 'Pelagic trawl', captain: 'Robert Johnson', crew_count: 10 },
  { name: 'FV Sea Hunter', imo: '9198765', licence: 'NZ-TR-4156', gear: 'Longliner', captain: 'Michael Chen', crew_count: 6 },
  { name: 'FV Trawler 2', imo: '9654321', licence: 'NZ-TR-3892', gear: 'Bottom trawl', captain: 'David Williams', crew_count: 9 },
  { name: 'FV Port Vessel', imo: '9876543', licence: 'NZ-TR-2101', gear: 'Seine', captain: 'Sarah Wilson', crew_count: 7 },
  { name: 'FV Pacific Dream', imo: '9123456', licence: 'NZ-TR-4500', gear: 'Demersal trawl', captain: 'Emma Brown', crew_count: 8 },
  { name: 'FV Southern Breeze', imo: '9345678', licence: 'NZ-TR-4501', gear: 'Bottom trawl', captain: 'Thomas Anderson', crew_count: 7 },
];

const seedRecordings = [
  { vessel_id: 1, recording_date: '2024-01-15', start_time: '09:30:00', end_time: '12:15:00', duration_minutes: 165, cameras_count: 4, hauls_count: 5 },
  { vessel_id: 1, recording_date: '2024-01-14', start_time: '08:45:00', end_time: '14:30:00', duration_minutes: 345, cameras_count: 4, hauls_count: 3 },
  { vessel_id: 1, recording_date: '2024-01-13', start_time: '10:00:00', end_time: '15:20:00', duration_minutes: 320, cameras_count: 4, hauls_count: 4 },
  { vessel_id: 2, recording_date: '2024-01-15', start_time: '07:00:00', end_time: '16:30:00', duration_minutes: 570, cameras_count: 4, hauls_count: 6 },
  { vessel_id: 2, recording_date: '2024-01-14', start_time: '08:00:00', end_time: '17:00:00', duration_minutes: 540, cameras_count: 4, hauls_count: 5 },
  { vessel_id: 3, recording_date: '2024-01-15', start_time: '06:30:00', end_time: '18:00:00', duration_minutes: 690, cameras_count: 2, hauls_count: 8 },
  { vessel_id: 4, recording_date: '2024-01-14', start_time: '09:00:00', end_time: '15:30:00', duration_minutes: 390, cameras_count: 3, hauls_count: 4 },
  { vessel_id: 5, recording_date: '2024-01-12', start_time: '10:00:00', end_time: '16:45:00', duration_minutes: 405, cameras_count: 2, hauls_count: 3 },
];

const seedFlags = [
  { recording_id: 1, flag_type: 'Net damage', severity: 'Medium', timestamp_seconds: 754, description: 'Net hole visible during haul 3', camera_id: 1 },
  { recording_id: 1, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 1467, description: 'Unidentified species in net', camera_id: 2 },
  { recording_id: 1, flag_type: 'Gear configuration', severity: 'Low', timestamp_seconds: 1914, description: 'Possible configuration change', camera_id: 3 },
  { recording_id: 1, flag_type: 'Catch handling', severity: 'Medium', timestamp_seconds: 2352, description: 'Rough handling of catch', camera_id: 4 },
  { recording_id: 2, flag_type: 'Net damage', severity: 'High', timestamp_seconds: 3600, description: 'Significant net damage', camera_id: 1 },
  { recording_id: 2, flag_type: 'Foreign material', severity: 'Low', timestamp_seconds: 5400, description: 'Debris in catch', camera_id: 2 },
  { recording_id: 3, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 7200, description: 'Protected species detected', camera_id: 3 },
  { recording_id: 4, flag_type: 'Net damage', severity: 'Medium', timestamp_seconds: 1200, description: 'Minor tear in net', camera_id: 1 },
  { recording_id: 5, flag_type: 'Catch handling', severity: 'Low', timestamp_seconds: 2400, description: 'Standard handling', camera_id: 2 },
  { recording_id: 6, flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 3600, description: 'Dolphin detected', camera_id: 1 },
];

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...');
    
    initializeDatabase();
    
    // Wait a moment for tables to be created
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clear existing data
    console.log('📋 Clearing existing data...');
    await run('DELETE FROM flags');
    await run('DELETE FROM recordings');
    await run('DELETE FROM reviews');
    await run('DELETE FROM vessels');
    
    // Seed vessels
    console.log('🚢 Adding vessels...');
    for (const vessel of seedVessels) {
      await run(
        'INSERT INTO vessels (name, imo, licence, gear, captain, crew_count, status, last_ais_ping) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [vessel.name, vessel.imo, vessel.licence, vessel.gear, vessel.captain, vessel.crew_count, 'active']
      );
    }
    
    // Seed recordings
    console.log('📹 Adding recordings...');
    for (const recording of seedRecordings) {
      await run(
        'INSERT INTO recordings (vessel_id, recording_date, start_time, end_time, duration_minutes, cameras_count, hauls_count, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [recording.vessel_id, recording.recording_date, recording.start_time, recording.end_time, recording.duration_minutes, recording.cameras_count, recording.hauls_count, 'active']
      );
    }
    
    // Seed flags
    console.log('🚩 Adding flags...');
    for (const flag of seedFlags) {
      await run(
        'INSERT INTO flags (recording_id, flag_type, severity, timestamp_seconds, description, camera_id, resolved) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [flag.recording_id, flag.flag_type, flag.severity, flag.timestamp_seconds, flag.description, flag.camera_id, 0]
      );
    }
    
    console.log('✅ Database seeded successfully!');
    console.log(`   ✓ ${seedVessels.length} vessels`);
    console.log(`   ✓ ${seedRecordings.length} recordings`);
    console.log(`   ✓ ${seedFlags.length} flags`);
    
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
