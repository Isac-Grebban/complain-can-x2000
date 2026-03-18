# Local Development Guide

## Quick Start

The app now requires the proxy server even in local development, because authentication and persistence are handled server-side.

### 1. Start Local Server
```bash
./dev-server.sh
```

### 2. Open in Browser
- **Development version**: http://localhost:3000/index-dev.html
- **Production-style entry**: http://localhost:3000/index.html

## Development vs Production

### Development Mode
- ✅ Works immediately with local auth and local JSON storage
- ✅ Uses the same API boundary as production
- ✅ Keeps browser code free of secrets

### Shared Mode
- ✅ Uses GitHub OAuth for sign-in
- ✅ Persists shared data to GitHub Gist
- ✅ Enforces access control and rate limits on the server

## Local Development Features

### Persistent Storage
In development mode, coin data is stored in `proxy-server/data/app-state.json`.

### Reset Data
Delete the local state file and restart the proxy:
```bash
rm -f proxy-server/data/app-state.json
```

### Withdrawal Feature
The app includes a "Withdraw Funds" feature that:
- Archives the current period's stats, leaderboard, and history
- Resets the can to zero for a new collection period
- Requires a password (SHA-256 hashed) to confirm withdrawal
- All past withdrawals can be viewed in the "Withdrawals" history

**Note**: The withdrawal password hash is configured on the server through `proxy-server/.env` as `WITHDRAW_PASSWORD_HASH`.

### Debug Information
The proxy logs authentication mode, storage mode, and persistence failures in the terminal where you start it.

## File Structure for Local Development

```
complain-can/
├── index-dev.html          # Development entry
├── index.html              # Main entry
├── proxy-server/           # Auth and persistence server
├── src/
│   ├── api-storage.js      # Browser API wrapper
│   └── script.js           # Main application logic
└── assets/
    └── styles.css          # Styling
```

## Live Reload for Development

For automatic reload during development:
```bash
npx nodemon proxy-server/server.js
```

Use a separate browser tab for `http://localhost:3000/index-dev.html`.

## Migration to Production

The production app runs on Cloudflare Pages with Supabase email auth. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `ALLOWED_EMAILS` in your Cloudflare Pages environment variables.