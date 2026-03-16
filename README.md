# Complain Can

A team app for collecting complaints and turning them into the next shared treat fund.

## Quick Start

The application now runs through a small proxy server so authentication and persistence stay off the client.

1. Run `./dev-server.sh`
2. Open `http://localhost:3000/index-dev.html`
3. Copy `proxy-server/.env.example` to `proxy-server/.env` when you are ready to enable GitHub OAuth and GitHub Gist storage

## ✨ Features

- 🪙 **Coin Collection**: Add coins for team members who complain
- 💰 **Automatic Calculation**: Converts complaints to SEK for treat funding  
- 🏆 **Leaderboard**: See who's contributing most to the treat fund
- 🏦 **Withdraw Funds**: Cash out the can and archive the period's stats
- 📊 **Statistics & History**: View complaint history and analytics
- 💰 **Withdrawal History**: Browse past withdrawals with archived leaderboards
- 🔐 **GitHub Authentication**: Authorized GitHub users only
- 🎵 **Sound Effects**: Satisfying coin drop sounds
- 📱 **Responsive Design**: Works on all devices

## Technical Details

- **Frontend**: Pure HTML, CSS, JavaScript
- **Backend**: Express proxy server
- **Authentication**: GitHub OAuth handled server-side
- **Persistence**: Local JSON in development or GitHub Gist in shared environments

## Local Development

```bash
./dev-server.sh
```

By default the proxy starts in `AUTH_MODE=development` and `STORAGE_MODE=local`, so you can work without GitHub setup. When you add `proxy-server/.env`, the same server can switch to GitHub OAuth and shared Gist persistence.

📖 **[Complete Local Development Guide →](./docs/LOCAL-DEVELOPMENT.md)**

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| **[📋 QUICK-START.md](./docs/QUICK-START.md)** | **Deployment and environment setup** |
| [☁️ CLOUDFLARE-PAGES-WORKERS-SETUP.md](./docs/CLOUDFLARE-PAGES-WORKERS-SETUP.md) | Cloudflare migration and external setup plan |
| [📖 SETUP.md](./docs/SETUP.md) | Detailed setup with troubleshooting |
| [💻 LOCAL-DEVELOPMENT.md](./docs/LOCAL-DEVELOPMENT.md) | Local development guide |

## Access Control

Set one or more of these environment variables in `proxy-server/.env` to restrict access:

- `ALLOWED_GITHUB_USERS`
- `ALLOWED_GITHUB_ORGS`
- `ALLOWED_GITHUB_EMAILS`

## License

MIT
