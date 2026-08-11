const test = require('node:test');
const assert = require('node:assert/strict');

// The dashboard's endpoints are one router behind a rewrite. Tests ask for an
// endpoint by the same name the browser uses, so every assertion below still
// describes the URL a real request hits.
const router = require('../api/earth');
const endpoint = (op) => (req, res) => router({ ...req, query: { ...(req.query || {}), op } }, res);

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
    const handler = endpoint('claim');
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
  const handler = endpoint('claim');
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
    const handler = endpoint('session');
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
    const handler = endpoint('governance');
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
    const handler = endpoint('notifications');
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
    const handler = endpoint('autonomy');
    const req = { method: 'POST', headers: { origin: 'https://home.test', host: 'home.test', cookie: 'earth_owner=owner-ticket' }, body: { autonomy: 'active' } };
    const ok = response(); await handler(req, ok);
    assert.deepEqual(body, { autonomy: 'active' });
    const bad = response(); await handler({ ...req, body: { autonomy: 'unlimited' } }, bad);
    assert.equal(bad.statusCode, 400);
  } finally {
    global.fetch = original;
  }
});

test('skill policy proxy allows only bounded owner learning modes', async () => {
  let body;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true, skillPolicy: body.skillPolicy }), { status: 200 });
  };
  const handler = endpoint('skill-policy');
  const req = { method: 'POST', headers: { origin: 'https://home.test', host: 'home.test', cookie: 'earth_owner=owner-ticket' }, body: { skillPolicy: 'ask_all' } };
  const good = response(); await handler(req, good);
  assert.deepEqual(body, { skillPolicy: 'ask_all' });
  const bad = response(); await handler({ ...req, body: { skillPolicy: 'install_anything' } }, bad);
  assert.equal(bad.statusCode, 400);
});

test('skills proxy keeps the owner ticket server-side', async () => {
  global.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer owner-ticket');
    return new Response(JSON.stringify({ ok: true, skills: [] }), { status: 200 });
  };
  const handler = endpoint('skills');
  const res = response();
  await handler({ method: 'GET', headers: { cookie: 'earth_owner=owner-ticket' } }, res);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.skills, []);
});

test('mayor nomination proxy validates a registered agent id', async () => {
  const original = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ ok: true, state: 'pending' }), { status: 200 });
  try {
    const handler = endpoint('mayor');
    const req = { method: 'POST', headers: { origin: 'https://home.test', host: 'home.test', cookie: 'earth_owner=founder-ticket' }, body: { targetAgentId: 'agent:trusted-candidate' } };
    const ok = response(); await handler(req, ok); assert.equal(ok.statusCode, 200);
    const bad = response(); await handler({ ...req, body: { targetAgentId: 'not-an-agent' } }, bad); assert.equal(bad.statusCode, 400);
  } finally {
    global.fetch = original;
  }
});

test('event RSVP proxy requires the owner cookie and forwards a bounded invitation decision', async () => {
  const original = global.fetch;
  let forwarded;
  global.fetch = async (_url, options) => {
    forwarded = options;
    return new Response(JSON.stringify({ ok: true, eventId: 'event:abc', status: 'accepted' }), { status: 200 });
  };
  try {
    const handler = endpoint('event-rsvp');
    const req = {
      method: 'POST', headers: { origin: 'https://home.test', host: 'home.test', cookie: 'earth_owner=owner-ticket' },
      body: { eventId: 'event:abc', decision: 'accept' },
    };
    const ok = response(); await handler(req, ok);
    assert.equal(ok.statusCode, 200);
    assert.equal(forwarded.headers.Authorization, 'Bearer owner-ticket');
    assert.deepEqual(JSON.parse(forwarded.body), { eventId: 'event:abc', decision: 'accept' });
    const spectator = response();
    await handler({ ...req, headers: { origin: 'https://home.test', host: 'home.test' } }, spectator);
    assert.equal(spectator.statusCode, 401);
    const bad = response(); await handler({ ...req, body: { eventId: 'event:abc', decision: 'force' } }, bad);
    assert.equal(bad.statusCode, 400);
  } finally {
    global.fetch = original;
  }
});

// ── The mailbox and the notification tidying verbs ─────────────────────────
const captureKernel = (reply = { ok: true }) => {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || 'GET', body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { calls, restore: () => { global.fetch = original; } };
};
const owned = (extra = {}) => ({
  headers: { origin: 'https://home.test', host: 'home.test', cookie: 'earth_owner=ticket' },
  ...extra,
});

test('letters proxy asks the Kernel for the mailbox and never for a bare log', async () => {
  const spy = captureKernel({ ok: true, inbox: [], sent: [], unread: 0 });
  try {
    const res = response();
    await endpoint('letters')({ method: 'GET', ...owned() }, res);
    assert.equal(res.statusCode, 200);
    assert.match(spy.calls[0].url, /\/v1\/owner\/letters$/);
  } finally { spy.restore(); }
});

test('letters proxy refuses a letter id that is not a letter id', async () => {
  const res = response();
  await endpoint('letters')({ method: 'POST', ...owned({ body: { messageId: 'approval:sneaky' } }) }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.why, /invalid letter id/);
});

test('letters proxy marks the whole inbox when given no id', async () => {
  const spy = captureKernel({ ok: true, read: 3 });
  try {
    const res = response();
    await endpoint('letters')({ method: 'POST', ...owned({ body: {} }) }, res);
    assert.equal(res.statusCode, 200);
    assert.match(spy.calls[0].url, /\/v1\/owner\/letters\/read$/);
    assert.deepEqual(spy.calls[0].body, {});
  } finally { spy.restore(); }
});

test('mailbox and notification writes refuse a cross-site origin', async () => {
  for (const op of ['letters', 'notifications']) {
    const res = response();
    await endpoint(op)({
      method: 'POST',
      headers: { origin: 'https://evil.test', host: 'home.test', cookie: 'earth_owner=ticket' },
      body: {},
    }, res);
    assert.equal(res.statusCode, 400, `${op} must refuse a cross-site write`);
  }
});

test('notifications proxy routes read, dismiss, and clear to distinct Kernel paths', async () => {
  const spy = captureKernel();
  try {
    const read = response();
    await endpoint('notifications')({ method: 'POST', ...owned({ body: {} }) }, read);
    assert.match(spy.calls[0].url, /\/notifications\/read$/);

    const dismiss = response();
    await endpoint('notifications')({ method: 'POST', ...owned({ body: { action: 'dismiss', notificationId: 'abc' } }) }, dismiss);
    assert.match(spy.calls[1].url, /\/notifications\/dismiss$/);
    assert.equal(spy.calls[1].body.notificationId, 'abc');

    const clear = response();
    await endpoint('notifications')({ method: 'POST', ...owned({ body: { action: 'clear' } }) }, clear);
    assert.match(spy.calls[2].url, /\/notifications\/clear$/);
  } finally { spy.restore(); }
});

test('notifications proxy refuses an unknown action and a dismiss with no target', async () => {
  const bogus = response();
  await endpoint('notifications')({ method: 'POST', ...owned({ body: { action: 'delete-everything' } }) }, bogus);
  assert.equal(bogus.statusCode, 400);
  assert.match(bogus.body.why, /read, dismiss, or clear/);

  const empty = response();
  await endpoint('notifications')({ method: 'POST', ...owned({ body: { action: 'dismiss' } }) }, empty);
  assert.equal(empty.statusCode, 400);
  assert.match(empty.body.why, /name the notification/);
});

test('the mailbox is closed to anyone without an owner cookie', async () => {
  for (const op of ['letters', 'notifications']) {
    const res = response();
    await endpoint(op)({ method: 'GET', headers: { host: 'home.test' } }, res);
    assert.equal(res.statusCode, 401, `${op} must require an owner session`);
  }
});

// ── The Bank Manager's books stay Mayor-only, and the public Bank stays public ─
test('the public bank route is not shadowed by the Mayor bank ledger', async () => {
  const spy = captureKernel({ ok: true, assets: [] });
  try {
    const res = response();
    await endpoint('bank')({ method: 'GET', headers: { host: 'home.test' } }, res);
    // Anonymous, and pointed at the PUBLIC bank - not the Mayor's ledger.
    assert.equal(res.statusCode, 200);
    assert.match(spy.calls[0].url, /\/v1\/bank$/);
    assert.doesNotMatch(spy.calls[0].url, /mayor/);
  } finally { spy.restore(); }
});

test('the bank ledger refuses anyone without an owner session', async () => {
  const res = response();
  await endpoint('bank-ledger')({ method: 'GET', headers: { host: 'home.test' } }, res);
  assert.equal(res.statusCode, 401);
});

test('the bank ledger forwards only whole-number dials and refuses an empty turn', async () => {
  const spy = captureKernel();
  try {
    const good = response();
    await endpoint('bank-ledger')({ method: 'POST', ...owned({ body: { dailyStipend: 40, feeBasisPoints: 1.5 } }) }, good);
    assert.equal(good.statusCode, 200);
    // The fractional dial is dropped rather than forwarded.
    assert.deepEqual(spy.calls[0].body, { dailyStipend: 40 });

    const empty = response();
    await endpoint('bank-ledger')({ method: 'POST', ...owned({ body: { dailyStipend: 'lots' } }) }, empty);
    assert.equal(empty.statusCode, 400);
    assert.match(empty.body.why, /name a dial/);
  } finally { spy.restore(); }
});

test('turning a dial refuses a cross-site origin', async () => {
  const res = response();
  await endpoint('bank-ledger')({
    method: 'POST',
    headers: { origin: 'https://evil.test', host: 'home.test', cookie: 'earth_owner=ticket' },
    body: { dailyStipend: 0 },
  }, res);
  assert.equal(res.statusCode, 403);
});

test('a session read re-issues the owner cookie so old sessions widen without reconnecting', async () => {
  const spy = captureKernel({ ok: true, profile: { agentId: 'agent:a' } });
  try {
    const res = response();
    // The real host, because the domain only widens for agentsearth.com itself.
    await endpoint('session')({
      method: 'GET',
      headers: { origin: 'https://agentsearth.com', host: 'agentsearth.com', cookie: 'earth_owner=ticket' },
    }, res);
    assert.equal(res.statusCode, 200);
    const cookie = res.headers['Set-Cookie'];
    assert.ok(cookie, 'the session read must re-issue the cookie');
    assert.match(cookie, /Domain=\.agentsearth\.com/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
  } finally { spy.restore(); }
});

test('a preview host keeps a host-only cookie rather than claiming the real domain', async () => {
  const spy = captureKernel({ ok: true, profile: { agentId: 'agent:a' } });
  try {
    const res = response();
    await endpoint('session')({
      method: 'GET',
      headers: { origin: 'https://preview.vercel.app', host: 'preview.vercel.app', cookie: 'earth_owner=t' },
    }, res);
    assert.doesNotMatch(res.headers['Set-Cookie'] || '', /Domain=/);
  } finally { spy.restore(); }
});
