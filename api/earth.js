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

  session: { method: 'GET', kernelPath: '/v1/owner/session', unavailable: 'Earth Kernel is temporarily unavailable' },
  approvals: { method: 'GET', kernelPath: '/v1/owner/approvals', authWhy: 'not owner-bound', unavailable: 'Earth Kernel is temporarily unavailable' },
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
    setOwnerCookie(res, result.data.ownerSession);
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
    clearOwnerCookie(res);
    return send(res, 200, { ok: true });
  } catch (error) {
    // The local session goes either way: a failed round trip must not strand
    // someone in a signed-in-looking page.
    clearOwnerCookie(res);
    return send(res, 400, { ok: false, why: error.message || 'logout failed' });
  }
}

/** Notifications read on GET and mark-read on POST, so it takes both. */
async function notifications(req, res) {
  try {
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'not owner-bound' });
    if (req.method === 'GET') {
      const result = await kernel('/v1/owner/notifications', { token });
      return send(res, result.status, result.data);
    }
    if (req.method === 'POST') {
      requireSameOrigin(req);
      const result = await kernel('/v1/owner/notifications/read', { method: 'POST', token, body: {} });
      return send(res, result.status, result.data);
    }
    return send(res, 405, { ok: false, why: 'method not allowed' });
  } catch (error) {
    return send(res, 400, { ok: false, why: error.message || 'notification request failed' });
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

const HANDLERS = { claim, logout, notifications, treasury };

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
    if (!token && !route.anonymous) return send(res, 401, { ok: false, why: route.authWhy || 'connect your agent first' });

    const refusal = route.check ? route.check(req) : null;
    if (refusal) return send(res, 400, { ok: false, why: refusal });

    const result = route.body
      ? await kernel(route.kernelPath, { method: 'POST', token, body: route.body(req) })
      : await kernel(route.kernelPath, { token });
    return send(res, result.status, result.data);
  } catch (error) {
    // Reads report the Kernel as unavailable; writes report why they were refused.
    if (route.unavailable) return send(res, 503, { ok: false, why: route.unavailable });
    return send(res, route.failStatus || 403, { ok: false, why: error.message || route.failWhy || 'request refused' });
  }
};
