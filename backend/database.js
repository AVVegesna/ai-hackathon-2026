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
    // Accounts table for login
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT DEFAULT 'Observer',
        grade TEXT DEFAULT 'Grade 2',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Session table for token-based auth
    db.run(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Vessels table
    db.run(`
      CREATE TABLE IF NOT EXISTS vessels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        imo TEXT UNIQUE NOT NULL,
        licence TEXT UNIQUE NOT NULL,
        gear TEXT NOT NULL,
        captain TEXT,
        crew_count INTEGER,
        status TEXT DEFAULT 'active',
        last_upload DATETIME,
        last_ais_ping DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
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
        user_id INTEGER,
        vessel_id INTEGER NOT NULL,
        recording_id INTEGER,
        reviewed_by TEXT,
        status TEXT DEFAULT 'pending',
        compliance_score INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (vessel_id) REFERENCES vessels(id),
        FOREIGN KEY (recording_id) REFERENCES recordings(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Lightweight migrations for existing DB files.
    db.run('ALTER TABLE vessels ADD COLUMN user_id INTEGER', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error migrating vessels.user_id:', err.message);
      }
    });

    db.run('ALTER TABLE reviews ADD COLUMN user_id INTEGER', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error migrating reviews.user_id:', err.message);
      }
    });

    db.run('ALTER TABLE reviews ADD COLUMN recording_id INTEGER', (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error migrating reviews.recording_id:', err.message);
      }
    });

    // Ensure there is always a default user for legacy rows.
    db.run(
      `INSERT OR IGNORE INTO users (username, password, display_name, role, grade)
       VALUES ('mokafor', 'demo123', 'M. Okafor', 'Observer', 'Grade 2')`
    );

    db.run(
      `UPDATE vessels
       SET user_id = (SELECT id FROM users WHERE username = 'mokafor')
       WHERE user_id IS NULL`
    );

    db.run(
      `UPDATE reviews
       SET user_id = (SELECT id FROM users WHERE username = 'mokafor')
       WHERE user_id IS NULL`
    );

    console.log('✓ Database tables initialized');
  });
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
