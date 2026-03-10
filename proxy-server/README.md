# Proxy Server

This service handles three responsibilities that should not live in the browser:

- GitHub authentication
- Server-side session management
- Shared persistence to either local disk or GitHub Gist

## Environment

Copy `.env.example` to `.env` and fill in the values you need.

## Modes

- `AUTH_MODE=github`: Uses GitHub OAuth and optional allowlists.
- `AUTH_MODE=development`: Creates a local development session without GitHub.
- `STORAGE_MODE=gist`: Reads and writes shared state through GitHub Gist.
- `STORAGE_MODE=local`: Stores state in `proxy-server/data/app-state.json`.

## Run

```bash
npm install
npm start
```