const encoder = new TextEncoder();
const decoder = new TextDecoder();

const MEMBERS = ['Isac', 'Hannah', 'Andreas', 'Karl', 'Daniel', 'Doug', 'Marina'];
const VALUE_PER_COIN = 5;
const RATE_LIMIT_MS = 30_000;
const SESSION_COOKIE_NAME = 'complain_can_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_GIST_FILENAME = 'coins.json';

function getSessionSecret(env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (getAuthMode(env) === 'development') return 'development-session-secret';
  throw httpError(500, 'SESSION_SECRET is required in production.');
}

let memoryState = createDefaultState();
const memoryCooldowns = new Map();

const API_ROUTES = {
  'GET /api/health': handleHealth,
  'GET /api/bootstrap': handleBootstrap,
  'POST /api/auth/check-email': handleCheckEmail,
  'GET /api/auth/session': handleSession,
  'GET /api/auth/login': handleLogin,
  'GET /api/auth/callback': handleGithubCallback,
  'POST /api/auth/logout': handleLogout,
  'GET /api/state': handleState,
  'POST /api/coins': handleAddCoin,
  'POST /api/withdraw': handleWithdraw,
  'POST /api/reset': handleReset
};

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    return withCors(request, env, jsonResponse({ error: 'Not found.' }, 404));
  }

  if (request.method === 'OPTIONS') {
    return handleOptions(request, env);
  }

  try {
    const route = API_ROUTES[`${request.method} ${url.pathname}`];
    if (!route) {
      return withCors(request, env, jsonResponse({ error: 'Not found.' }, 404));
    }

    return await route(request, env);
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || 'Unexpected server error.';
    if (status >= 500) {
      console.error('API error:', error);
    }
    return withCors(request, env, jsonResponse({ error: message }, status));
  }
}

async function handleHealth(request, env) {
  return withCors(request, env, jsonResponse({ ok: true, authMode: getAuthMode(env), storageMode: getStorageMode(env) }));
}

async function handleBootstrap(request, env) {
  const authMode = getAuthMode(env);
  return withCors(request, env, jsonResponse({
    authMode,
    storageMode: getStorageMode(env),
    loginPath: authMode === 'github' ? buildApiUrl(request, env, '/api/auth/login') : null,
    logoutPath: buildApiUrl(request, env, '/api/auth/logout'),
    rateLimitMs: RATE_LIMIT_MS
  }));
}

async function handleSession(request, env) {
  const session = await getSessionFromRequest(request, env);
  return withCors(request, env, jsonResponse(session
    ? { authenticated: true, authMode: getAuthMode(env), user: session.user }
    : { authenticated: false, authMode: getAuthMode(env) }
  ));
}

async function handleCheckEmail(request, env) {
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();

  if (!email) {
    return withCors(request, env, jsonResponse({ allowed: false, reason: 'missing-email' }, 400));
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return withCors(request, env, jsonResponse({ allowed: false, reason: 'invalid-email' }, 200));
  }

  return withCors(request, env, jsonResponse({
    allowed: isAllowedEmail(email, env),
    reason: isAllowedEmail(email, env) ? 'allowed' : 'not-allowed'
  }));
}

async function handleLogout(request, env) {
  return withCors(request, env, jsonResponse({ authenticated: false }, 200, {
    'Set-Cookie': serializeCookie(SESSION_COOKIE_NAME, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: true,
      maxAge: 0
    })
  }));
}

async function handleState(request, env) {
  await requireSession(request, env);
  return withCors(request, env, jsonResponse(await loadState(env)));
}

async function handleLogin(request, env) {
  if (getAuthMode(env) === 'supabase') {
    throw httpError(405, 'Use the email sign-in form to authenticate.');
  }

  const nextTarget = sanitizeNextTarget(new URL(request.url).searchParams.get('next'), request, env);

  if (getAuthMode(env) === 'development') {
    const sessionPayload = {
      user: {
        login: env.DEV_AUTH_LOGIN || 'local-dev',
        displayName: env.DEV_AUTH_USER || 'Local Dev',
        email: 'local@example.test',
        avatarUrl: '',
        provider: 'development'
      },
      exp: Date.now() + SESSION_TTL_MS
    };

    const sessionToken = await createSignedToken(sessionPayload, getSessionSecret(env));
    return redirect(nextTarget, {
      'Set-Cookie': serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: true,
        maxAge: Math.floor(SESSION_TTL_MS / 1000)
      })
    });
  }

  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    throw httpError(500, 'GitHub OAuth is not configured on the server.');
  }

  const stateToken = await createSignedToken({ next: nextTarget, exp: Date.now() + OAUTH_STATE_TTL_MS }, getSessionSecret(env));
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', env.GITHUB_OAUTH_CALLBACK_URL || buildApiUrl(request, env, '/api/auth/callback'));
  authorizeUrl.searchParams.set('scope', 'read:user user:email');
  authorizeUrl.searchParams.set('state', stateToken);

  return Response.redirect(authorizeUrl.toString(), 302);
}

async function handleGithubCallback(request, env) {
  if (getAuthMode(env) !== 'github') {
    return redirect(getDefaultFrontendOrigin(env, request));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateToken = url.searchParams.get('state');

  if (!code || !stateToken) {
    throw httpError(400, 'GitHub authentication failed: missing code or state.');
  }

  const state = await verifySignedToken(stateToken, getSessionSecret(env));
  if (!state || state.exp < Date.now()) {
    throw httpError(400, 'GitHub authentication failed: invalid or expired state.');
  }

  const accessToken = await exchangeGithubCode(code, request, env);
  const githubUser = await fetchGithubUser(accessToken);

  if (!(await isGithubUserAllowed(accessToken, githubUser, env))) {
    throw httpError(403, 'GitHub account is authenticated but not allowed to use this app.');
  }

  const sessionPayload = {
    user: {
      login: githubUser.login,
      displayName: githubUser.name || githubUser.login,
      email: githubUser.email || '',
      avatarUrl: githubUser.avatar_url || '',
      provider: 'github'
    },
    exp: Date.now() + SESSION_TTL_MS
  };

  const sessionToken = await createSignedToken(sessionPayload, getSessionSecret(env));
  return redirect(state.next, {
    'Set-Cookie': serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: true,
      maxAge: Math.floor(SESSION_TTL_MS / 1000)
    })
  });
}

async function handleAddCoin(request, env) {
  const session = await requireSession(request, env);
  const body = await readJson(request);
  const member = typeof body.member === 'string' ? body.member : '';
  if (!MEMBERS.includes(member)) {
    throw httpError(400, 'Invalid member.');
  }

  const remainingCooldown = await getRemainingCooldown(env, session.user.login);
  if (remainingCooldown > 0) {
    throw httpError(429, 'Rate limit exceeded.', { remainingSeconds: Math.ceil(remainingCooldown / 1000) });
  }

  await setCooldown(env, session.user.login);

  const currentState = await loadState(env);
  const historyEntry = {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    member,
    addedBy: session.user.displayName,
    action: 'add_coin'
  };

  const nextState = {
    ...currentState,
    total: currentState.total + 1,
    members: {
      ...currentState.members,
      [member]: (currentState.members[member] || 0) + 1
    },
    history: [historyEntry, ...currentState.history]
  };

  return withCors(request, env, jsonResponse(await saveState(env, nextState)));
}

async function handleWithdraw(request, env) {
  const session = await requireSession(request, env);
  const body = await readJson(request);
  const password = typeof body.password === 'string' ? body.password : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (!password) {
    throw httpError(400, 'Password is required.');
  }

  if (!env.WITHDRAW_PASSWORD_HASH) {
    throw httpError(500, 'Withdrawal password hash is not configured on the server.');
  }

  if ((await sha256Hex(password)) !== env.WITHDRAW_PASSWORD_HASH.trim().toLowerCase()) {
    throw httpError(403, 'Incorrect password.');
  }

  const currentState = await loadState(env);
  if (currentState.total <= 0) {
    throw httpError(400, 'Nothing to withdraw.');
  }

  const sortedHistory = [...currentState.history].sort((left, right) => {
    return new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
  });

  const withdrawalRecord = {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    withdrawnBy: session.user.displayName,
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

  const nextState = {
    ...currentState,
    total: 0,
    members: createEmptyMembers(),
    history: [],
    withdrawals: [withdrawalRecord, ...currentState.withdrawals]
  };

  const savedState = await saveState(env, nextState);
  return withCors(request, env, jsonResponse({ state: savedState, withdrawal: withdrawalRecord }));
}

async function handleReset(request, env) {
  await requireSession(request, env);
  const currentState = await loadState(env);
  const nextState = {
    ...currentState,
    total: 0,
    members: createEmptyMembers(),
    history: []
  };

  return withCors(request, env, jsonResponse(await saveState(env, nextState)));
}

function handleOptions(request, env) {
  return withCors(request, env, new Response(null, { status: 204 }));
}

async function requireSession(request, env) {
  const session = await getSessionFromRequest(request, env);
  if (!session) {
    throw httpError(401, 'Authentication required.');
  }
  return session;
}

async function getSessionFromRequest(request, env) {
  if (getAuthMode(env) === 'supabase') {
    return getSupabaseSessionFromRequest(request, env);
  }

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }

  const session = await verifySignedToken(token, getSessionSecret(env));
  if (!session || session.exp < Date.now()) {
    return null;
  }

  return session;
}

async function createSignedToken(payload, secret) {
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signString(encodedPayload, secret);
  return `${encodedPayload}.${encodeBase64Url(signature)}`;
}

async function verifySignedToken(token, secret) {
  const [payloadPart, signaturePart] = String(token || '').split('.');
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const expected = await signString(payloadPart, secret);
  const actual = decodeBase64Url(signaturePart);
  if (!timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    return JSON.parse(decoder.decode(decodeBase64Url(payloadPart)));
  } catch {
    return null;
  }
}

async function signString(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return new Uint8Array(signature);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function exchangeGithubCode(code, request, env) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_OAUTH_CALLBACK_URL || buildApiUrl(request, env, '/api/auth/callback')
    })
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw httpError(502, payload.error_description || payload.error || 'GitHub token exchange failed.');
  }

  return payload.access_token;
}

async function fetchGithubUser(token) {
  const [userResponse, emailsResponse] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: githubHeaders(token)
    }),
    fetch('https://api.github.com/user/emails', {
      headers: githubHeaders(token)
    })
  ]);

  if (!userResponse.ok) {
    throw httpError(502, `GitHub user lookup failed (${userResponse.status}).`);
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

async function isGithubUserAllowed(token, user, env) {
  const allowedUsers = splitList(env.ALLOWED_GITHUB_USERS);
  const allowedOrgs = splitList(env.ALLOWED_GITHUB_ORGS);
  const allowedEmails = splitList(env.ALLOWED_GITHUB_EMAILS);

  const configuredChecks = [allowedUsers, allowedOrgs, allowedEmails].filter((set) => set.size > 0).length;
  if (configuredChecks === 0) {
    return true;
  }

  const login = String(user.login || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();

  if (allowedUsers.has(login) || allowedEmails.has(email)) {
    return true;
  }

  if (allowedOrgs.size === 0) {
    return false;
  }

  const response = await fetch('https://api.github.com/user/orgs', {
    headers: githubHeaders(token)
  });

  if (!response.ok) {
    throw httpError(502, `GitHub org lookup failed (${response.status}).`);
  }

  const orgs = await response.json();
  return Array.isArray(orgs) && orgs.some((org) => allowedOrgs.has(String(org.login || '').toLowerCase()));
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'complain-can-worker'
  };
}

async function loadState(env) {
  const storageMode = getStorageMode(env);
  if (storageMode === 'memory') {
    return structuredClone(memoryState);
  }

  if (storageMode !== 'gist') {
    throw httpError(500, `Unsupported storage mode: ${storageMode}`);
  }

  const { token, gistId, filename } = getGistConfig(env);
  if (!token || !gistId) {
    throw httpError(500, 'GitHub Gist storage is not configured on the server.');
  }

  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'complain-can-worker'
    }
  });

  if (!response.ok) {
    throw httpError(502, `Failed to load shared state from GitHub Gist (${response.status}): ${await readGithubError(response)}`);
  }

  const gist = await response.json();
  const gistFile = gist.files?.[filename];
  if (!gistFile?.content) {
    throw httpError(502, `The GitHub Gist does not contain ${filename}.`);
  }

  return normalizeState(JSON.parse(gistFile.content));
}

async function saveState(env, nextState) {
  const normalized = normalizeState({
    ...nextState,
    updated: new Date().toISOString()
  });

  const storageMode = getStorageMode(env);
  if (storageMode === 'memory') {
    memoryState = structuredClone(normalized);
    return structuredClone(memoryState);
  }

  const { token, gistId, filename } = getGistConfig(env);
  if (!token || !gistId) {
    throw httpError(500, 'GitHub Gist storage is not configured on the server.');
  }

  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'complain-can-worker',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: {
        [filename]: {
          content: JSON.stringify(normalized, null, 2)
        }
      }
    })
  });

  if (!response.ok) {
    throw httpError(502, `Failed to save shared state to GitHub Gist (${response.status}): ${await readGithubError(response)}`);
  }

  return normalized;
}

async function getRemainingCooldown(env, login) {
  const key = `cooldown:${String(login || '').toLowerCase()}`;
  const storageMode = getStorageMode(env);
  const now = Date.now();

  if (env.COOLDOWN_KV) {
    const value = await env.COOLDOWN_KV.get(key);
    if (!value) {
      return 0;
    }
    return Math.max(0, RATE_LIMIT_MS - (now - Number.parseInt(value, 10)));
  }

  if (storageMode === 'memory') {
    const value = memoryCooldowns.get(key);
    if (!value) {
      return 0;
    }
    return Math.max(0, RATE_LIMIT_MS - (now - value));
  }

  return 0;
}

async function setCooldown(env, login) {
  const key = `cooldown:${String(login || '').toLowerCase()}`;
  const now = Date.now();
  if (env.COOLDOWN_KV) {
    await env.COOLDOWN_KV.put(key, String(now), { expirationTtl: Math.ceil(RATE_LIMIT_MS / 1000) });
    return;
  }

  memoryCooldowns.set(key, now);
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

function createDefaultState() {
  return {
    total: 0,
    members: createEmptyMembers(),
    history: [],
    withdrawals: [],
    updated: null
  };
}

function createEmptyMembers() {
  return Object.fromEntries(MEMBERS.map((member) => [member, 0]));
}

function buildStatistics(memberCounts, entries) {
  const statistics = Object.fromEntries(MEMBERS.map((member) => [member, {
    given: 0,
    received: memberCounts[member] || 0
  }]));

  for (const entry of entries) {
    const author = getHistoryAuthor(entry);
    if (!author) {
      continue;
    }

    if (!statistics[author]) {
      statistics[author] = {
        given: 0,
        received: memberCounts[author] || 0
      };
    }

    statistics[author].given += 1;
  }

  return statistics;
}

function getHistoryAuthor(entry) {
  const author = String(entry?.addedBy || '').trim();
  return author || '';
}

function getAuthMode(env) {
  if (env.AUTH_MODE) {
    return String(env.AUTH_MODE).toLowerCase();
  }

  if (env.SUPABASE_URL && (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)) {
    return 'supabase';
  }

  if (env.GITHUB_OAUTH_CLIENT_ID) {
    return 'github';
  }

  return 'development';
}

function getStorageMode(env) {
  return String(env.STORAGE_MODE || (env.GIST_ID && env.GITHUB_STORAGE_TOKEN ? 'gist' : 'memory')).toLowerCase();
}

function getGistConfig(env) {
  return {
    token: String(env.GITHUB_STORAGE_TOKEN || '').trim(),
    gistId: String(env.GIST_ID || '').trim(),
    filename: String(env.GIST_FILENAME || DEFAULT_GIST_FILENAME).trim() || DEFAULT_GIST_FILENAME
  };
}

async function getSupabaseSessionFromRequest(request, env) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return null;
  }

  const user = await fetchSupabaseUser(accessToken, env);
  if (!user) {
    return null;
  }

  if (!isAllowedEmail(user.email, env)) {
    throw httpError(403, 'Authenticated email is not allowed to use this app.');
  }

  return {
    user: {
      login: user.email,
      displayName: user.user_metadata?.full_name || user.email,
      email: user.email || '',
      avatarUrl: user.user_metadata?.avatar_url || '',
      provider: 'supabase'
    }
  };
}

function getBearerToken(request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authorization.slice(7).trim();
}

async function fetchSupabaseUser(accessToken, env) {
  const supabaseUrl = String(env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const supabasePublishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw httpError(500, 'Supabase auth is not configured on the server.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Accept: 'application/json',
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw httpError(502, `Supabase user lookup failed (${response.status}): ${await readGithubError(response)}`);
  }

  return response.json();
}

function isAllowedEmail(email, env) {
  const allowedEmails = splitList(env.ALLOWED_EMAILS || env.ALLOWED_GITHUB_EMAILS);
  if (allowedEmails.size === 0) {
    return true;
  }

  return allowedEmails.has(String(email || '').toLowerCase());
}

async function readGithubError(response) {
  try {
    const payload = await response.clone().json();
    return payload.message || payload.error || 'GitHub API request failed.';
  } catch {
    try {
      const text = (await response.clone().text()).trim();
      return text || 'GitHub API request failed.';
    } catch {
      return 'GitHub API request failed.';
    }
  }
}

function buildApiUrl(request, env, path) {
  const base = String(env.PUBLIC_API_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
  return `${base}${path}`;
}

function sanitizeNextTarget(nextValue, request, env) {
  const requestUrl = new URL(request.url);
  const allowedOrigins = getAllowedOrigins(env, requestUrl.origin);
  const fallbackOrigin = allowedOrigins[0] || requestUrl.origin;

  if (typeof nextValue !== 'string' || !nextValue.trim()) {
    return `${fallbackOrigin}/`;
  }

  try {
    const nextUrl = new URL(nextValue, requestUrl.origin);
    if (!['http:', 'https:'].includes(nextUrl.protocol)) {
      return `${fallbackOrigin}/`;
    }

    if (!allowedOrigins.includes(nextUrl.origin)) {
      return `${fallbackOrigin}/`;
    }

    return nextUrl.toString();
  } catch {
    return `${fallbackOrigin}/`;
  }
}

function getDefaultFrontendOrigin(env, request) {
  const requestUrl = new URL(request.url);
  return getAllowedOrigins(env, requestUrl.origin)[0] || requestUrl.origin;
}

function getAllowedOrigins(env, fallbackOrigin) {
  const values = [
    ...(String(env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)),
    ...(String(env.FRONTEND_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean))
  ];

  if (values.length === 0) {
    return [fallbackOrigin];
  }

  return Array.from(new Set(values));
}

function splitList(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
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

        try {
          return [part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1))];
        } catch {
          return [part.slice(0, separatorIndex), part.slice(separatorIndex + 1)];
        }
      })
  );
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join('; ');
}

function encodeBase64Url(bytes) {
  let output = '';
  for (const byte of bytes) {
    output += String.fromCodePoint(byte);
  }
  return btoa(output).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (char) => char.codePointAt(0));
}

function timingSafeEqual(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    }
  });
}

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...headers
    }
  });
}

function httpError(status, message, extra = undefined) {
  const error = new Error(message);
  error.status = status;
  if (extra) {
    Object.assign(error, extra);
  }
  return error;
}

function withCors(request, env, response) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(env, new URL(request.url).origin);
  let allowOrigin = null;
  if (origin && allowedOrigins.includes(origin)) {
    allowOrigin = origin;
  } else if (!origin) {
    allowOrigin = allowedOrigins[0] || null;
  }

  const headers = new Headers(response.headers);
  if (allowOrigin) {
    headers.set('Access-Control-Allow-Origin', allowOrigin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Vary', 'Origin');
  }

  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}