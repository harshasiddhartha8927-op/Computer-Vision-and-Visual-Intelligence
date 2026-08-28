# Traffic Violation Intelligence

AI-powered traffic monitoring and violation detection system using **Gemini AI**, **Supabase**, and **React**.

---

## Project Structure

```
├── frontend/          # React + Vite + TypeScript app
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── backend/           # Node.js + Express API server
│   ├── server/
│   │   ├── index.js       ← Express entry point (port 5000)
│   │   ├── gemini.js      ← Gemini AI analysis handler
│   │   ├── supabase.js    ← Supabase admin client
│   │   └── db.js          ← In-memory session store
│   └── package.json
│
└── README.md
```

---

## Local Development

### 1. Install dependencies

```bash
# Frontend
cd frontend && npm install

# Backend
cd ../backend && npm install
```

### 2. Set up environment variables

**Frontend** (`frontend/.env.local`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Backend** (`backend/.env.local`):
```env
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
PORT=5000
```

### 3. Run both servers

Open **two terminals**:

```bash
# Terminal 1 — Backend
cd backend
npm run dev         # Starts Express on http://localhost:5000
```

```bash
# Terminal 2 — Frontend
cd frontend
npm run dev         # Starts Vite on http://localhost:5173
                    # /api/* is proxied → localhost:5000
```

Or from the **root** (runs both together):
```bash
npm run dev
```

---

## Database Setup (Supabase)

Run the SQL migration in **Supabase Dashboard → SQL Editor**:

See `supabase_migration.sql` in the project artifacts, or create tables manually:

- `violation_records` — traffic violation logs
- `ai_analysis_results` — Gemini AI upload analysis history

---

## Deployment

### Frontend → Vercel / Netlify

- **Root directory**: `frontend/`
- **Build command**: `npm run build`
- **Output directory**: `dist/`
- **Environment variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Backend → Railway / Render / Fly.io

- **Root directory**: `backend/`
- **Start command**: `node server/index.js`
- **Environment variables**: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`

After deploying the backend, add `VITE_API_BASE_URL=https://your-backend.railway.app` to your frontend env on Vercel.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express, Gemini AI (via REST) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| AI | Google Gemini 2.5 Flash |
