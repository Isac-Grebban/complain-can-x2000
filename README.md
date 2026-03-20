# Complain Can

A team app for collecting complaints and turning them into the next shared treat fund.

## Quick Start

1. Run `./dev-server.sh`
2. Open `http://localhost:3000/index-dev.html`

## ✨ Features

- 🪙 **Coin Collection**: Add coins for team members who complain
- 💰 **Automatic Calculation**: Converts complaints to SEK for treat funding  
- 🏆 **Leaderboard**: See who's contributing most to the treat fund
- 🏦 **Withdraw Funds**: Cash out the can and archive the period's stats
- 📊 **Statistics & History**: View complaint history and analytics
- 💰 **Withdrawal History**: Browse past withdrawals with archived leaderboards
- 🔐 **Email Authentication**: Supabase magic link sign-in
- 🎵 **Sound Effects**: Satisfying coin sounds
- 📱 **Responsive Design**: Works on all devices

## Technical Details

- **Frontend**: Pure HTML, CSS, JavaScript
- **Backend**: Cloudflare Pages Functions (production), Express proxy (local dev)
- **Authentication**: Supabase email magic link
- **Persistence**: GitHub Gist via server-side API

## Local Development

```bash
./dev-server.sh
```

By default the proxy starts in development mode with local auth and local storage. Configure `proxy-server/.env` to enable GitHub OAuth and Gist persistence.

📖 **[Local Development Guide →](./docs/LOCAL-DEVELOPMENT.md)**

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| **[📋 QUICK-START.md](./docs/QUICK-START.md)** | Deployment and environment setup |
| [☁️ CLOUDFLARE-PAGES-WORKERS-SETUP.md](./docs/CLOUDFLARE-PAGES-WORKERS-SETUP.md) | Cloudflare Pages setup |
| [📖 SETUP.md](./docs/SETUP.md) | Detailed setup with troubleshooting |
| [💻 LOCAL-DEVELOPMENT.md](./docs/LOCAL-DEVELOPMENT.md) | Local development guide |

## Access Control

Set `ALLOWED_EMAILS` (comma-separated) in your Cloudflare Pages environment variables to restrict who can sign in.

## License

MIT
