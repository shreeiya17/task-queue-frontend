# Task Queue Dashboard

Real-time operations dashboard for monitoring the Distributed Task Queue System. Built with React + Vite for fast development and optimized production builds.

**Status:** Production Ready — Deployed on Vercel

[Live Dashboard](https://task-queue-frontend.vercel.app) | [Backend Repo](https://github.com/shreeiya17/task-queue-system)

---

## Overview

This is the frontend dashboard that connects to the task queue backend via WebSocket. It provides real-time visibility into job processing, queue depth, and system performance.

**Features:**
- Live queue statistics (waiting, active, completed, failed, delayed, DLQ)
- Real-time job log with filtering by status
- Queue activity chart with historical data
- Live event feed showing job transitions
- Job enqueue scenarios for testing
- <100ms WebSocket update latency

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build Tool | Vite |
| Styling | CSS Grid/Flexbox |
| Real-time | Socket.io client |
| HTTP | Axios |
| Charts | Recharts |
| Deployment | Vercel |

---

## Project Structure

```
task-queue-frontend/
├── src/
│   ├── App.jsx           # Main component - handles state, Socket.io, rendering
│   ├── App.css           # Styling - grid layout, color scheme, animations
│   ├── index.css         # Global styles
│   ├── main.jsx          # Entry point
│   └── components/       # (Optional) Reusable components
├── public/               # Static assets
├── package.json          # Dependencies
├── vite.config.js        # Vite configuration
├── .env.example          # Environment variables template
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm

### Installation

```bash
# Clone and install
git clone https://github.com/shreeiya17/task-queue-frontend.git
cd task-queue-frontend
npm install

# Setup environment
cp .env.example .env
```

### Environment Variables

```env
# Backend API URL (local development)
VITE_API_URL=http://localhost:3000

# Production
VITE_API_URL=https://your-railway-backend.railway.app
```

### Running Locally

```bash
npm run dev
# Opens http://localhost:5173
```

### Build for Production

```bash
npm run build
# Creates optimized dist/ folder

npm run preview
# Preview production build locally
```

---

## How It Works

### Connection Flow

1. **Page loads** → React mounts App.jsx
2. **Socket.io connects** → Establishes WebSocket connection to backend
3. **Listens to events:**
   - `queue:stats` — Updates stat cards and chart every 1s
   - `job:completed` — Updates job in table when completed
   - `job:failed` — Updates job status when failed
   - `job:progress` — Updates progress bar for active jobs
4. **User interactions:**
   - Click scenario button → POST /api/jobs → Job enqueued
   - Click filter button → GET /api/jobs?status=X → Refresh job list

### Real-time Updates

The dashboard polls the backend via Socket.io. When a job's status changes, the server broadcasts to all connected clients. The frontend updates the UI without page refresh.

**Update flow:**
```
Backend (PostgreSQL) 
  ↓ (server polls every 1s)
Backend (Socket.io emit)
  ↓ (WebSocket)
Frontend (Socket.io listener)
  ↓ (update state)
Frontend (React re-render)
  ↓
UI updated
```

---

## Key Components

### App.jsx State

```javascript
const [jobs, setJobs]           // Current jobs being displayed
const [stats, setStats]         // Queue stats: {waiting, active, completed, ...}
const [history, setHistory]     // Chart data: [{time, waiting, active, ...}]
const [connected, setConnected] // Socket.io connection status
const [events, setEvents]       // Live event feed (max 30 events)
const [filter, setFilter]       // Current filter: all, waiting, active, ...
```

### Enqueue Job

When user clicks a scenario button:

```javascript
const addJob = async (scenario) => {
  const { data: res } = await axios.post(`${API}/api/jobs`, {
    type: scenario.type,
    priority: scenario.priority,
    data: scenario.makeData()
  })
  // Job added to backend, real-time update comes via Socket.io
}
```

### Listen to Job Updates

```javascript
socket.on('queue:stats', (s) => {
  setStats(s)
  // Update stat cards
})

socket.on('job:completed', (job) => {
  // Update job in jobs list
})
```

---

## Troubleshooting

### "Disconnected" status

**Check:**
1. Backend is running: `curl http://localhost:3000/health`
2. VITE_API_URL in .env is correct
3. Browser console (F12) for CORS errors

**Fix:**
```bash
# Verify backend running
npm run dev  # in task-queue-system directory

# Check backend logs for Socket.io connection
# Should show: [Socket.io] Dashboard connected
```

### Jobs not updating in real-time

**Check:**
1. Worker process is running: `npm run worker`
2. Browser console shows WebSocket connection active
3. Job log table shows jobs

**Fix:**
```bash
# Verify worker running
npm run worker  # in task-queue-system directory
# Should log: [Worker] Started — concurrency:5
```

### Build errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try build again
npm run build
```

---

## Performance Optimization

The dashboard is optimized for:

1. **Change detection** — Only updates chart when values actually change
2. **Bounded DOM** — Keeps job list at 50 items max
3. **Socket.io fallback** — Uses polling if WebSocket unavailable
4. **CSS optimization** — No animation spam on frequent updates

---

## Deployment

### Vercel

```bash
# 1. Push to GitHub
git add .
git commit -m "..."
git push origin main

# 2. Vercel auto-deploys from main
# Check Deployments tab on vercel.com

# 3. Set environment variable:
# Vercel Dashboard → Settings → Environment Variables
# VITE_API_URL = https://your-railway-backend.railway.app

# 4. Redeploy to apply env var
```

---

## Browser Support

| Browser | Version |
|---|---|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

IE 11 not supported (requires async/await, Promises).

---

## Development Notes

**Hot Module Replacement (HMR):**
- Changes to App.jsx are instantly reflected without page refresh
- Vite is ~10x faster than webpack for dev builds

**Production Build:**
- `npm run build` creates optimized bundle in `dist/`
- All CSS is minified and CSS modules are handled automatically
- JavaScript is tree-shaken and code-split

---

## Related Repos

- [Backend (Task Queue System)](https://github.com/shreeiya17/task-queue-system)