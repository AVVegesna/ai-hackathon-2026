# Quick Start Guide

## 🚀 Start the Application (2 ways)

### Option 1: Run Everything Together (Recommended)
```bash
cd /Users/si131450/projects/ai-hackathon-2026
npm run dev
```

This will start:
- Backend API on `http://localhost:3000` ✓
- Frontend on `http://localhost:5173` ✓

### Option 2: Run Servers Separately
**Terminal 1 - Backend:**
```bash
cd /Users/si131450/projects/ai-hackathon-2026/backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd /Users/si131450/projects/ai-hackathon-2026/frontend
npm run dev
```

---

## 📊 What You Get

### Fleet View (Default)
- Dashboard with 4 KPIs (total vessels, fishing now, unresolved flags, average per vessel)
- Map view with vessel positions
- Flags by category breakdown
- Review backlog tracking
- Fleet table with sorting and search

### Vessel Detail View
- Vessel information (IMO, licence, crew count)
- Multiple recording tabs by date
- Video player with playback controls
- Camera switching (4 cameras)
- Flagged moments timeline with severity levels
- Observer notes section

---

## 📁 Project Structure

```
ai-hackathon-2026/
├── backend/                 # Node.js + Express API
│   ├── server.js           # Main server file
│   ├── database.js         # SQLite setup
│   ├── seedData.js         # Database seeding
│   ├── routes/
│   │   ├── vessels.js      # Vessel endpoints
│   │   ├── recordings.js   # Recording endpoints
│   │   └── flags.js        # Flag endpoints
│   ├── data/portal.db      # SQLite database (auto-created)
│   └── package.json
│
├── frontend/                # React + Vite app
│   ├── index.html          # HTML entry
│   ├── vite.config.js      # Vite config
│   ├── src/
│   │   ├── main.jsx        # React root
│   │   ├── App.jsx         # Main component
│   │   ├── components/
│   │   │   ├── FleetView.jsx
│   │   │   └── VesselView.jsx
│   │   └── App.css
│   └── package.json
│
├── design/                  # Industry design system
├── package.json             # Root npm scripts
└── FULLSTACK_README.md     # Full documentation
```

---

## 🔌 API Endpoints

All API calls go through the backend running on port 3000.

### Get All Vessels
```bash
curl http://localhost:3000/api/vessels
```

### Get Vessel Recordings
```bash
curl http://localhost:3000/api/vessels/1/recordings
```

### Get All Flags
```bash
curl http://localhost:3000/api/flags
```

### Create a Flag
```bash
curl -X POST http://localhost:3000/api/flags \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": 1,
    "flag_type": "Net damage",
    "severity": "High",
    "timestamp_seconds": 300,
    "description": "Large tear"
  }'
```

---

## 📊 Database

The SQLite database is automatically created at:
```
backend/data/portal.db
```

### Pre-seeded Data:
- **7 Vessels** (FV Kaituna Star, Ocean Wave, Sea Hunter, etc.)
- **8 Recordings** (with dates, times, camera counts)
- **10 Flags** (with types, severity levels, timestamps)

### Re-seed Database:
```bash
cd backend
npm run seed
```

---

## 🛠️ Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
lsof -i :3000
# Kill the process
kill -9 <PID>
```

### Frontend won't start
```bash
# Check if port 5173 is in use
lsof -i :5173
# Kill the process
kill -9 <PID>
```

### Database errors
```bash
# Reseed the database
cd backend
rm -rf data/portal.db
npm run seed
```

### API not connecting
- Make sure backend is running on port 3000
- Check browser console for CORS errors
- Vite should automatically proxy `/api` calls to backend

---

## 📝 Key Features

✅ Full-stack architecture with separate backend & frontend
✅ SQLite database with proper schema
✅ REST API with CORS support
✅ React components with live data binding
✅ Industry design system styling
✅ Multi-camera video player simulation
✅ Flag tracking and categorization
✅ Observer notes functionality
✅ Compliance status tracking
✅ Real-time KPI calculations

---

## 🎯 Next Steps

1. Explore the Fleet view - click on any vessel to see details
2. Check the flagged moments in vessel view
3. Try creating new flags via the API
4. Add more vessels using the API
5. Modify the design system in `design/_ds/`

---

## 📚 Documentation

For detailed setup, API documentation, and development guide, see:
- [FULLSTACK_README.md](./FULLSTACK_README.md)

---

## 💡 Tips

- **Live Reload**: Both frontend and backend support hot-reload during development
- **API Debugging**: Use VS Code REST Client or Postman to test API endpoints
- **Database Backup**: Copy `backend/data/portal.db` before re-seeding
- **Styling**: All styles use CSS variables from the Industry design system
