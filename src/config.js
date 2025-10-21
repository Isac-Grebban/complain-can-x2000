// Configuration for GitHub Pages deployment
// IMPORTANT: Follow SETUP.md for complete deployment instructions

window.CONFIG = {
  // Configuration loaded from GitHub repository secrets via GitHub Actions
  // Secrets are injected during deployment, never stored in git
  GITHUB_TOKEN: window.GITHUB_CONFIG?.token || 'YOUR_GITHUB_TOKEN',
  GIST_ID: window.GITHUB_CONFIG?.gistId || 'YOUR_GIST_ID',
  
  // STEP 3: Update your GitHub username if needed
  GITHUB_USERNAME: 'andreas-heige-grebban',
  
  // Technical settings (usually don't need to change these)
  GIST_FILENAME: 'coins.json',
  
  // Fallback data used when GitHub integration is not configured
  // The app will work in "demo mode" with this data (not persistent)
  FALLBACK_DATA: {
    total: 0,
    members: {
      'Isac': 0,
      'Hannah': 0,
      'Andreas': 0,
      'Karl': 0,
      'Daniel': 0,
      'Doug': 0,
      'Marina': 0
    },
    updated: null
  }
};

// Quick setup helper: Open browser console and run createInitialGist()
// (requires setup-helper.js to be loaded)