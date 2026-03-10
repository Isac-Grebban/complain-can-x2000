class ApiStorage {
  async request(path, options = {}) {
    const headers = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    };

    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'string'
        ? payload
        : payload?.error || payload?.message || `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async getBootstrap() {
    return this.request('/api/bootstrap');
  }

  async getSession() {
    return this.request('/api/auth/session');
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  async loadData() {
    return this.request('/api/state');
  }

  async addCoin(member) {
    return this.request('/api/coins', {
      method: 'POST',
      body: JSON.stringify({ member })
    });
  }

  async withdraw(payload) {
    return this.request('/api/withdraw', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async resetData() {
    return this.request('/api/reset', { method: 'POST' });
  }
}

globalThis.ApiStorage = ApiStorage;