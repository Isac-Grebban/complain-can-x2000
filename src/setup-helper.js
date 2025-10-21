// Helper script to create a new gist for your Coin data
// Run this from the browser console after setting up your GitHub token

async function createInitialGist() {
  // Check if config is loaded
  if (typeof window.CONFIG === 'undefined') {
    console.error('CONFIG not found. Make sure config.js is loaded.');
    return;
  }
  
  if (window.CONFIG.GITHUB_TOKEN === 'YOUR_GITHUB_TOKEN') {
    console.error('Please set your GitHub token in config.js first');
    return;
  }
  
  try {
    const storage = new window.GistStorage(window.CONFIG);
    
    // Use current data if available, otherwise use fallback
    let initialData;
    try {
      const response = await fetch('./data/coins.json');
      if (response.ok) {
        initialData = await response.json();
      } else {
        throw new Error('Could not load local data');
      }
    } catch {
      initialData = window.CONFIG.FALLBACK_DATA;
    }
    
    const gist = await storage.createGist(initialData);
    
    console.log('✅ Gist created successfully!');
    console.log('Gist ID:', gist.id);
    console.log('Gist URL:', gist.html_url);
    console.log('');
    console.log('Next steps:');
    console.log('1. Copy the Gist ID above');
    console.log('2. Update config.js: GIST_ID: \'' + gist.id + '\'');
    console.log('3. Save and reload the page');
    
  } catch (error) {
    console.error('❌ Failed to create gist:', error.message);
    
    if (error.message.includes('401')) {
      console.log('Make sure your GitHub token is valid and has gist scope');
    }
  }
}

// Make it available globally
window.createInitialGist = createInitialGist;

console.log('Helper loaded! Run createInitialGist() to create your initial gist.');