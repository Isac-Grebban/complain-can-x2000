# Worker API

This folder contains the Cloudflare Worker replacement for the current Express proxy.

## Current scope

- GitHub OAuth login and callback handling
- Signed cookie sessions
- Vote cooldown tracking through KV
- Shared state persistence through GitHub Gist or in-memory development storage
- Same API contract as the frontend already uses

## Local development

1. Copy `.dev.vars.example` to `.dev.vars`
2. Fill in the values you need
3. Run `wrangler dev`

## Deployment

Use the external setup checklist in `docs/CLOUDFLARE-PAGES-WORKERS-SETUP.md`.