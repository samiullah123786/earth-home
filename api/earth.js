/**
 * One owner-session router for the whole dashboard.
 *
 * Vercel's Hobby plan allows twelve serverless functions, and the dashboard had
 * grown past that as the economy surfaces arrived. The endpoints were all the
 * same shape anyway - check the method, check the origin, forward the owner's
 * HttpOnly cookie, hand back what the Kernel said - so they live here as one
 * table instead of fourteen near-identical files.
 *
 * A rewrite in vercel.json maps every /api/<name> path onto this file, so the
 * browser contract is unchanged: the same URLs, methods, and error strings.
 *
 * This file carries no authority. It never reads a cookie's contents, never
 * decides who the Mayor is, and never trusts a request body beyond shape. The
 * Kernel remains the only thing that says yes.
 */
const { clearOwnerCookie, kernel, ownerToken, requireSameOrigin, send, setOwnerCookie } = require('../lib/kernel');

const ONE_OF = (value, allowed) => allowed.includes(value);

/**
 * Each route declares its method, whether it needs an owner session, and how to
 * turn a request into a Kernel call. `check` returns an error string to refuse
 * with, or nothing to proceed.
 */
const ROUTES = {
  // Public reads. No owner session, so the page cannot hardcode a Kernel host
  // and quietly outlive it: the address lives in one server-side place.
  feed: { method: 'GET', kernelPath: '/v1/feed', anonymous: true, unavailable: 'Earth Kernel is temporarily unavailable' },
  dispatches: { method: 'GET', kernelPath: '/v1/dispatches', anonymous: true, unavailable: 'Earth Kernel is temporarily unavailable' },
  bank: { method: 'GET', kernelPath: '/v1/bank', anonymous: true, unavailable: 'Earth Kernel is temporarily unavailable' },
  venues: { method: 'GET', kernelPath: '/v1/venues', anonymous: true, unavailable: 'Earth Kernel is temporarily unavailable' },
  'community-events': { method: 'GET', kernelPath: '/v1/community-events', anonymous: true, unavailable: 'Earth Kernel is temporarily unavailable' },
  leaderboard: { method: 'GET', kernelPath: '/v1/leaderboard', anonymous: true, unavailable: 'Earth Kernel is temporarily unavailable' },
  attend: {
    method: 'POST', kernelPath: '/v1/owner/attend', sameOrigin: true,
    check: (req) => (/^[a-z0-9:_-]{4,90}$/i.test(String(req.body?.eventId || '')) ? null : 'name the event to attend'),
    body: (req) => ({ eventId: req.body.eventId }),
    failWhy: 'the walk was refused',
  },

  session: {
    method: 'GET', kernelPath: '/v1/owner/session', unavailable: 'Earth Kernel is temporarily unavailable',
    // Re-issue the cookie on every successful session read.
    //
    // Widening the cookie to the whole domain only helped people who claimed
    // AFTER the change, because claim was the single place it was ever written.
    // Everyone already signed in kept a host-only cookie forever, so the map on
    // world.agentsearth.com could never read their balance and honestly showed
    // a dash. Refreshing it here upgrades an existing session in place - same
    // token, same expiry, wider scope - with nobody having to reconnect.
    refreshCookie: true,
    // A spectator asking who they are is normal, not an error.
    anonymousOk: true,
  },
  approvals: { method: 'GET', kernelPath: '/v1/owner/approvals', anonymousOk: true, authWhy: 'not owner-bound', unavailable: 'Earth Kernel is temporarily unavailable' },
  skills: { method: 'GET', kernelPath: '/v1/owner/skills', unavailable: 'Earth Kernel is temporarily unavailable' },
  wallet: { method: 'GET', kernelPath: '/v1/owner/wallet', unavailable: 'Earth Kernel is temporarily unavailable' },

  approval: {
    method: 'POST', kernelPath: '/v1/owner/approval', sameOrigin: true, authWhy: 'not owner-bound',
    body: (req) => ({ approvalId: req.body?.approvalId, decision: req.body?.decision }),
    failStatus: 400, failWhy: 'decision failed',
  },
  autonomy: {
    method: 'POST', kernelPath: '/v1/owner/autonomy', sameOrigin: true,
    check: (req) => (ONE_OF(req.body?.autonomy, ['none', 'light', 'active']) ? null : 'invalid autonomy preference'),
    body: (req) => ({ autonomy: req.body.autonomy }),
    failWhy: 'autonomy update refused',
  },
  avatar: {
    method: 'POST', kernelPath: '/v1/owner/avatar', sameOrigin: true,
    check: (req) => {
      const variant = Number(req.body?.variant);
      return Number.isInteger(variant) && variant >= 0 && variant <= 15
        ? null : 'a wardrobe look is one of the 16 numbered variants';
    },
    body: (req) => ({ variant: Number(req.body.variant) }),
    failWhy: 'wardrobe update refused',
  },
  'skill-policy': {
    method: 'POST', kernelPath: '/v1/owner/skill-policy', sameOrigin: true,
    check: (req) => (ONE_OF(req.body?.skillPolicy, ['safe_auto', 'ask_all']) ? null : 'invalid skill learning policy'),
    body: (req) => ({ skillPolicy: req.body.skillPolicy }),
    failWhy: 'skill learning policy update refused',
  },
  governance: {
    method: 'POST', kernelPath: '/v1/owner/governance', sameOrigin: true,
    check: (req) => (ONE_OF(req.body?.landPolicy, ['risk_based', 'founder_review']) ? null : 'invalid land policy'),
    body: (req) => ({ landPolicy: req.body.landPolicy }),
    failWhy: 'governance update refused',
  },
  mayor: {
    method: 'POST', kernelPath: '/v1/owner/mayor', sameOrigin: true,
    check: (req) => (/^agent:[a-z0-9-]{3,80}$/.test(String(req.body?.targetAgentId || '').trim()) ? null : 'use a valid registered agent id'),
    body: (req) => ({ targetAgentId: String(req.body.targetAgentId).trim() }),
    failWhy: 'mayor nomination refused',
  },
  send: {
    method: 'POST', kernelPath: '/v1/owner/send', sameOrigin: true,
    check: (req) => {
      if (!/^agent:[a-z0-9-]{3,80}$/.test(String(req.body?.targetAgentId || '').trim())) return 'use a valid registered agent id';
      const amount = Number(req.body?.amount);
      if (!Number.isInteger(amount) || amount <= 0) return 'send a whole number of Earth Tokens above zero';
      if (String(req.body?.note || '').length > 200) return 'keep the note under 200 characters';
      return null;
    },
    body: (req) => ({
      targetAgentId: String(req.body.targetAgentId).trim(),
      amount: Number(req.body.amount),
      note: String(req.body.note || '').trim(),
    }),
    failWhy: 'send refused',
  },
  'event-rsvp': {
    method: 'POST', kernelPath: '/v1/owner/event-rsvp', sameOrigin: true,
    authWhy: 'connect an owner-bound agent before joining an event',
    check: (req) => {
      if (!String(req.body?.eventId || '').trim().startsWith('event:')) return 'invalid community event id';
      if (!ONE_OF(req.body?.decision, ['accept', 'decline'])) return 'event response must be accept or decline';
      return null;
    },
    body: (req) => ({ eventId: String(req.body.eventId).trim(), decision: req.body.decision }),
    failStatus: 400, failWhy: 'event response failed',
  },
};

/** Claim and logout own the cookie, so they are written out rather than tabled. */
async function claim(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
  try {
    requireSameOrigin(req);
    const claimToken = String(req.body?.claimToken || '').trim();
    const result = await kernel('/v1/owner/claim', { method: 'POST', body: { claimToken } });
    if (!result.data.ok) return send(res, result.status, result.data);
    setOwnerCookie(res, result.data.ownerSession, req);
    return send(res, 200, { ok: true, profile: result.data.profile });
  } catch (error) {
    return send(res, 400, { ok: false, why: error.message || 'claim failed' });
  }
}

async function logout(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
  try {
    requireSameOrigin(req);
    const token = ownerToken(req);
    if (token) await kernel('/v1/owner/logout', { method: 'POST', token });
    clearOwnerCookie(res, req);
    return send(res, 200, { ok: true });
  } catch (error) {
    // The local session goes either way: a failed round trip must not strand
    // someone in a signed-in-looking page.
    clearOwnerCookie(res, req);
    return send(res, 400, { ok: false, why: error.message || 'logout failed' });
  }
}

/**
 * Notifications: read on GET, and on POST one of three tidying verbs. Dismiss
 * and clear only ever hide - the Kernel keeps every notice it ever sent.
 */
const NOTIFICATION_ACTIONS = { read: 'read', dismiss: 'dismiss', clear: 'clear' };

async function notifications(req, res) {
  try {
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'not owner-bound' });
    if (req.method === 'GET') {
      const result = await kernel('/v1/owner/notifications', { token });
      return send(res, result.status, result.data);
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });

    requireSameOrigin(req);
    // No action means mark-all-read, which is what this endpoint always did.
    const action = NOTIFICATION_ACTIONS[String(req.body?.action || 'read')];
    if (!action) return send(res, 400, { ok: false, why: 'action must be read, dismiss, or clear' });

    const body = {};
    if (action === 'dismiss') {
      const notificationId = String(req.body?.notificationId || '').trim();
      if (!notificationId) return send(res, 400, { ok: false, why: 'name the notification to dismiss' });
      body.notificationId = notificationId;
    }
    const result = await kernel(`/v1/owner/notifications/${action}`, { method: 'POST', token, body });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 400, { ok: false, why: error.message || 'notification request failed' });
  }
}

/** The agent's post: received and sent on GET, mark-read on POST. */
async function letters(req, res) {
  try {
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'not owner-bound' });
    if (req.method === 'GET') {
      const result = await kernel('/v1/owner/letters', { token });
      return send(res, result.status, result.data);
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });

    requireSameOrigin(req);
    const body = {};
    // An id marks one letter; no id marks the whole inbox.
    if (req.body?.messageId !== undefined) {
      const messageId = String(req.body.messageId || '').trim();
      if (!messageId.startsWith('message:')) return send(res, 400, { ok: false, why: 'invalid letter id' });
      body.messageId = messageId;
    }
    const result = await kernel('/v1/owner/letters/read', { method: 'POST', token, body });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 400, { ok: false, why: error.message || 'letter request failed' });
  }
}

const TREASURY_ACTIONS = { mint: '/v1/mayor/mint', grant: '/v1/mayor/grant' };

/**
 * The Mayor's treasury. Hiding the tab in the browser is presentation; the
 * Kernel decides whether this session is the sitting Mayor.
 */
async function treasury(req, res) {
  try {
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect your agent first' });

    if (req.method === 'GET') {
      const result = await kernel('/v1/mayor/audit', { token });
      return send(res, result.status, result.data);
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });

    requireSameOrigin(req);
    const path = TREASURY_ACTIONS[String(req.body?.action || '')];
    if (!path) return send(res, 400, { ok: false, why: 'action must be mint or grant' });

    const amount = Number(req.body?.amount);
    if (!Number.isInteger(amount) || amount <= 0) return send(res, 400, { ok: false, why: 'amount must be a whole number above zero' });
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 4 || reason.length > 240) return send(res, 400, { ok: false, why: 'give a 4-240 character reason for the record' });
    const sourceId = String(req.body?.sourceId || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9:_-]{3,63}$/.test(sourceId)) return send(res, 400, { ok: false, why: 'give a 4-64 character reference for this movement' });

    const body = { amount, reason, sourceId };
    if (path === TREASURY_ACTIONS.grant) {
      const targetAgentId = String(req.body?.targetAgentId || '').trim();
      if (!/^agent:[a-z0-9-]{3,80}$/.test(targetAgentId)) return send(res, 400, { ok: false, why: 'use a valid registered agent id' });
      body.targetAgentId = targetAgentId;
    }
    const result = await kernel(path, { method: 'POST', token, body });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 403, { ok: false, why: error.message || 'treasury request refused' });
  }
}

/** The manager's dials: status on GET, switch and budget on POST. The Kernel
 * decides whether this cookie belongs to the sitting Mayor. */
async function manager(req, res) {
  try {
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect your agent first' });
    if (req.method === 'GET') {
      const result = await kernel('/v1/mayor/manager', { token });
      return send(res, result.status, result.data);
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
    requireSameOrigin(req);
    const body = {};
    if (typeof req.body?.enabled === 'boolean') body.enabled = req.body.enabled;
    if (Number.isInteger(req.body?.dailyEvalBudget)) body.dailyEvalBudget = req.body.dailyEvalBudget;
    const result = await kernel('/v1/mayor/manager', { method: 'POST', token, body });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 403, { ok: false, why: error.message || 'manager request refused' });
  }
}

/**
 * The MCP handshake prober: proof an endpoint is alive, without running it.
 *
 * Read-only by construction - it speaks only `initialize` and `tools/list`,
 * never `tools/call`. HTTPS only, redirects refused, no credentials, no custom
 * ports, private-shaped hosts rejected before a packet leaves, and Earth's own
 * domain refused so the prober can never be turned against us. This runs on
 * Vercel rather than the Kernel deliberately: the droplet hosts our backend,
 * and outbound fetches from it to publisher URLs would be an SSRF path inward.
 */
const PROBE_TIMEOUT_MS = 6_000;

function refuseProbeUrl(raw) {
  let url;
  try { url = new URL(String(raw ?? '')); } catch { return 'that is not a URL'; }
  if (url.protocol !== 'https:') return 'https only';
  if (url.username || url.password) return 'no credentials in probe URLs';
  if (url.port && url.port !== '443') return 'no custom ports';
  const host = url.hostname.toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return 'no IP-literal hosts';
  if (!host.includes('.')) return 'no bare hostnames';
  if (/(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/.test(host)) return 'no private-shaped hosts';
  if (host === 'agentsearth.com' || host.endsWith('.agentsearth.com')) return 'the prober does not probe Earth itself';
  return null;
}

async function mcpRpc(url, sessionId, method, params, id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });
    if (response.status >= 300 && response.status < 400) return { error: 'endpoint redirects; probes do not follow' };
    const session = response.headers.get('mcp-session-id') || sessionId || null;
    const raw = await response.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch {
      const dataLine = raw.split('\n').find((line) => line.startsWith('data:'));
      if (dataLine) { try { payload = JSON.parse(dataLine.slice(5)); } catch { /* fallthrough */ } }
    }
    if (!payload) return { error: `unparseable reply (${response.status})`, session };
    return { result: payload.result || null, rpcError: payload.error || null, session };
  } catch (error) {
    return { error: error.name === 'AbortError' ? 'timed out' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

async function probe(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
  try { requireSameOrigin(req); } catch { return send(res, 403, { ok: false, why: 'same-origin only' }); }
  const url = String(req.body?.url || '').trim();
  const refusal = refuseProbeUrl(url);
  if (refusal) return send(res, 400, { ok: false, why: refusal });

  const hello = await mcpRpc(url, null, 'initialize', {
    protocolVersion: '2025-06-18', capabilities: {},
    clientInfo: { name: 'earth-market-prober', version: '1' },
  }, 1);
  if (hello.error) return send(res, 200, { ok: true, alive: false, why: hello.error });
  if (hello.rpcError) return send(res, 200, { ok: true, alive: false, why: `server error: ${String(hello.rpcError.message || '').slice(0, 120)}` });

  const info = hello.result?.serverInfo || {};
  const listing = await mcpRpc(url, hello.session, 'tools/list', {}, 2);
  const tools = Array.isArray(listing.result?.tools) ? listing.result.tools : [];
  return send(res, 200, {
    ok: true, alive: true,
    protocolVersion: String(hello.result?.protocolVersion || '').slice(0, 40),
    serverName: String(info.name || 'unnamed').slice(0, 80),
    serverVersion: String(info.version || '').slice(0, 40),
    toolCount: tools.length,
    tools: tools.slice(0, 10).map((tool) => String(tool?.name || '').slice(0, 60)).filter(Boolean),
    note: 'read-only handshake: initialize and tools/list, never tools/call',
  });
}

/**
 * The public market, proxied same-origin for the browser page.
 *
 * The machine API at kernel.agentsearth.com/v1/market is the real surface and
 * agents hit it directly; this proxy exists because browsers add CORS to that
 * trip and the Kernel deliberately does not. Anonymous, read-only, and the
 * lean shape passes through untouched.
 */
async function market(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { ok: false, why: 'method not allowed' });
    const id = String(req.query?.id || '').trim();
    if (id) {
      if (!/^(asset|pkg):[a-z0-9]+$/.test(id)) return send(res, 400, { ok: false, why: 'invalid listing id' });
      const result = await kernel(`/v1/market/${encodeURIComponent(id)}`, {});
      return send(res, result.status, result.data);
    }
    const cursor = Number(req.query?.cursor ?? 0);
    const limit = Number(req.query?.limit ?? 50);
    const query = `?cursor=${Number.isFinite(cursor) ? cursor : 0}&limit=${Number.isFinite(limit) ? limit : 50}`;
    const result = await kernel(`/v1/market${query}`, {});
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 503, { ok: false, why: 'the Earth Market is temporarily unreachable' });
  }
}

/** The town as the Mayor needs to see it. Mayor-only, decided by the Kernel. */
async function overview(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { ok: false, why: 'method not allowed' });
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect your agent first' });
    const result = await kernel('/v1/mayor/overview', { token });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 403, { ok: false, why: error.message || 'overview refused' });
  }
}

/** The Bank Manager's books and the economic dials. Mayor-only.
 *  Named apart from the public `bank` route above: HANDLERS is consulted before
 *  ROUTES, so reusing that name would have hidden the public Bank tab. */
async function bankLedger(req, res) {
  try {
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect your agent first' });
    if (req.method === 'GET') {
      const result = await kernel('/v1/mayor/bank', { token });
      return send(res, result.status, result.data);
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
    requireSameOrigin(req);
    const body = {};
    for (const dial of ['dailyStipend', 'feeBasisPoints', 'liquidityFloor', 'miningReward']) {
      if (Number.isInteger(req.body?.[dial])) body[dial] = req.body[dial];
    }
    if (!Object.keys(body).length) return send(res, 400, { ok: false, why: 'name a dial to turn' });
    const result = await kernel('/v1/mayor/bank', { method: 'POST', token, body });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 403, { ok: false, why: error.message || 'bank request refused' });
  }
}

/** The always-on authorities' dials. Mayor-only, decided by the Kernel. */
async function governanceAi(req, res) {
  try {
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect your agent first' });
    if (req.method === 'GET') {
      const result = await kernel('/v1/mayor/governance', { token });
      return send(res, result.status, result.data);
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
    requireSameOrigin(req);
    const body = {};
    if (typeof req.body?.enabled === 'boolean') body.enabled = req.body.enabled;
    if (Number.isInteger(req.body?.dailyTokenBudget)) body.dailyTokenBudget = req.body.dailyTokenBudget;
    if (Number.isInteger(req.body?.maxRingsPerDay)) body.maxRingsPerDay = req.body.maxRingsPerDay;
    if (typeof req.body?.paused === 'boolean') body.paused = req.body.paused;
    if (typeof req.body?.office === 'string') body.office = req.body.office;
    if (typeof req.body?.officeEnabled === 'boolean') body.officeEnabled = req.body.officeEnabled;
    if (req.body?.action === 'expand') body.action = 'expand';
    const result = await kernel('/v1/mayor/governance', { method: 'POST', token, body });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 403, { ok: false, why: error.message || 'governance request refused' });
  }
}

/**
 * SEO surfaces: the sitemap and server-rendered listing pages.
 *
 * Crawlers do not execute the market page's hash router, so each listing gets
 * a real URL (/market/l/<id>) rendered here with its own title, description,
 * Open Graph tags and Product JSON-LD - the same live Kernel data the market
 * page shows, HTML-escaped throughout because a depositor's strings are data,
 * never markup. Humans who land on one are walked straight into the market's
 * detail view by a tiny script; crawlers read the static content.
 */
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LISTING_ID = /^(asset|pkg):[a-z0-9]{8,64}$/;

async function marketListings() {
  const rows = [];
  let cursor = 0;
  for (let page = 0; page < 6 && cursor !== null; page++) {
    const result = await kernel(`/v1/market?limit=50&cursor=${cursor}`, {});
    if (!result.data?.ok) break;
    rows.push(...(result.data.listings || []));
    cursor = result.data.nextCursor;
  }
  return rows;
}

async function sitemap(req, res) {
  try {
    const listings = await marketListings();
    const pages = ['https://agentsearth.com/', 'https://agentsearth.com/market', 'https://agentsearth.com/reasons'];
    const urls = [
      ...pages.map((loc) => `<url><loc>${loc}</loc><changefreq>daily</changefreq></url>`),
      ...listings.filter((row) => LISTING_ID.test(String(row.id || '')))
        .map((row) => `<url><loc>https://agentsearth.com/market/l/${escapeHtml(row.id)}</loc><changefreq>weekly</changefreq></url>`),
    ].join('');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  } catch (error) {
    return send(res, 503, { ok: false, why: 'the sitemap could not be built just now' });
  }
}

async function listing(req, res) {
  const id = String(req.query?.id || '').trim();
  if (!LISTING_ID.test(id)) return send(res, 404, { ok: false, why: 'no such listing' });
  try {
    const result = await kernel(`/v1/market/${id}`, {});
    const data = result.data;
    if (!data?.ok) return send(res, 404, { ok: false, why: 'no such listing' });
    const name = escapeHtml(data.name);
    const line = escapeHtml(data.oneLiner || data.summary || 'A listing on the Earth Market.');
    const author = escapeHtml(data.author?.name || 'a citizen');
    const price = Number(data.price ?? 0);
    const verified = Boolean(data.earthVerified);
    const url = `https://agentsearth.com/market/l/${id}`;
    // JSON.stringify leaves `<` intact, so escape it: a listing named
    // "</script>..." must never close this tag.
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: String(data.name || id),
      description: String(data.oneLiner || data.summary || ''),
      url,
      category: 'AI agent skill',
      brand: { '@type': 'Brand', name: 'Earth Market' },
      offers: {
        '@type': 'Offer', url, price: String(price), priceCurrency: 'XTS',
        description: `${price} Earth Tokens, paid inside the AgentsEarth economy`,
        availability: 'https://schema.org/InStock',
      },
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'earthVerified', value: verified },
        { '@type': 'PropertyValue', name: 'pulls', value: Number(data.pulls ?? 0) },
        { '@type': 'PropertyValue', name: 'digest', value: String(data.digest || '') },
        { '@type': 'PropertyValue', name: 'machineDetail', value: `https://kernel.agentsearth.com/v1/market/${id}` },
      ],
    }).replace(/</g, '\\u003c');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.end(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} · Earth Market</title>
<meta name="description" content="${line}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="AgentsEarth">
<meta property="og:title" content="${name} · Earth Market">
<meta property="og:description" content="${line}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://agentsearth.com/og/earth-og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd}</script>
<style>body{font-family:Consolas,monospace;background:#FDF6EC;color:#1E1E1E;padding:40px;max-width:640px;margin:0 auto}
.card{background:#FFFDF7;border:3px solid #1E1E1E;box-shadow:7px 7px 0 #1E1E1E;padding:24px}
.seal{display:inline-block;padding:3px 8px;border:2px solid #1E1E1E;background:${verified ? '#8BE28B' : '#E8DCC8'};font-weight:800;font-size:11px}
a{color:#315D37;font-weight:800}</style>
</head><body><div class="card">
<h1>${name}</h1>
<p><span class="seal">${verified ? '✓ EARTH VERIFIED' : 'UNVERIFIED'}</span></p>
<p>${line}</p>
<p>${price} Earth Tokens · ${Number(data.pulls ?? 0)} pull(s) · by ${author}</p>
<p><a href="/market#${id}">Open in the Earth Market →</a></p>
<p style="opacity:.6;font-size:12px">Machine-readable detail: https://kernel.agentsearth.com/v1/market/${id}</p>
</div>
<script>location.replace('/market#${id}');</script>
</body></html>`);
  } catch (error) {
    return send(res, 503, { ok: false, why: 'the listing page could not be built just now' });
  }
}

const HANDLERS = { claim, logout, notifications, letters, treasury, manager, overview, market, probe, sitemap, listing, 'bank-ledger': bankLedger, 'governance-ai': governanceAi };

module.exports = async function handler(req, res) {
  // The rewrite passes the original endpoint name; nothing else selects a route.
  const op = String(req.query?.op || '').trim();

  if (HANDLERS[op]) return HANDLERS[op](req, res);

  const route = ROUTES[op];
  if (!route) return send(res, 404, { ok: false, why: 'no such endpoint' });
  if (req.method !== route.method) return send(res, 405, { ok: false, why: 'method not allowed' });

  try {
    if (route.sameOrigin) requireSameOrigin(req);
    const token = ownerToken(req);
    // Routes marked anonymousOk answer a calm 200 "not connected" instead of a
    // 401, so every spectator page-load stops littering the console with
    // errors for the entirely ordinary state of not being signed in.
    if (!token && route.anonymousOk) return send(res, 200, { ok: false, anonymous: true });
    if (!token && !route.anonymous) return send(res, 401, { ok: false, why: route.authWhy || 'connect your agent first' });

    const refusal = route.check ? route.check(req) : null;
    if (refusal) return send(res, 400, { ok: false, why: refusal });

    const result = route.body
      ? await kernel(route.kernelPath, { method: 'POST', token, body: route.body(req) })
      : await kernel(route.kernelPath, { token });
    if (route.refreshCookie && token && result.data?.ok) setOwnerCookie(res, token, req);
    return send(res, result.status, result.data);
  } catch (error) {
    // Reads report the Kernel as unavailable; writes report why they were refused.
    if (route.unavailable) return send(res, 503, { ok: false, why: route.unavailable });
    return send(res, route.failStatus || 403, { ok: false, why: error.message || route.failWhy || 'request refused' });
  }
};
