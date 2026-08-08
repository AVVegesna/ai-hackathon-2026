import { initializeDatabase, run, get } from './database.js';

const seedUsers = [
  {
    username: 'mokafor',
    password: 'demo123',
    display_name: 'M. Okafor',
    role: 'Observer',
    grade: 'Grade 2'
  },
  {
    username: 'jtaumata',
    password: 'demo123',
    display_name: 'J. Taumata',
    role: 'Senior Observer',
    grade: 'Grade 4'
  }
];

const accountFixtures = {
  mokafor: {
    vessels: [
      { name: 'FV Kaituna Star', imo: '9284117', licence: 'NZ-TR-4421', gear: 'Bottom trawl', captain: 'James Smith', crew_count: 8 },
      { name: 'FV Ocean Wave', imo: '9275432', licence: 'NZ-TR-4389', gear: 'Pelagic trawl', captain: 'Robert Johnson', crew_count: 10 },
      { name: 'FV Sea Hunter', imo: '9198765', licence: 'NZ-TR-4156', gear: 'Longliner', captain: 'Michael Chen', crew_count: 6 }
    ],
    recordings: [
      { vessel: 'FV Kaituna Star', recording_date: '2024-01-15', start_time: '09:30:00', end_time: '12:15:00', duration_minutes: 165, cameras_count: 4, hauls_count: 5 },
      { vessel: 'FV Kaituna Star', recording_date: '2024-01-14', start_time: '08:45:00', end_time: '14:30:00', duration_minutes: 345, cameras_count: 4, hauls_count: 3 },
      { vessel: 'FV Ocean Wave', recording_date: '2024-01-15', start_time: '07:00:00', end_time: '16:30:00', duration_minutes: 570, cameras_count: 4, hauls_count: 6 }
    ],
    flags: [
      { vessel: 'FV Kaituna Star', recording_date: '2024-01-15', flag_type: 'Net damage', severity: 'Medium', timestamp_seconds: 754, description: 'Net hole visible during haul 3', camera_id: 1 },
      { vessel: 'FV Kaituna Star', recording_date: '2024-01-15', flag_type: 'Bycatch species', severity: 'High', timestamp_seconds: 1467, description: 'Unidentified species in net', camera_id: 2 },
      { vessel: 'FV Ocean Wave', recording_date: '2024-01-15', flag_type: 'Catch handling', severity: 'Low', timestamp_seconds: 2400, description: 'Rough handling of catch', camera_id: 2 }
    ]
  },
  jtaumata: {
    vessels: [
      { name: 'FV Southern Breeze', imo: '9345678', licence: 'NZ-TR-4501', gear: 'Bottom trawl', captain: 'Thomas Anderson', crew_count: 7 },
      { name: 'FV Pacific Dream', imo: '9123456', licence: 'NZ-TR-4500', gear: 'Demersal trawl', captain: 'Emma Brown', crew_count: 8 }
    ],
    recordings: [
      { vessel: 'FV Southern Breeze', recording_date: '2024-02-03', start_time: '06:15:00', end_time: '13:25:00', duration_minutes: 430, cameras_count: 4, hauls_count: 4 },
      { vessel: 'FV Pacific Dream', recording_date: '2024-02-04', start_time: '05:50:00', end_time: '15:00:00', duration_minutes: 550, cameras_count: 4, hauls_count: 7 }
    ],
    flags: [
      { vessel: 'FV Southern Breeze', recording_date: '2024-02-03', flag_type: 'Gear loss', severity: 'High', timestamp_seconds: 1200, description: 'Possible trap loss detected', camera_id: 3 },
      { vessel: 'FV Pacific Dream', recording_date: '2024-02-04', flag_type: 'Bycatch species', severity: 'Medium', timestamp_seconds: 3320, description: 'Review required for species identification', camera_id: 1 }
    ]
  }
};

async function seedDatabase() {
  try {
    console.log('Seeding database...');

    initializeDatabase();

    // Wait briefly for serialized table creation to finish.
    await new Promise((resolve) => setTimeout(resolve, 400));

    console.log('Clearing existing data...');
    await run('DELETE FROM user_sessions');
    await run('DELETE FROM flags');
    await run('DELETE FROM recordings');
    await run('DELETE FROM reviews');
    await run('DELETE FROM vessels');
    await run('DELETE FROM users');

    console.log('Adding users...');
    for (const user of seedUsers) {
      await run(
        `INSERT INTO users (username, password, display_name, role, grade)
         VALUES (?, ?, ?, ?, ?)`,
        [user.username, user.password, user.display_name, user.role, user.grade]
      );
    }

    for (const user of seedUsers) {
      const userRow = await get('SELECT id FROM users WHERE username = ?', [user.username]);
      const fixture = accountFixtures[user.username];
      const vesselIdsByName = new Map();

      console.log(`Adding vessels for ${user.username}...`);
      for (const vessel of fixture.vessels) {
        const result = await run(
          `INSERT INTO vessels
             (user_id, name, imo, licence, gear, captain, crew_count, status, last_ais_ping)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)`,
          [userRow.id, vessel.name, vessel.imo, vessel.licence, vessel.gear, vessel.captain, vessel.crew_count]
        );
        vesselIdsByName.set(vessel.name, result.id);
      }

      const recordingIdsByVesselAndDate = new Map();

      console.log(`Adding recordings for ${user.username}...`);
      for (const recording of fixture.recordings) {
        const vesselId = vesselIdsByName.get(recording.vessel);
        const result = await run(
          `INSERT INTO recordings
             (vessel_id, recording_date, start_time, end_time, duration_minutes, cameras_count, hauls_count, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            vesselId,
            recording.recording_date,
            recording.start_time,
            recording.end_time,
            recording.duration_minutes,
            recording.cameras_count,
            recording.hauls_count
          ]
        );

        recordingIdsByVesselAndDate.set(`${recording.vessel}__${recording.recording_date}`, result.id);
      }

      console.log(`Adding flags for ${user.username}...`);
      for (const flag of fixture.flags) {
        const recordingId = recordingIdsByVesselAndDate.get(`${flag.vessel}__${flag.recording_date}`);
        await run(
          `INSERT INTO flags
             (recording_id, flag_type, severity, timestamp_seconds, description, camera_id, resolved)
           VALUES (?, ?, ?, ?, ?, ?, 0)`,
          [recordingId, flag.flag_type, flag.severity, flag.timestamp_seconds, flag.description, flag.camera_id]
        );
      }
    }

    console.log('Database seeded successfully.');
    console.log('Login accounts:');
    console.log('  - mokafor / demo123');
    console.log('  - jtaumata / demo123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
