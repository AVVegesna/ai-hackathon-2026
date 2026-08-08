# Fisheries Monitoring Review Portal

A full-stack web application for monitoring and reviewing fishing vessel activities, flagging compliance issues, and managing observer data.

## Project Structure

```
├── backend/              # Node.js + Express API server
│   ├── server.js         # Express server entry point
│   ├── database.js       # SQLite database setup
│   ├── seedData.js       # Database seeding script
│   ├── routes/           # API route handlers
│   │   ├── auth.js
│   │   ├── vessels.js
│   │   ├── recordings.js
│   │   └── flags.js
│   ├── middleware/
│   │   └── auth.js
│   └── package.json
│
├── frontend/             # React + Vite web application
│   ├── index.html        # HTML entry point
│   ├── vite.config.js    # Vite configuration
│   ├── src/
│   │   ├── main.jsx      # React entry point
│   │   ├── App.jsx       # Main application component
│   │   ├── App.css       # Global styles
│   │   └── components/
│   │       ├── FleetView.jsx     # Fleet management view
│   │       └── VesselView.jsx    # Vessel detail view
│   └── package.json
│
├── design/               # Industry design system
├── package.json          # Root package.json
└── README.md             # This file
```

## Tech Stack

- **Backend**: Node.js, Express, SQLite3
- **Frontend**: React 18, Vite, Axios
- **Design**: Industry design system

## Setup & Installation

### Prerequisites
- Node.js 18+ (with npm)
- macOS/Linux (or Windows with WSL)

### 1. Install Dependencies

```bash
# Install all dependencies (root, backend, frontend)
npm run install-all

# Or install individually:
npm install                    # Root dependencies
cd backend && npm install      # Backend dependencies
cd ../frontend && npm install  # Frontend dependencies
cd ..
```

### 2. Initialize Database

```bash
cd backend
npm run seed
cd ..
```

This creates the SQLite database at `backend/data/portal.db` and populates it with sample vessels, recordings, and flags.

Seeded login accounts:
- `mokafor` / `demo123`
- `jtaumata` / `demo123`

### 3. Start Development Servers

**Option A: Run both servers concurrently**
```bash
npm run dev
```

**Option B: Run servers separately**

Terminal 1 - Backend API (port 3000):
```bash
npm run dev:backend
```

Terminal 2 - Frontend app (port 5173):
```bash
npm run dev:frontend
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/api/health

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and receive token
- `POST /api/auth/logout` - Logout current token
- `GET /api/auth/me` - Current user profile

All data endpoints below require `Authorization: Bearer <token>`.

### Vessels
- `GET /api/vessels` - Get all vessels
- `GET /api/vessels/:id` - Get vessel details
- `POST /api/vessels` - Create new vessel
- `PUT /api/vessels/:id` - Update vessel

### Recordings
- `GET /api/recordings` - Get all recordings
- `GET /api/vessels/:vesselId/recordings` - Get vessel recordings
- `POST /api/recordings` - Create recording

### Flags
- `GET /api/flags` - Get all unresolved flags
- `GET /api/recordings/:recordingId/flags` - Get recording flags
- `POST /api/flags` - Create flag
- `PUT /api/flags/:id/resolve` - Resolve flag

## Features

### Fleet Management
- View all registered vessels
- Real-time vessel positions (AIS ping data)
- Compliance metrics and KPIs
- Flag tracking and categorization
- Search and filtering

### Vessel Review
- Multi-camera video recording review
- Flagged moments timeline
- Observer notes
- Camera switching
- Playback controls
- Compliance status tracking

### Dashboard Analytics
- Fleet statistics
- Flag categories breakdown
- Review backlog tracking
- Compliance scoring

## Database Schema

### Vessels
- id, name, imo, licence, gear, captain, crew_count, status, last_upload, last_ais_ping

### Recordings
- id, vessel_id, recording_date, start_time, end_time, duration_minutes, cameras_count, hauls_count, status

### Flags
- id, recording_id, flag_type, severity, timestamp_seconds, description, camera_id, resolved, resolved_by, resolution

### Reviews
- id, vessel_id, reviewed_by, status, compliance_score, notes

### Users
- id, username, password, display_name, role, grade

### User Sessions
- id, user_id, token, created_at, expires_at

## Environment Variables

Create `.env` in the backend directory (optional, defaults are fine for development):

```
PORT=3000
DATABASE_PATH=./data/portal.db
```

## Development Workflow

### Adding New Vessels
```bash
TOKEN="<paste token from /api/auth/login>"

curl -X POST http://localhost:3000/api/vessels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"FV New Ship","imo":"9999999","licence":"NZ-TR-9999","gear":"Trawl"}'
```

### Creating a Flag
```bash
curl -X POST http://localhost:3000/api/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id":1,
    "flag_type":"Net damage",
    "severity":"High",
    "timestamp_seconds":300,
    "description":"Large tear in net"
  }'
```

### Resolving a Flag
```bash
curl -X PUT http://localhost:3000/api/flags/1/resolve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resolved_by":"M. Okafor","resolution":"Net repaired in port"}'
```

## Building for Production

### Frontend Build
```bash
cd frontend
npm run build
# Output: frontend/dist/
```

### Backend Deployment
The backend can be deployed to any Node.js hosting (Heroku, Railway, etc.).

```bash
npm start  # Runs backend/server.js
```

## Troubleshooting

### Port Already in Use
```bash
# Backend (port 3000)
lsof -i :3000
kill -9 <PID>

# Frontend (port 5173)
lsof -i :5173
kill -9 <PID>
```

### Database Errors
```bash
# Reseed the database
cd backend
rm -rf data/portal.db
npm run seed
```

### CORS Issues
The frontend is configured to proxy API calls. If issues persist, check:
- Backend is running on port 3000
- Vite proxy config in `frontend/vite.config.js`

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT

## Support

For issues or questions, contact the development team.
