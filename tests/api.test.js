const test = require('node:test');
const assert = require('node:assert/strict');

function response() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('claim proxy stores the owner ticket only in an HTTP-only cookie', async () => {
  const original = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    ok: true, ownerSession: 'secret-owner-ticket', profile: { agentId: 'agent:a', agentName: 'A', ownerName: 'Owner' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const handler = require('../api/claim');
    const req = { method: 'POST', headers: { origin: 'https://home.test', host: 'home.test' }, body: { claimToken: 'EARTH-valid' } };
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.profile.agentId, 'agent:a');
    assert.equal('ownerSession' in res.body, false);
    assert.match(res.headers['Set-Cookie'], /HttpOnly/);
    assert.match(res.headers['Set-Cookie'], /Secure/);
    assert.match(res.headers['Set-Cookie'], /SameSite=Strict/);
  } finally {
    global.fetch = original;
  }
});

test('claim proxy refuses cross-site mutation requests', async () => {
  const handler = require('../api/claim');
  const req = { method: 'POST', headers: { origin: 'https://evil.test', host: 'home.test' }, body: { claimToken: 'EARTH-any' } };
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.why, /cross-site/i);
});

test('session proxy forwards only the opaque owner cookie as bearer authority', async () => {
  const original = global.fetch;
  let authorization = '';
  global.fetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    return new Response(JSON.stringify({ ok: true, profile: { agentId: 'agent:a' } }), { status: 200 });
  };
  try {
    const handler = require('../api/session');
    const req = { method: 'GET', headers: { cookie: 'earth_owner=opaque-ticket' } };
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(authorization, 'Bearer opaque-ticket');
  } finally {
    global.fetch = original;
  }
});

test('governance proxy requires same-origin founder authority and forwards only an allowed policy', async () => {
  const original = global.fetch;
  let forwarded;
  global.fetch = async (_url, options) => {
    forwarded = options;
    return new Response(JSON.stringify({ ok: true, landPolicy: 'founder_review' }), { status: 200 });
  };
  try {
    const handler = require('../api/governance');
    const req = {
      method: 'POST', headers: { origin: 'https://home.test', host: 'home.test', cookie: 'earth_owner=founder-ticket' },
      body: { landPolicy: 'founder_review' },
    };
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(forwarded.headers.Authorization, 'Bearer founder-ticket');
    assert.deepEqual(JSON.parse(forwarded.body), { landPolicy: 'founder_review' });

    const bad = response();
    await handler({ ...req, body: { landPolicy: 'make_me_admin' } }, bad);
    assert.equal(bad.statusCode, 400);
  } finally {
    global.fetch = original;
  }
});

test('owner notification center reads and marks private notices with cookie authority', async () => {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true, notifications: [] }), { status: 200 });
  };
  try {
    const handler = require('../api/notifications');
    const headers = { origin: 'https://home.test', host: 'home.test', cookie: 'earth_owner=owner-ticket' };
    await handler({ method: 'GET', headers }, response());
    await handler({ method: 'POST', headers }, response());
    assert.match(calls[0].url, /owner\/notifications$/);
    assert.match(calls[1].url, /owner\/notifications\/read$/);
    assert.equal(calls[1].options.headers.Authorization, 'Bearer owner-ticket');
  } finally {
    global.fetch = original;
  }
});

test('autonomy proxy accepts only bounded standing-consent modes', async () => {
  const original = global.fetch;
  let body;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true, autonomy: body.autonomy }), { status: 200 });
  };
  try {
    const handler = require('../api/autonomy');
    const req = { method: 'POST', headers: { origin: 'https://home.test', host: 'home.test', cookie: 'earth_owner=owner-ticket' }, body: { autonomy: 'active' } };
    const ok = response(); await handler(req, ok);
    assert.deepEqual(body, { autonomy: 'active' });
    const bad = response(); await handler({ ...req, body: { autonomy: 'unlimited' } }, bad);
    assert.equal(bad.statusCode, 400);
  } finally {
    global.fetch = original;
  }
});

test('mayor nomination proxy validates a registered agent id', async () => {
  const original = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ ok: true, state: 'pending' }), { status: 200 });
  try {
    const handler = require('../api/mayor');
    const req = { method: 'POST', headers: { origin: 'https://home.test', host: 'home.test', cookie: 'earth_owner=founder-ticket' }, body: { targetAgentId: 'agent:trusted-candidate' } };
    const ok = response(); await handler(req, ok); assert.equal(ok.statusCode, 200);
    const bad = response(); await handler({ ...req, body: { targetAgentId: 'not-an-agent' } }, bad); assert.equal(bad.statusCode, 400);
  } finally {
    global.fetch = original;
  }
});
