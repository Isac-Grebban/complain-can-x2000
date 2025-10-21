# Legacy Server Implementation

This folder contains the original Node.js server implementation of the Complain Can app. These files are **no longer needed** for the GitHub Pages deployment but are kept for reference.

## Files in this folder:

- **`server.js`** - Original Express.js server
- **`package.json`** - Node.js dependencies (not needed for GitHub Pages)
- **`package-lock.json`** - Lock file for Node dependencies
- **`Dockerfile`** - Docker configuration for server deployment
- **`.dockerignore`** - Docker ignore file
- **`generate-hash.js`** - Hash generation utility

## Why these files are no longer needed:

The app has been refactored to be **100% client-side** and uses GitHub Gists for data persistence instead of a server. This allows deployment to GitHub Pages without any backend infrastructure.

## If you want to run the legacy server version:

```bash
cd legacy-server
npm install
node server.js
```

Then visit `http://localhost:3000`

## Migration Notes:

- The new client-side version maintains all the same functionality
- Data persistence now uses GitHub Gists instead of local JSON files
- Email validation is now client-side
- Rate limiting is now client-side (less secure but functional)

For the current implementation, see the root directory files and follow `SETUP.md` for GitHub Pages deployment.