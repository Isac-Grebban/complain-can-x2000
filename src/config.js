// Configuration for GitHub Pages deployment
// NO EDITING REQUIRED - Secrets are loaded via GitHub Actions

window.CONFIG = {
  // GitHub secrets are automatically injected during deployment
  // See docs/QUICK-START.md for setup instructions
  GITHUB_TOKEN: window.GITHUB_CONFIG?.token || 'PLEASE_SET_REPOSITORY_SECRETS',
  GIST_ID: window.GITHUB_CONFIG?.gistId || 'PLEASE_SET_REPOSITORY_SECRETS',
  
  // Project settings (no changes needed)
  GITHUB_USERNAME: 'Isac-Grebban',
  
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
    history: [],
    updated: null
  }
};

// SETUP INSTRUCTIONS:
// 1. Add GitHub repository secrets (see docs/QUICK-START.md)
// 2. Push your code - GitHub Actions will inject secrets automatically
// 3. No manual editing of this file required!