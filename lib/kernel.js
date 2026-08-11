const KERNEL_URL = (process.env.EARTH_KERNEL_URL || 'https://kernel.agentsearth.com').replace(/\/$/, '');
const COOKIE = 'earth_owner';

function parseCookies(req) {
  const cookies = {};
  for (const raw of String(req.headers.cookie || '').split(';')) {
    const part = raw.trim();
    const index = part.indexOf('=');
    if (index <= 0) continue;
    try { cookies[decodeURIComponent(part.slice(0, index))] = decodeURIComponent(part.slice(index + 1)); }
    catch { /* Ignore malformed, attacker-controlled cookie fragments. */ }
  }
  return cookies;
}

function ownerToken(req) {
  return parseCookies(req)[COOKIE] || '';
}

// Scoped to the registrable domain, not the single host.
//
// The world runs on world.agentsearth.com and the dashboard on agentsearth.com.
// A host-only cookie never reached the world, so the full-screen map had no way
// to learn a balance and simply showed a dash - the bug this fixes. Both hosts
// are the same SITE, so SameSite=Strict still holds and nothing cross-site
// gains anything: the cookie stays HttpOnly and Secure, and the Kernel remains
// the only thing that decides what a session may see.
const COOKIE_DOMAIN = 'agentsearth.com';

function cookieDomainFor(req) {
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '');
  // Previews and localhost keep a host-only cookie; only the real domain widens.
  return host === COOKIE_DOMAIN || host.endsWith(`.${COOKIE_DOMAIN}`) ? `; Domain=.${COOKIE_DOMAIN}` : '';
}

function setOwnerCookie(res, token, req, maxAge = 30 * 24 * 60 * 60) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/${cookieDomainFor(req)}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}

function clearOwnerCookie(res, req) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/${cookieDomainFor(req)}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && new URL(origin).host !== host) throw new Error('cross-site request refused');
}

async function kernel(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(KERNEL_URL + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({ ok: false, why: 'Kernel returned an invalid response' }));
  return { status: response.status, data };
}

function send(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(data);
}

module.exports = { clearOwnerCookie, kernel, ownerToken, requireSameOrigin, send, setOwnerCookie };
