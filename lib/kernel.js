const KERNEL_URL = (process.env.EARTH_KERNEL_URL || 'https://site.178-128-99-81.sslip.io').replace(/\/$/, '');
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

function setOwnerCookie(res, token, maxAge = 30 * 24 * 60 * 60) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}

function clearOwnerCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
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
