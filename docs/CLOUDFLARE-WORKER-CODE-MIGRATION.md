# Cloudflare Worker Code Migration

This repository now contains a Worker-native backend scaffold in `worker-api/`.

## What was added

- `worker-api/src/index.js`: Worker API implementation
- `worker-api/wrangler.toml`: Wrangler project config
- `worker-api/.dev.vars.example`: local Worker environment example
- `worker-api/package.json`: local syntax-check script
- `worker-api/README.md`: quick local usage notes

## Frontend changes already made

The frontend now supports a configurable external API base URL via `src/runtime-config.js`.

By default it still uses same-origin requests.

To point the frontend at a Worker URL, set:

```js
globalThis.APP_CONFIG = {
  API_BASE_URL: 'https://your-worker.workers.dev'
};
```

before `src/api-storage.js` runs.

## Remaining integration work

1. Decide whether the Worker lives on `workers.dev` or behind a Cloudflare route.
2. Fill in real KV IDs and Worker secrets.
3. Test the auth callback flow against the real frontend origin.
4. Replace or deprecate the Express proxy once the Worker path is verified.