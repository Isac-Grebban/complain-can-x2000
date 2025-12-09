# Complain Can 🪙

A fun team application to collect "complaints" and turn them into team treats! Every complaint adds a coin to the can, building up funds for the next team beer or coffee run.

##  Quick Start

**Deploy to GitHub Pages** (no server required):
1. **[� Follow Quick-Start Guide](./docs/QUICK-START.md)** (~10 minutes)
2. **[� Local Development](./docs/LOCAL-DEVELOPMENT.md)** (instant setup)

**Why GitHub Pages?** Uses GitHub Gists as backend storage - no server maintenance needed!

## ✨ Features

- 🪙 **Coin Collection**: Add coins for team members who complain
- 💰 **Automatic Calculation**: Converts complaints to SEK for treat funding  
- 🏆 **Leaderboard**: See who's contributing most to the treat fund
- 🏦 **Withdraw Funds**: Cash out the can and archive the period's stats
- 📊 **Statistics & History**: View complaint history and analytics
- 💰 **Withdrawal History**: Browse past withdrawals with archived leaderboards
- 🔐 **Email Authentication**: Authorized team members only
- 🎵 **Sound Effects**: Satisfying coin drop sounds
- 📱 **Responsive Design**: Works on all devices

## 🔧 Technical Details

- **Frontend**: Pure HTML, CSS, JavaScript (no build process)
- **Backend**: GitHub Gists API for data persistence
- **Authentication**: Client-side email validation
- **Deployment**: GitHub Pages with GitHub Actions

## 💻 Local Development

No GitHub setup required for local testing:

```bash
./dev-server.sh
# Open: http://localhost:8080/index-dev.html
```

**Development mode** uses localStorage - perfect for immediate testing!  
**Production mode** requires GitHub Actions deployment.

📖 **[Complete Local Development Guide →](./docs/LOCAL-DEVELOPMENT.md)**

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| **[📋 QUICK-START.md](./docs/QUICK-START.md)** | **Step-by-step deployment (~10 min)** |
| [📖 SETUP.md](./docs/SETUP.md) | Detailed setup with troubleshooting |
| [💻 LOCAL-DEVELOPMENT.md](./docs/LOCAL-DEVELOPMENT.md) | Local development guide |

## 🏛️ Legacy Server Version

The original Express.js server version is archived in [`legacy-server/`](./legacy-server/) for reference. The GitHub Pages version is recommended for new deployments.

## 🔐 Adding Team Members

Edit `allowed-emails.json` to add authorized email addresses (emails are hashed for security).

## License

MIT
