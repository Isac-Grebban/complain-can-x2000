// Configuration for GitHub Pages deployment
// IMPORTANT: Follow SETUP.md for complete deployment instructions

window.CONFIG = {
  // STEP 1: Create a GitHub Personal Access Token
  // Go to: https://github.com/settings/tokens/new
  // Select scope: 'gist' (this is the only permission needed)
  // Replace 'YOUR_GITHUB_TOKEN' with your actual token
  GITHUB_TOKEN: 'YOUR_GITHUB_TOKEN',
  
  // STEP 2: Create a public gist for data storage
  // Go to: https://gist.github.com/
  // Create a public gist named 'coins.json' with content from data/coins.json
  // Replace 'YOUR_GIST_ID' with the gist ID from the URL
  GIST_ID: 'YOUR_GIST_ID',
  
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