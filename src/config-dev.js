// Development configuration for local testing
// This config works without GitHub integration - perfect for local development

window.CONFIG = {
  // Development mode - no GitHub integration needed
  GITHUB_TOKEN: 'DEV_MODE',
  GIST_ID: 'DEV_MODE',
  GITHUB_USERNAME: 'andreas-heige-grebban',
  GIST_FILENAME: 'coins.json',
  
  // In dev mode, this data will be used and persist in localStorage
  FALLBACK_DATA: {
    total: 3,
    members: {
      'Isac': 1,
      'Hannah': 0,
      'Andreas': 2,
      'Karl': 0,
      'Daniel': 0,
      'Doug': 0,
      'Marina': 0
    },
    updated: new Date().toISOString()
  }
};