(function() {
  let client = null;
  let currentSession = null;
  const listeners = new Set();

  async function initClient() {
    const supabaseUrl = String(globalThis.APP_CONFIG?.SUPABASE_URL || '').trim();
    const supabasePublishableKey = String(globalThis.APP_CONFIG?.SUPABASE_PUBLISHABLE_KEY || globalThis.APP_CONFIG?.SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl || !supabasePublishableKey) {
      return null;
    }

    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    client = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });

    const { data, error } = await client.auth.getSession();
    if (error) {
      throw error;
    }

    currentSession = data.session;

    client.auth.onAuthStateChange((_event, session) => {
      currentSession = session;
      for (const listener of listeners) {
        listener(session);
      }
    });

    return client;
  }

  const ready = initClient().catch((error) => {
    console.error('Failed to initialize Supabase auth:', error.message);
    return null;
  });

  async function getSession() {
    const resolvedClient = await ready;
    if (!resolvedClient) {
      return null;
    }

    if (currentSession) {
      return currentSession;
    }

    const { data, error } = await resolvedClient.auth.getSession();
    if (error) {
      throw error;
    }

    currentSession = data.session;
    return currentSession;
  }

  globalThis.SupabaseAuth = {
    ready,
    async isConfigured() {
      return Boolean(await ready);
    },
    async signInWithOtp(email, emailRedirectTo) {
      const resolvedClient = await ready;
      if (!resolvedClient) {
        throw new Error('Supabase auth is not configured.');
      }

      const { error } = await resolvedClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo }
      });

      if (error) {
        throw error;
      }
    },
    async signOut() {
      const resolvedClient = await ready;
      if (!resolvedClient) {
        return;
      }

      const { error } = await resolvedClient.auth.signOut();
      if (error) {
        throw error;
      }
    },
    async getSession() {
      return getSession();
    },
    async getAccessToken() {
      const session = await getSession();
      return session?.access_token || '';
    },
    onAuthStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
})();