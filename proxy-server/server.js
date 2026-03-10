#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const LOCAL_STATE_FILE = path.join(DATA_DIR, 'app-state.json');
const MEMBERS = ['Isac', 'Hannah', 'Andreas', 'Karl', 'Daniel', 'Doug', 'Marina'];
const VALUE_PER_COIN = 5;
const RATE_LIMIT_MS = 30_000;
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_COOKIE_NAME = 'complain_can_session';
const DEFAULT_PORT = Number.parseInt(process.env.PORT || '3000', 10);

const sessionSecret = process.env.SESSION_SECRET || 'development-session-secret';
const authMode = (process.env.AUTH_MODE || (process.env.GITHUB_OAUTH_CLIENT_ID ? 'github' : 'development')).toLowerCase();
const storageMode = (process.env.STORAGE_MODE || (process.env.GIST_ID && process.env.GITHUB_STORAGE_TOKEN ? 'gist' : 'local')).toLowerCase();
const gistId = process.env.GIST_ID || '';
const gistFilename = process.env.GIST_FILENAME || 'coins.json';
const githubStorageToken = process.env.GITHUB_STORAGE_TOKEN || '';
const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID || '';
const githubClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET || '';
const githubCallbackUrl = process.env.GITHUB_OAUTH_CALLBACK_URL || `http://localhost:${DEFAULT_PORT}/api/auth/callback`;
const withdrawPasswordHash = (process.env.WITHDRAW_PASSWORD_HASH || '').trim().toLowerCase();

const allowedGithubUsers = splitList(process.env.ALLOWED_GITHUB_USERS);
const allowedGithubOrgs = splitList(process.env.ALLOWED_GITHUB_ORGS);
const allowedGithubEmails = splitList(process.env.ALLOWED_GITHUB_EMAILS);

const sessions = new Map();
const oauthStates = new Map();
const voteCooldowns = new Map();
let storageQueue = Promise.resolve();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  req.session = getSessionFromRequest(req);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, authMode, storageMode });
});

app.get('/api/bootstrap', (_req, res) => {
  res.json({
    authMode,
    storageMode,
    loginPath: '/api/auth/login',
    logoutPath: '/api/auth/logout',
    rateLimitMs: RATE_LIMIT_MS
  });
});

app.get('/api/auth/session', (req, res) => {
  if (!req.session) {
    return res.json({ authenticated: false, authMode });
  }

  res.json({
    authenticated: true,
    authMode,
    user: publicUser(req.session.user)
  });
});

app.get('/api/auth/login', async (req, res) => {
  const nextPath = sanitizeNextPath(req.query.next);

  if (authMode === 'development') {
    const session = createSession({
      login: process.env.DEV_AUTH_LOGIN || 'local-dev',
      displayName: process.env.DEV_AUTH_USER || 'Local Dev',
      email: 'local@example.test',
      avatarUrl: '',
      provider: 'development'
    });

    setSessionCookie(res, session.id);
    return res.redirect(nextPath);
  }

  if (!githubClientId || !githubClientSecret) {
    return res.status(500).json({ error: 'GitHub OAuth is not configured on the server.' });
  }

  const stateId = crypto.randomUUID();
  oauthStates.set(stateId, {
    nextPath,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS
  });

  cleanupExpiredOauthStates();

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', githubClientId);
  authorizeUrl.searchParams.set('redirect_uri', githubCallbackUrl);
  authorizeUrl.searchParams.set('scope', 'read:user user:email');
  authorizeUrl.searchParams.set('state', stateId);

  res.redirect(authorizeUrl.toString());
});

app.get('/api/auth/callback', async (req, res) => {
  if (authMode !== 'github') {
    return res.redirect('/');
  }

  const stateId = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const oauthState = oauthStates.get(stateId);
  oauthStates.delete(stateId);

  if (!oauthState || oauthState.expiresAt < Date.now() || !code) {
    return res.status(400).send('GitHub authentication failed: invalid or expired state.');
  }

  try {
    const token = await exchangeGithubCode(code);
    const githubUser = await fetchGithubUser(token);

    if (!(await isGithubUserAllowed(token, githubUser))) {
      return res.status(403).send('GitHub account is authenticated but not allowed to use this app.');
    }

    const session = createSession({
      login: githubUser.login,
      displayName: githubUser.name || githubUser.login,
      email: githubUser.email || '',
      avatarUrl: githubUser.avatar_url || '',
      provider: 'github'
    });

    setSessionCookie(res, session.id);
    res.redirect(oauthState.nextPath);
  } catch (error) {
    console.error('GitHub auth callback failed:', error.message);
    res.status(502).send('GitHub authentication failed while exchanging credentials.');
  }
});

app.post('/api/auth/logout', (req, res) => {
  if (req.session) {
    sessions.delete(req.session.id);
  }

  clearSessionCookie(res);
  res.json({ authenticated: false });
});

app.get('/api/state', async (_req, res, next) => {
  try {
    res.json(await loadState());
  } catch (error) {
    next(error);
  }
});

app.post('/api/coins', requireSession, async (req, res, next) => {
  const member = typeof req.body.member === 'string' ? req.body.member : '';
  if (!MEMBERS.includes(member)) {
    return res.status(400).json({ error: 'Invalid member.' });
  }

  const cooldownKey = req.session.user.login.toLowerCase();
  const lastVoteAt = voteCooldowns.get(cooldownKey) || 0;
  const remainingMs = RATE_LIMIT_MS - (Date.now() - lastVoteAt);
  if (remainingMs > 0) {
    return res.status(429).json({
      error: 'Rate limit exceeded.',
      remainingSeconds: Math.ceil(remainingMs / 1000)
    });
  }

  voteCooldowns.set(cooldownKey, Date.now());

  try {
    const nextState = await withStorageLock(async () => {
      const currentState = await loadState();
      const historyEntry = {
        id: `${Date.now()}-${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        member,
        addedBy: req.session.user.displayName,
        action: 'add_coin'
      };

      const updatedState = {
        ...currentState,
        total: currentState.total + 1,
        members: {
          ...currentState.members,
          [member]: (currentState.members[member] || 0) + 1
        },
        history: [historyEntry, ...currentState.history]
      };

      return saveState(updatedState);
    });

    res.json(nextState);
  } catch (error) {
    next(error);
  }
});

app.post('/api/withdraw', requireSession, async (req, res, next) => {
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';

  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (!withdrawPasswordHash) {
    return res.status(500).json({ error: 'Withdrawal password hash is not configured on the server.' });
  }

  const passwordDigest = sha256Hex(password);
  if (passwordDigest !== withdrawPasswordHash) {
    return res.status(403).json({ error: 'Incorrect password.' });
  }

  try {
    const result = await withStorageLock(async () => {
      const currentState = await loadState();
      if (currentState.total <= 0) {
        throw createHttpError(400, 'Nothing to withdraw.');
      }

      const sortedHistory = [...currentState.history].sort((left, right) => {
        return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
      });

      const withdrawalRecord = {
        id: `${Date.now()}-${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        withdrawnBy: req.session.user.displayName,
        amount: currentState.total * VALUE_PER_COIN,
        coinCount: currentState.total,
        note,
        period: {
          startDate: sortedHistory[0]?.timestamp || new Date().toISOString(),
          endDate: new Date().toISOString()
        },
        memberCounts: { ...currentState.members },
        history: [...currentState.history],
        statistics: buildStatistics(currentState.members, currentState.history)
      };

      const updatedState = {
        ...currentState,
        total: 0,
        members: createEmptyMembers(),
        history: [],
        withdrawals: [withdrawalRecord, ...currentState.withdrawals]
      };

      const savedState = await saveState(updatedState);
      return { state: savedState, withdrawal: withdrawalRecord };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post('/api/reset', requireSession, async (_req, res, next) => {
  try {
    const resetState = await withStorageLock(async () => {
      const currentState = await loadState();
      return saveState({
        ...currentState,
        total: 0,
        members: createEmptyMembers(),
        history: []
      });
    });

    res.json(resetState);
  } catch (error) {
    next(error);
  }
});

app.use('/assets', express.static(path.join(ROOT_DIR, 'assets'), {
  maxAge: '30d',
  immutable: true,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  }
}));

app.use('/src', express.static(path.join(ROOT_DIR, 'src'), {
  maxAge: '5m',
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=300');
  }
}));

app.use(express.static(ROOT_DIR, { index: false, maxAge: '5m' }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const message = error.message || 'Unexpected server error.';
  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({ error: message });
});

const server = app.listen(DEFAULT_PORT, () => {
  console.log(`Complain Can proxy running at http://localhost:${DEFAULT_PORT}`);
  console.log(`Auth mode: ${authMode}`);
  console.log(`Storage mode: ${storageMode}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}

function splitList(value) {
  return new Set(
    (value || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function createEmptyMembers() {
  return Object.fromEntries(MEMBERS.map((member) => [member, 0]));
}

function createDefaultState() {
  return {
    total: 0,
    members: createEmptyMembers(),
    history: [],
    withdrawals: [],
    updated: null
  };
}

function normalizeState(rawState) {
  const baseState = createDefaultState();
  const input = rawState && typeof rawState === 'object' ? rawState : {};
  const members = { ...baseState.members };

  for (const member of MEMBERS) {
    const count = input.members && Number.isFinite(input.members[member]) ? input.members[member] : 0;
    members[member] = count;
  }

  return {
    total: Number.isFinite(input.total) ? input.total : 0,
    members,
    history: Array.isArray(input.history) ? input.history : [],
    withdrawals: Array.isArray(input.withdrawals) ? input.withdrawals : [],
    updated: typeof input.updated === 'string' ? input.updated : null
  };
}

async function loadState() {
  if (storageMode === 'local') {
    return loadLocalState();
  }

  return loadGistState();
}

async function saveState(nextState) {
  const normalized = normalizeState({
    ...nextState,
    updated: new Date().toISOString()
  });

  if (storageMode === 'local') {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LOCAL_STATE_FILE, JSON.stringify(normalized, null, 2));
    return normalized;
  }

  if (!gistId || !githubStorageToken) {
    throw createHttpError(500, 'GitHub Gist storage is not configured on the server.');
  }

  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: githubHeaders({ includeJson: true }),
    body: JSON.stringify({
      files: {
        [gistFilename]: {
          content: JSON.stringify(normalized, null, 2)
        }
      }
    })
  });

  if (!response.ok) {
    throw createHttpError(502, `Failed to save shared state to GitHub Gist (${response.status}).`);
  }

  return normalized;
}

async function loadLocalState() {
  try {
    const contents = await fs.readFile(LOCAL_STATE_FILE, 'utf8');
    return normalizeState(JSON.parse(contents));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Failed to read local state:', error.message);
    }

    const initialState = createDefaultState();
    await saveState(initialState);
    return initialState;
  }
}

async function loadGistState() {
  if (!gistId || !githubStorageToken) {
    throw createHttpError(500, 'GitHub Gist storage is not configured on the server.');
  }

  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: githubHeaders()
  });

  if (!response.ok) {
    throw createHttpError(502, `Failed to load shared state from GitHub Gist (${response.status}).`);
  }

  const gist = await response.json();
  const gistFile = gist.files?.[gistFilename];
  if (!gistFile?.content) {
    throw createHttpError(502, `The GitHub Gist does not contain ${gistFilename}.`);
  }

  return normalizeState(JSON.parse(gistFile.content));
}

function githubHeaders(options = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'complain-can-proxy'
  };

  if (githubStorageToken) {
    headers.Authorization = `Bearer ${githubStorageToken}`;
  }

  if (options.includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function requireSession(req, res, next) {
  if (!req.session) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  next();
}

function parseCookies(header) {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex < 0) {
          return [part, ''];
        }

        return [part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1))];
      })
  );
}

function signValue(value) {
  return crypto.createHmac('sha256', sessionSecret).update(value).digest('base64url');
}

function encodeSignedValue(value) {
  return `${value}.${signValue(value)}`;
}

function decodeSignedValue(rawValue) {
  if (!rawValue?.includes('.')) {
    return null;
  }

  const separatorIndex = rawValue.lastIndexOf('.');
  const value = rawValue.slice(0, separatorIndex);
  const signature = rawValue.slice(separatorIndex + 1);
  const expectedSignature = signValue(value);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  return value;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.httpOnly) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.secure) parts.push('Secure');

  return parts.join('; ');
}

function setSessionCookie(res, sessionId) {
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, encodeSignedValue(sessionId), {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: process.env.NODE_ENV === 'production'
  }));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production'
  }));
}

function createSession(user) {
  const id = crypto.randomUUID();
  const session = {
    id,
    user,
    expiresAt: Date.now() + SESSION_TTL_MS
  };

  sessions.set(id, session);
  cleanupExpiredSessions();
  return session;
}

function getSessionFromRequest(req) {
  const cookieValue = parseCookies(req.headers.cookie || '')[SESSION_COOKIE_NAME];
  const sessionId = decodeSignedValue(cookieValue);
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(sessionId);
    }
  }
}

function cleanupExpiredOauthStates() {
  const now = Date.now();
  for (const [stateId, state] of oauthStates.entries()) {
    if (state.expiresAt < now) {
      oauthStates.delete(stateId);
    }
  }
}

function sanitizeNextPath(nextValue) {
  if (typeof nextValue !== 'string' || !nextValue.startsWith('/')) {
    return '/';
  }

  if (nextValue.startsWith('//')) {
    return '/';
  }

  return nextValue;
}

async function exchangeGithubCode(code) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'complain-can-proxy'
    },
    body: JSON.stringify({
      client_id: githubClientId,
      client_secret: githubClientSecret,
      code,
      redirect_uri: githubCallbackUrl
    })
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'GitHub token exchange failed.');
  }

  return payload.access_token;
}

async function fetchGithubUser(token) {
  const [userResponse, emailsResponse] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: oauthGithubHeaders(token)
    }),
    fetch('https://api.github.com/user/emails', {
      headers: oauthGithubHeaders(token)
    })
  ]);

  if (!userResponse.ok) {
    throw new Error(`GitHub user lookup failed (${userResponse.status}).`);
  }

  const user = await userResponse.json();
  let emails = [];
  if (emailsResponse.ok) {
    emails = await emailsResponse.json();
  }

  const primaryEmail = Array.isArray(emails)
    ? emails.find((entry) => entry.primary && entry.verified) || emails.find((entry) => entry.verified)
    : null;

  return {
    ...user,
    email: primaryEmail?.email || user.email || ''
  };
}

async function isGithubUserAllowed(token, user) {
  const configuredChecks = [allowedGithubUsers, allowedGithubOrgs, allowedGithubEmails].filter((set) => set.size > 0).length;
  if (configuredChecks === 0) {
    return true;
  }

  const login = String(user.login || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();

  if (allowedGithubUsers.has(login) || allowedGithubEmails.has(email)) {
    return true;
  }

  if (allowedGithubOrgs.size === 0) {
    return false;
  }

  const orgsResponse = await fetch('https://api.github.com/user/orgs', {
    headers: oauthGithubHeaders(token)
  });

  if (!orgsResponse.ok) {
    throw new Error(`GitHub org lookup failed (${orgsResponse.status}).`);
  }

  const orgs = await orgsResponse.json();
  return Array.isArray(orgs) && orgs.some((org) => allowedGithubOrgs.has(String(org.login || '').toLowerCase()));
}

function oauthGithubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'complain-can-proxy'
  };
}

function publicUser(user) {
  return {
    login: user.login,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    provider: user.provider
  };
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function withStorageLock(operation) {
  const next = storageQueue.then(operation, operation);
  storageQueue = next.catch(() => undefined);
  return next;
}

function buildStatistics(memberCounts, entries) {
  const statistics = Object.fromEntries(MEMBERS.map((member) => [member, {
    given: 0,
    received: memberCounts[member] || 0
  }]));

  for (const entry of entries) {
    if (entry.addedBy && statistics[entry.addedBy]) {
      statistics[entry.addedBy].given += 1;
    }
  }

  return statistics;
}