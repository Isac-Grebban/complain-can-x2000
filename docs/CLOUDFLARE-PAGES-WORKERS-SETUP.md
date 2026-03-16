# Cloudflare Pages + Workers Setup Guide

This guide covers the external setup needed to move the app from GitHub Pages plus an Express proxy to Cloudflare Pages plus Workers.

It is written against the current repository state, where:

- the frontend is plain HTML, CSS, and JavaScript
- the frontend currently calls relative `/api/*` endpoints
- the backend logic currently exists as an Express server in `proxy-server/server.js`
- shared persistence still targets GitHub Gist

## Goal

Target architecture:

- Cloudflare Pages hosts the frontend
- Cloudflare Workers hosts the API
- Cloudflare KV stores cooldown state and any lightweight transient state
- GitHub OAuth authenticates users
- GitHub Gist stores shared complaint data
- GitHub Pages can remain alive as a redirect-only entrypoint

## Important Current-State Note

This guide sets up the external services first.

The repository still needs a follow-up code migration before production will work on Cloudflare:

- replace the Express server with a Worker-compatible API
- make the frontend use a configurable API base URL instead of same-origin `/api/*`
- add Worker-compatible session and OAuth-state handling
- add CORS or same-zone routing behavior depending on final Cloudflare layout

In other words: this document prepares the hosting, auth, and secret setup so the code migration can slot into a known environment.

## Plan

Phase 1: Create and configure the external services.

1. Create a Cloudflare account.
2. Create a Cloudflare Pages project for the frontend.
3. Create a Cloudflare Worker for the API.
4. Create a KV namespace for cooldown and lightweight transient state.
5. Create a GitHub OAuth app.
6. Create or reuse the GitHub Gist used for shared data.
7. Add all required secrets and variables to Cloudflare.

Phase 2: Update the repository to target Cloudflare.

1. Add Worker-native API code.
2. Add Wrangler configuration.
3. Make the frontend read an explicit API base URL.
4. Point login/logout/session/state requests to the Worker.
5. Add an optional GitHub Pages redirect page.

Phase 3: Deploy and verify.

1. Deploy the Worker.
2. Deploy the frontend to Cloudflare Pages.
3. Validate GitHub login.
4. Validate state loading, voting, and withdrawal.
5. Turn GitHub Pages into a redirect-only page.

## What You Need Before Starting

Accounts:

- GitHub account with access to this repository
- Cloudflare account

Values you will create or collect:

- Cloudflare Pages project name
- Cloudflare Worker name
- Cloudflare KV namespace ID
- GitHub OAuth client ID
- GitHub OAuth client secret
- GitHub Gist ID
- GitHub token with `gist` scope
- session secret
- withdrawal password hash

## External Setup Checklist

Complete these in order.

### Step 1: Create or Confirm the GitHub Gist

Purpose: This remains the shared persistence layer.

1. Go to `https://gist.github.com/`.
2. Create a public gist if you do not already have one.
3. Name the file `coins.json`.
4. Use this starter content:

```json
{
  "total": 0,
  "members": {
    "Isac": 0,
    "Hannah": 0,
    "Andreas": 0,
    "Karl": 0,
    "Daniel": 0,
    "Doug": 0,
    "Marina": 0
  },
  "history": [],
  "withdrawals": [],
  "updated": null
}
```

5. Save the gist.
6. Copy the gist ID from the URL.

You will use this later as `GIST_ID`.

### Step 2: Create a GitHub Token for Gist Access

Purpose: The backend will use this token to read and write the shared gist.

1. Go to `https://github.com/settings/tokens/new`.
2. Create a classic personal access token or fine-grained equivalent that can access the target gist.
3. Grant only the minimum required Gist access.
4. Copy the token immediately.

You will use this later as `GITHUB_STORAGE_TOKEN`.

### Step 3: Create a Cloudflare Pages Project

Purpose: This will host the frontend.

1. Sign in to Cloudflare.
2. Go to `Workers & Pages`.
3. Choose `Create application`.
4. Choose `Pages`.
5. Connect the GitHub repository.
6. Select this repository.
7. Choose a project name.
8. Leave build settings simple if you are still deploying a static frontend.

Recommended initial settings for a static deployment:

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `.` or the eventual static output directory if you later add one

Record these values:

- the Pages project name
- the public `*.pages.dev` URL

### Step 4: Create a Cloudflare Worker for the API

Purpose: This will replace the current Express proxy.

1. In Cloudflare, go to `Workers & Pages`.
2. Choose `Create application`.
3. Choose `Workers`.
4. Create a Worker with a name like `complain-can-api`.
5. Record the Worker URL.

You will use the Worker URL for:

- the GitHub OAuth callback
- frontend API requests

### Step 5: Create a KV Namespace

Purpose: Store cooldown or other lightweight transient state that cannot live in in-memory maps inside Workers.

1. In Cloudflare, go to `Workers & Pages`.
2. Open `KV`.
3. Create a namespace.
4. Use a name like `complain-can-state`.
5. Record the namespace ID.

Expected initial use:

- vote cooldown tracking
- optional short-lived OAuth state or session adjuncts if needed during implementation

### Step 6: Create a GitHub OAuth App

Purpose: Authenticate users through GitHub.

1. Go to `https://github.com/settings/developers`.
2. Choose `OAuth Apps`.
3. Create a new OAuth app.
4. Fill in these values:

- Application name: `Complain Can`
- Homepage URL: your Cloudflare Pages URL
- Authorization callback URL: your Worker callback URL

The callback should eventually be:

```text
https://<your-worker-host>/api/auth/callback
```

If you later place the Worker behind the same hostname as Pages, use that final callback URL instead.

5. Save the app.
6. Copy the client ID.
7. Generate and copy the client secret.

You will use these later as:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

### Step 7: Generate the Session Secret

Purpose: Sign cookies or signed tokens used by the Worker.

Generate a long random string locally, for example with:

```bash
openssl rand -base64 48
```

Store the result securely.

You will use it later as `SESSION_SECRET`.

### Step 8: Generate the Withdrawal Password Hash

Purpose: Keep the withdrawal password out of client code and store only the hash in the backend environment.

Generate a SHA-256 hash of the withdrawal password locally.

Example using Node:

```bash
node -e "const crypto=require('node:crypto'); console.log(crypto.createHash('sha256').update(process.argv[1]).digest('hex'))" "your-password-here"
```

Copy the resulting hex string.

You will use it later as `WITHDRAW_PASSWORD_HASH`.

### Step 9: Configure Worker Secrets and Variables

Purpose: Put all runtime configuration into Cloudflare instead of source control.

Add these secrets or environment variables to the Worker project:

Required:

- `AUTH_MODE=github`
- `STORAGE_MODE=gist`
- `GITHUB_STORAGE_TOKEN=<your gist token>`
- `GIST_ID=<your gist id>`
- `GIST_FILENAME=coins.json`
- `GITHUB_OAUTH_CLIENT_ID=<client id>`
- `GITHUB_OAUTH_CLIENT_SECRET=<client secret>`
- `GITHUB_OAUTH_CALLBACK_URL=https://<your-worker-host>/api/auth/callback`
- `SESSION_SECRET=<long random secret>`
- `WITHDRAW_PASSWORD_HASH=<sha256 hash>`

Optional allowlists:

- `ALLOWED_GITHUB_USERS`
- `ALLOWED_GITHUB_ORGS`
- `ALLOWED_GITHUB_EMAILS`

If you want only specific GitHub users to access the app, fill at least one of those optional values.

### Step 10: Bind the KV Namespace to the Worker

Purpose: Make the namespace available to Worker code.

In the Worker settings, bind the KV namespace to a variable such as:

```text
COOLDOWN_KV
```

Keep the binding name consistent with the future Worker implementation.

### Step 11: Configure the Pages Project Environment

Purpose: Make frontend builds aware of the backend endpoint if needed.

At minimum, record the final Worker API base URL.

Expected future frontend variable:

- `API_BASE_URL=https://<your-worker-host>`

Whether this is injected at build time or stored in a small runtime config file depends on the final implementation.

### Step 12: Decide the Final URL Layout

You have two viable layouts.

Option A: Separate origins

- Frontend: `https://<project>.pages.dev`
- API: `https://<worker>.workers.dev`

This is simplest to start, but requires CORS and cross-site cookie handling.

Option B: Same-zone routing through Cloudflare

- Frontend and API share a common top-level site under Cloudflare routing

This is cleaner long-term, but requires more routing setup.

For initial rollout, choose Option A unless you already know you want a more integrated setup.

### Step 13: Plan the GitHub Pages Redirect

Purpose: Preserve the old GitHub Pages URL as an entrypoint.

After the new frontend is live, change the GitHub Pages `index.html` into a redirect-only page that sends users to the Cloudflare Pages URL.

This should happen only after Cloudflare is deployed and verified.

## Repository Work Still Needed After External Setup

Once the external pieces above exist, the repository still needs these code changes:

1. Replace the Express backend with Worker-native route handlers.
2. Replace in-memory `sessions`, `oauthStates`, and `voteCooldowns` with Worker-safe equivalents.
3. Add Wrangler configuration.
4. Make the frontend read a configurable API base URL.
5. Support either:

- same-site auth if frontend and API are routed together, or
- cross-origin requests plus secure cookies if frontend and API stay on separate origins

6. Update docs to reflect Cloudflare deployment instead of the current Express-proxy local architecture.

## Suggested Order For The Actual Migration

Once external setup is complete, implement in this order:

1. Add Worker project files in the repo.
2. Port `/api/bootstrap`, `/api/auth/*`, `/api/state`, `/api/coins`, and `/api/withdraw` to the Worker.
3. Add KV-backed cooldown storage.
4. Add signed session cookie handling.
5. Update `src/api-storage.js` to use an explicit API base URL.
6. Deploy the Worker.
7. Deploy the frontend to Pages.
8. Test login, callback, session restore, vote, withdrawal, and persistence.
9. Convert GitHub Pages to a redirect-only page.

## Validation Checklist

When everything is deployed, validate these in order:

1. Pages site loads on `*.pages.dev`.
2. Login button redirects to GitHub.
3. GitHub callback returns the user to the app.
4. Session survives page refresh.
5. State loads from the gist.
6. A vote increments total and member counts.
7. Rate limiting still works.
8. Withdrawal works with the configured password.
9. GitHub Pages old URL redirects to the new frontend URL.

## External Values Worksheet

Fill these in as you create them:

```text
Cloudflare Pages URL:
Cloudflare Worker URL:
Cloudflare KV namespace ID:
GitHub OAuth client ID:
GitHub OAuth client secret:
GitHub OAuth callback URL:
GitHub Gist ID:
GitHub storage token:
Session secret:
Withdrawal password hash:
Allowed GitHub users:
Allowed GitHub orgs:
Allowed GitHub emails:
```

## Recommended Decision Summary

If you want the cleanest end state:

- move the real frontend from GitHub Pages to Cloudflare Pages
- move the backend from Express to Cloudflare Workers
- keep GitHub Gist as persistence for now
- keep GitHub Pages only as a redirect entrypoint

That gives you a free Cloudflare-hosted frontend and API, while preserving the existing external data model.