# 🎬 FilmForge

**AI-powered film pre-production automation.** Upload a script, get instant scene breakdowns, character lists, props, costumes, locations, shooting schedules, call sheets, and budget estimates — all generated from a single screenplay.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + Tailwind CSS 3 |
| **Backend** | Node.js + Express |
| **Database** | SQLite via Turso (team-db) |
| **AI Services** | Python microservices |
| **Authentication** | Email + Magic Link (in progress) |

## Project Structure

```
filmforge/
├── frontend/                 # React + Vite + Tailwind SPA
│   ├── src/
│   │   ├── pages/            # Page components (Landing, NotFound, etc.)
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── utils/            # Utility functions
│   │   ├── App.jsx           # Root app with routing
│   │   └── main.jsx          # Entry point
│   ├── index.html
│   ├── vite.config.js        # Vite config with API proxy
│   ├── tailwind.config.js    # Tailwind config with brand tokens
│   └── package.json
├── backend/                  # Express API server
│   ├── routes/               # API route handlers
│   ├── middleware/            # Express middleware
│   ├── models/               # Data models
│   ├── services/             # Business logic services
│   ├── uploads/              # User-uploaded script files
│   ├── server.js             # Express app entry
│   └── package.json
├── services/
│   └── ai/                   # AI microservices (Python)
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd ../backend && npm install
```

### Development

Run both frontend and backend simultaneously:

```bash
# Terminal 1 — Backend API (port 8000)
cd backend && npm run dev

# Terminal 2 — Frontend dev server (port 3000)
cd frontend && npm run dev
```

The frontend dev server proxies `/api` requests to the backend automatically.

### Production Build

```bash
# Build the frontend
cd frontend && npm run build

# Start the production server (serves frontend + API)
cd backend && npm start
```

## Features (Roadmap)

- [x] Project scaffold (Vite + Express + Tailwind)
- [ ] User authentication (email + magic link)
- [ ] Script upload (paste or .fdx/.pdf/.txt)
- [ ] AI-powered screenplay parsing
- [ ] Scene breakdowns display
- [ ] Character, prop, costume, location lists
- [ ] Shooting schedule & stripboard
- [ ] Call sheet generation
- [ ] Budget estimation
- [ ] PDF & Excel exports
- [ ] Dashboard & project management

## License

MIT — see [LICENSE](LICENSE) for details.