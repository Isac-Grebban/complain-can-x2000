# Complain Can 🪙

A fun team application to collect "complaints" and turn them into team treats! Every complaint adds a coin to the can, building up funds for the next team beer or coffee run.

## 📖 Table of Contents

- [🚀 GitHub Pages Deployment](#-github-pages-deployment)
- [✨ Features](#-features)
- [🔧 Technical Details](#-technical-details)
- [💻 Local Development](#-local-development)
- [📁 Project Structure](#-project-structure)
- [🏛️ Legacy Server Version](#️-legacy-server-version)

## 🚀 GitHub Pages Deployment

This app has been refactored to work on GitHub Pages without a server! It uses GitHub Gists as a backend for shared data storage.

### 📚 Documentation

| Guide | Purpose | Time |
|-------|---------|------|
| **[📋 QUICK-START.md](./docs/QUICK-START.md)** | **Step-by-step deployment guide** | **~10 min** |
| [📖 SETUP.md](./docs/SETUP.md) | Detailed setup instructions | 15 min |
| [💻 LOCAL-DEVELOPMENT.md](./docs/LOCAL-DEVELOPMENT.md) | Local development guide | 5 min |

### ⚡ Quick Deploy
1. **[Create GitHub token](https://github.com/settings/tokens/new)** with `gist` scope
2. **[Create public gist](https://gist.github.com/)** with coin data
3. **Update `src/config.js`** with your token & gist ID
4. **Enable GitHub Pages** in repository settings
5. **Done!** 🎉

👉 **[📋 Follow the complete Quick-Start Guide →](./docs/QUICK-START.md)**

> 🆕 **NEW**: We've created a visual, step-by-step guide that makes deployment super easy!

## ✨ Features

- 🪙 **Coin Collection**: Add coins for team members who complain
- 💰 **Automatic Calculation**: Converts complaints to SEK for treat funding
- 🏆 **Leaderboard**: See who's contributing most to the treat fund
- 🔐 **Email Authentication**: Authorized team members only
- ⏱️ **Rate Limiting**: Prevents spam clicking
- 🎵 **Sound Effects**: Satisfying coin drop sounds
- 📱 **Responsive Design**: Works on all devices

## 🔧 Technical Details

- **Frontend**: Pure HTML, CSS, JavaScript (no build process required)
- **Backend**: GitHub Gists API for data persistence
- **Authentication**: Client-side email validation
- **Deployment**: GitHub Pages compatible

### Security Considerations

- Uses minimal GitHub token scope (gist only)
- Email validation is client-side (suitable for internal team use)
- Rate limiting is client-side (less secure but functional)
- All data is stored in public gists (consider privacy needs)

## 💻 Local Development

The app supports full local development without any GitHub setup required!

#### Quick Start - Development Mode
```bash
# Option 1: Use the helper script
./dev-server.sh

# Option 2: Manual server start
python3 -m http.server 8080
# Then open: http://localhost:8080/index-dev.html
```

#### Development vs Production
- **`index-dev.html`**: Immediate testing, localStorage persistence, no GitHub setup needed
- **`index.html`**: Full production mode, requires GitHub token and gist setup

#### Available Development Files
- `docs/LOCAL-DEVELOPMENT.md` - Detailed local development guide
- `src/config-dev.js` - Development configuration (no GitHub needed)
- `dev-server.sh` - Convenience script to start local server
- `index-dev.html` - Development version with localStorage persistence

#### Live Development
```bash
# For automatic reload during development
npx live-server --port=8080 --entry-file=index-dev.html
```

See [LOCAL-DEVELOPMENT.md](./docs/LOCAL-DEVELOPMENT.md) for complete local development instructions.

## Project Structure

```
complain-can/
├── index.html              # Main application (production)
├── index-dev.html          # Development version
├── allowed-emails.json     # Authorized email addresses
├── dev-server.sh          # Development server helper
├── src/                   # Source code
│   ├── config.js          # Production configuration
│   ├── config-dev.js      # Development configuration
│   ├── script.js          # Main application logic
│   ├── gist-storage.js    # GitHub Gist storage handler
│   └── setup-helper.js    # Setup utilities
├── assets/                # Static assets
│   ├── styles.css         # Application styles
│   ├── favicon.ico        # Site icon
│   └── *.mp3             # Sound effects
├── docs/                  # Documentation
│   ├── SETUP.md           # GitHub Pages deployment guide
│   └── LOCAL-DEVELOPMENT.md # Local development guide
├── data/                  # Reference data
│   └── coins.json         # Initial data structure
└── legacy-server/         # Original server implementation (archived)
    ├── server.js          # Express.js server
    ├── package.json       # Node.js dependencies
    └── README.md          # Legacy documentation
```

## Legacy Server Version

The original server-based version has been moved to `legacy-server/` folder. It's kept for reference but not needed for GitHub Pages deployment. See `legacy-server/README.md` for details.

A tiny, static web app: whenever someone on the team complains, they add a virtual coin to the glass can. Acts as a fun micro-fund toward a future team treat.

## Features
- 🔐 **Email-based login** with SHA-256 hashed authorization (no passwords stored!)
- Enlarged glass jar / bottle visual built with pure CSS (no images required)
- Responsive layout (mobile + desktop) using fluid units and `clamp()`
- Realistic falling coins: each coin animates from above the jar to a stacked position (prefers-reduced-motion respected)
- Count persisted locally via `localStorage`
- Accessible: ARIA live region for count updates, focus-visible styles
- Minimal JavaScript (just state, stacking math & DOM updates)
- Member-specific buttons and per-member statistics
- Node.js backend persistence (JSON file + append-only log) when run locally
- Graceful fallback to localStorage if backend unreachable
- MP3 coin drop sound respecting reduced-motion preference
- Each coin equals 5 SEK (displayed as "5:-" on coin face and totals in UI)
- Random coin colors (gold, silver, bronze) for visual variety
- Multi-layer coin stacking inside the jar

## Authentication

The app requires login with an authorized email address. Emails are hashed with SHA-256 and never stored in plain text.

### Adding Authorized Users

1. Generate a hash for the email:
```sh
node generate-hash.js user@example.com
```

2. Copy the generated hash and add it to `allowed-emails.json`:
```json
{
  "allowedHashes": [
    "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    "your-new-hash-here"
  ]
}
```

3. Restart the server if running

### Security Note
- Emails are normalized (lowercased, trimmed) before hashing
- Hashes are compared server-side
- Sessions are stored in browser sessionStorage (cleared on tab close)
- No passwords required or stored

## Files
- `index.html` – semantic structure and controls
- `styles.css` – jar design, coins, responsiveness, theming vars
- `script.js` – coin logic, persistence, animation injection
- `README.md` – this documentation

## How to Run
Just open `index.html` in a browser.

### Optional local dev server (macOS / zsh)
```sh
python3 -m http.server 8080
# Visit http://localhost:8080
```
Or with Node:
```sh
npx serve .
```

### Backend persistence server
Start the Express server (requires Node 18+):
```sh
node server.js
```
It serves static files and exposes:
```
GET  /api/coins      -> { total, members, updated }
POST /api/coins      -> body: { member: "Name" } returns updated state
```
Data stored in `data/coins.json` and each event appended to `data/coins.log`.
Client auto-detects server availability (localhost) and falls back silently if offline.

### Docker

Build image (from project root):
```sh
docker build -t complaint-can:latest .
```
Run container mapping port and persisting data via a volume:
```sh
docker run -d --name complaint-can -p 3000:3000 -v $(pwd)/data:/app/data complaint-can:latest
```
Test API:
```sh
curl http://localhost:3000/api/coins
curl -X POST -H 'Content-Type: application/json' -d '{"member":"Isac"}' http://localhost:3000/api/coins
```
The `coins.json` file inside `./data` will update atomically; events append to `coins.log`.

### Why not GitHub Pages for backend?
GitHub Pages hosts only static files (HTML/CSS/JS). It cannot run a Node/Express server or a Docker container. To have shared persistence you need a runtime environment.

### Free hosting options (containers / Node)
| Need | Option | Notes |
|------|--------|-------|
| Full container | Render | Fast deploy; free tier sleeps; mount persistent disk (paid) or rely on internal storage (can reset). |
| Full container | Railway | Generous free usage; ephemeral disk so consider external storage. |
| Full container | Fly.io | Deploy close to region; volume storage costs after free allowance. |
| Node serverless | Vercel | Easy; use serverless functions (no long-lived file writes); switch to KV / Postgres add-on. |
| Edge worker | Cloudflare Workers | Durable Objects / KV for persistent counts; no container needed. |

### Persistence considerations
Writing to a JSON file works locally and in a single container with a mounted volume. In most free tiers, the filesystem may be ephemeral—data can vanish on redeploy or sleep. For reliable shared storage consider:
1. Cloud KV / Document store (Cloudflare KV, Upstash Redis, Supabase, Firebase).
2. Hosted Postgres (Supabase / Neon) with a single table: `events(id serial, member text, created timestamptz)` and a view for counts.
3. Durable Object (Cloudflare) or Vercel KV for simple key increments.

### Switching to an external API base
Set an environment variable before build/run:
```sh
export PUBLIC_API_BASE="https://your-deployed-host.example"
```
Then in `script.js` replace automatic localhost detection with:
```js
const API_BASE = globalThis.PUBLIC_API_BASE || '';
```
(Or embed via build tool.)

### Graceful container stop
Current server uses `app.listen`; for production you might add process signal handlers:
```js
process.on('SIGTERM', ()=> server.close(()=> process.exit(0)));
```
Not required for this simple app but improves shutdown behavior.

## Customization
- Change coin color: edit `--coin-color` / gradients in `:root`.
- Adjust max visual coins: modify `maxVisual` in `renderCoins()`.
- Replace cent symbol: edit `.coin::after` content in CSS.
- Coin fall duration: adjust `coinFall` keyframe timing in `styles.css`.
- Horizontal density: tweak `perRow` via formula in `createPositionedCoin()`.
- Member coin colors: edit `.coin.<member>` border colors in `styles.css`.
- Sound tweak: adjust oscillator frequencies in `playCoinSound()` inside `script.js`.
 - Currency value: change `VALUE_PER_COIN` in `script.js` (currently 5 for SEK).

## Accessibility
- Button uses native semantics; count region has `role="status"` and `aria-live="polite"`.
- Motion reduced when user prefers reduced motion.
- High contrast accents and focus outline.

## Persistence Scope
Currently per-browser (localStorage). For a shared team tally, consider:
1. Lightweight serverless DB (Firebase / Supabase) + simple fetch/POST.
2. Tiny self-hosted endpoint (Express, Fastify, or Cloudflare Worker).
3. GitHub Pages + third-party counter API (ensure CORS & rate limits).

If deploying backend remotely, remove localhost origin check and set `API_BASE` accordingly.

## Next Steps (Backend Option Example)
```text
POST /api/coins -> increments and returns new count
GET  /api/coins -> returns current count
```
Returned JSON:
```json
{ "count": 42 }
```

## License
MIT
