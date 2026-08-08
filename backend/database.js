import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'portal.db');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'));
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✓ Database connected at:', dbPath);
  }
});

db.configure('busyTimeout', 5000);

export function initializeDatabase() {
  db.serialize(() => {
    // Vessels table
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

    // Recordings table
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

    // Flags table
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

    // Reviews table
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

    // Audit log — append-only. Every determination and review writes a row here.
    // This is the evidentiary backbone: nothing is ever updated in place.
    db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        detail TEXT,
        vessel_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_flags_resolved ON flags(resolved)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_recordings_vessel ON recordings(vessel_id)`);

    console.log('✓ Database tables initialized');
  });
}

// Additive column migrations. Existing portal.db files predate these columns,
// and CREATE TABLE IF NOT EXISTS will not add them, so ALTER each one if absent.
const MIGRATIONS = [
  ['recordings', 'media_url', 'TEXT'],
  ['flags', 'due_at', 'DATETIME'],
  ['flags', 'assigned_to', 'TEXT'],
  ['flags', 'determination', 'TEXT'],
];

export async function migrateDatabase() {
  for (const [table, column, type] of MIGRATIONS) {
    const cols = await all(`PRAGMA table_info(${table})`);
    if (!cols.length) continue; // table not created yet
    if (cols.some((c) => c.name === column)) continue;
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`✓ Migrated ${table}.${column}`);
  }
}

export function runSync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

export function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

export function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

export default db;
