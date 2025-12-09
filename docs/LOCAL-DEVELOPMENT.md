# Local Development Guide

## Quick Start (No GitHub Setup Required)

For immediate local testing without any GitHub configuration:

### 1. Start Local Server
```bash
# Using Python (most common)
python3 -m http.server 8080

# Alternative options
python -m SimpleHTTPServer 8080  # Python 2
npx serve . -p 8080              # Node.js
php -S localhost:8080            # PHP
```

### 2. Open in Browser
- **Development version**: http://localhost:8080/index-dev.html
- **Production version**: http://localhost:8080/index.html

## Development vs Production

### Development Mode (`index-dev.html`)
- ✅ Works immediately without setup
- ✅ Data persists in browser localStorage
- ✅ Visual indicator showing dev mode
- ✅ Pre-filled with sample data
- ❌ Data not shared between users/browsers

### Production Mode (`index.html`)
- ❌ Requires GitHub token & gist setup
- ✅ Data shared across all users
- ✅ Data persists permanently in GitHub Gist
- ✅ Works on GitHub Pages

## Local Development Features

### Persistent Storage
In development mode, your coin data is saved to browser localStorage, so it persists between sessions (until you clear browser data).

### Reset Data
Open browser console and run:
```javascript
localStorage.removeItem('complaincan_data');
location.reload();
```

### Withdrawal Feature
The app includes a "Withdraw Funds" feature that:
- Archives the current period's stats, leaderboard, and history
- Resets the can to zero for a new collection period
- Requires a password (SHA-256 hashed) to confirm withdrawal
- All past withdrawals can be viewed in the "Withdrawals" history

**Note**: The withdrawal password hash is configured in `src/script.js` - look for `WITHDRAW_PASSWORD_HASH`.

### Debug Information
The console will show detailed logs about data loading/saving:
- 📱 localStorage operations
- 🔧 Development mode indicators
- 💾 Data persistence confirmations

## File Structure for Local Development

```
complain-can/
├── index-dev.html          # Development version (use this locally)
├── index.html              # Production version (GitHub Pages)
├── src/
│   ├── config-dev.js       # Development configuration
│   ├── config.js           # Production configuration
│   ├── gist-storage.js     # Storage handler (works in both modes)
│   └── script.js           # Main application logic
├── assets/
│   └── styles.css          # Styling
└── docs/
    └── LOCAL-DEVELOPMENT.md # This file
```

## Live Reload for Development

For automatic reload during development:
```bash
npx live-server --port=8080 --entry-file=index-dev.html
```

This will open the development version and reload automatically when you make changes.

## Migration to Production

When ready to deploy to GitHub Pages:
1. Follow `docs/SETUP.md` to configure GitHub integration
2. Use `index.html` instead of `index-dev.html`
3. Your development data won't transfer (you'll start fresh)