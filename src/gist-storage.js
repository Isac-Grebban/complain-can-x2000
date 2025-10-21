// GitHub Gist storage for shared coin data
class GistStorage {
  constructor(config) {
    this.token = config.GITHUB_TOKEN;
    this.gistId = config.GIST_ID;
    this.filename = config.GIST_FILENAME;
    this.fallbackData = config.FALLBACK_DATA;
    this.baseUrl = 'https://api.github.com/gists';
    
    // Development mode detection
    this.isDevMode = this.token === 'DEV_MODE' || this.gistId === 'DEV_MODE';
    this.localStorageKey = 'complaincan_data';
    
    if (this.isDevMode) {
      console.log('🔧 Running in development mode - using localStorage for persistence');
    }
  }

  async loadData() {
    // Development mode: use localStorage
    if (this.isDevMode) {
      try {
        const stored = localStorage.getItem(this.localStorageKey);
        if (stored) {
          const data = JSON.parse(stored);
          console.log('📱 Loaded data from localStorage:', data);
          return data;
        } else {
          console.log('📱 No stored data found, using fallback');
          return { ...this.fallbackData };
        }
      } catch (error) {
        console.warn('Failed to load from localStorage:', error.message);
        return { ...this.fallbackData };
      }
    }

    // Production mode: use GitHub Gist
    try {
      const response = await fetch(`${this.baseUrl}/${this.gistId}`, {
        headers: this.token ? {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        } : {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch gist: ${response.status}`);
      }

      const gist = await response.json();
      const fileContent = gist.files[this.filename];
      
      if (!fileContent) {
        throw new Error(`File ${this.filename} not found in gist`);
      }

      const data = JSON.parse(fileContent.content);
      
      // Validate data structure
      if (!data.hasOwnProperty('total') || !data.hasOwnProperty('members')) {
        throw new Error('Invalid data structure in gist');
      }

      return data;
    } catch (error) {
      console.warn('Failed to load from gist:', error.message);
      console.warn('Using fallback data');
      return { ...this.fallbackData };
    }
  }

  async saveData(data) {
    // Add timestamp
    const dataToSave = {
      ...data,
      updated: new Date().toISOString()
    };

    // Development mode: use localStorage
    if (this.isDevMode) {
      try {
        localStorage.setItem(this.localStorageKey, JSON.stringify(dataToSave));
        console.log('💾 Saved data to localStorage:', dataToSave);
        return dataToSave;
      } catch (error) {
        console.error('Failed to save to localStorage:', error.message);
        throw error;
      }
    }

    // Production mode: use GitHub Gist
    if (!this.token || this.token === 'YOUR_GITHUB_TOKEN') {
      throw new Error('GitHub token not configured. Please set your GitHub Personal Access Token in config.js');
    }

    if (!this.gistId || this.gistId === 'YOUR_GIST_ID') {
      throw new Error('Gist ID not configured. Please create a gist and set the ID in config.js');
    }

    try {
      const response = await fetch(`${this.baseUrl}/${this.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: {
            [this.filename]: {
              content: JSON.stringify(dataToSave, null, 2)
            }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update gist: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return JSON.parse(result.files[this.filename].content);
    } catch (error) {
      console.error('Failed to save to gist:', error.message);
      throw error;
    }
  }

  async resetData() {
    const freshData = { ...this.fallbackData };
    return await this.saveData(freshData);
  }

  // Helper method to create a new gist (for initial setup)
  async createGist(initialData = null) {
    if (!this.token || this.token === 'YOUR_GITHUB_TOKEN') {
      throw new Error('GitHub token required to create gist');
    }

    const data = initialData || this.fallbackData;
    data.updated = new Date().toISOString();

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Complain Can - Coin Counter Data',
          public: true, // Make it public so GitHub Pages can read it
          files: {
            [this.filename]: {
              content: JSON.stringify(data, null, 2)
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create gist: ${response.status}`);
      }

      const gist = await response.json();
      console.log('Created gist with ID:', gist.id);
      console.log('Update your config.js with: GIST_ID: \'' + gist.id + '\'');
      return gist;
    } catch (error) {
      console.error('Failed to create gist:', error.message);
      throw error;
    }
  }
}

// Make it available globally
window.GistStorage = GistStorage;