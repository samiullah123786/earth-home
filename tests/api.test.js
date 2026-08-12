const test = require('node:test');
const assert = require('node:assert/strict');

// The dashboard's endpoints are one router behind a rewrite. Tests ask for an
// endpoint by the same name the browser uses, so every assertion below still
// describes the URL a real request hits.
const router = require('../api/earth');
const endpoint = (op) => (req, res) => router({ ...req, query: { ...(req.query || {}), op } }, res);

function response() {
  return {
    headers: {}, statusCode: 200, body: null, raw: '',
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end(value) { this.raw = String(value ?? ''); return this; },
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

test('the wardrobe forwards a whole-number look to the Kernel and refuses the rest', async () => {
  const spy = captureKernel({ ok: true, avatarSpec: { catalogKey: 'citizen_male_creative_07' } });
  try {
    const res = response();
    await endpoint('avatar')({ method: 'POST', ...owned({ body: { variant: 7 } }) }, res);
    assert.equal(res.statusCode, 200);
    assert.match(spy.calls[0].url, /\/v1\/owner\/avatar$/);
    assert.deepEqual(spy.calls[0].body, { variant: 7 });
  } finally { spy.restore(); }

  for (const variant of [16, -1, 2.5, 'green']) {
    const res = response();
    await endpoint('avatar')({ method: 'POST', ...owned({ body: { variant } }) }, res);
    assert.equal(res.statusCode, 400, `variant ${variant} must be refused`);
    assert.match(res.body.why, /16 numbered variants/);
  }

  const anonymous = response();
  await endpoint('avatar')({ method: 'POST', headers: { host: 'home.test' }, body: { variant: 3 } }, anonymous);
  assert.equal(anonymous.statusCode, 401, 'the wardrobe belongs to owners');
});

// ── SEO surfaces: the sitemap and the server-rendered listing pages ────────
test('the sitemap lists the static pages and every valid listing URL', async () => {
  const spy = captureKernel({
    ok: true,
    listings: [
      { id: 'asset:q17az3amva8f8k0grk3q4y62s18cas0s', name: 'quarry-pacing-guide' },
      { id: 'not-a-listing-id', name: 'sneaky' },
    ],
    nextCursor: null,
  });
  try {
    const res = response();
    await endpoint('sitemap')({ method: 'GET', headers: { host: 'agentsearth.com' } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Content-Type'] || res.headers['content-type'] || '', /xml/);
    assert.match(res.raw, /<loc>https:\/\/agentsearth\.com\/market<\/loc>/);
    assert.match(res.raw, /market\/l\/asset:q17az3amva8f8k0grk3q4y62s18cas0s/);
    assert.doesNotMatch(res.raw, /not-a-listing-id/);
  } finally { spy.restore(); }
});

test('a listing page renders escaped HTML with Product JSON-LD, and refuses bad ids', async () => {
  const spy = captureKernel({
    ok: true, id: 'asset:q17az3amva8f8k0grk3q4y62s18cas0s',
    name: 'quarry-pacing-guide<script>alert(1)</script>',
    oneLiner: 'Pace quarry shifts "safely" & well.',
    price: 5, pulls: 2, digest: 'a'.repeat(64),
    earthVerified: { algorithm: 'ed25519' }, author: { name: 'Scout' },
  });
  try {
    const res = response();
    await endpoint('listing')({
      method: 'GET', headers: { host: 'agentsearth.com' },
      query: { id: 'asset:q17az3amva8f8k0grk3q4y62s18cas0s' },
    }, res);
    assert.equal(res.statusCode, 200);
    // The depositor's <script> arrives as text, never as markup.
    assert.doesNotMatch(res.raw, /<script>alert/);
    assert.match(res.raw, /&lt;script&gt;alert/);
    assert.match(res.raw, /"@type":"Product"/);
    assert.match(res.raw, /\\u003cscript/);
    assert.match(res.raw, /EARTH VERIFIED/);
  } finally { spy.restore(); }

  const bad = response();
  await endpoint('listing')({ method: 'GET', headers: { host: 'agentsearth.com' }, query: { id: '../../etc' } }, bad);
  assert.equal(bad.statusCode, 404);
});

test('session and approvals answer a calm 200 anonymous for spectators', async () => {
  // Every visitor loads these two before signing in; a 401 would litter every
  // spectator console with errors for a perfectly ordinary state.
  for (const op of ['session', 'approvals']) {
    const res = response();
    await endpoint(op)({ method: 'GET', headers: { host: 'home.test' } }, res);
    assert.equal(res.statusCode, 200, `${op} must not error for spectators`);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.anonymous, true);
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

// ── The public market proxy stays anonymous and read-only ──────────────────
test('the market proxy lists anonymously and forwards a detail id', async () => {
  const spy = captureKernel({ ok: true, listings: [], total: 0, nextCursor: null });
  try {
    const list = response();
    await endpoint('market')({ method: 'GET', headers: { host: 'home.test' }, query: {} }, list);
    assert.equal(list.statusCode, 200);
    assert.match(spy.calls[0].url, /\/v1\/market\?cursor=0&limit=50$/);

    const detail = response();
    await endpoint('market')({ method: 'GET', headers: { host: 'home.test' }, query: { id: 'asset:abc123' } }, detail);
    assert.match(spy.calls[1].url, /\/v1\/market\/asset%3Aabc123$|\/v1\/market\/asset:abc123$/);
  } finally { spy.restore(); }
});

test('the market proxy refuses writes and malformed ids', async () => {
  const post = response();
  await endpoint('market')({ method: 'POST', headers: { host: 'home.test' }, query: {}, body: {} }, post);
  assert.equal(post.statusCode, 405);
  const bad = response();
  await endpoint('market')({ method: 'GET', headers: { host: 'home.test' }, query: { id: '../v1/owner/wallet' } }, bad);
  assert.equal(bad.statusCode, 400);
});


// -- The MCP prober stays read-only and refuses the dangerous shapes --------
test('the prober refuses non-https, private, and Earth-internal hosts', async () => {
  const cases = [
    ['http://example.com/mcp', /https only/],
    ['https://user:pw@example.com/mcp', /credentials/],
    ['https://example.com:8080/mcp', /custom ports/],
    ['https://10.0.0.1/mcp', /IP-literal/],
    ['https://localhost/mcp', /bare hostnames/],
    ['https://myserver.internal/mcp', /private-shaped/],
    ['https://kernel.agentsearth.com/mcp', /Earth itself/],
  ];
  for (const [url, why] of cases) {
    const res = response();
    await endpoint('probe')({ method: 'POST', ...owned({ body: { url } }) }, res);
    assert.equal(res.statusCode, 400, url + ' must be refused');
    assert.match(res.body.why, why);
  }
});

test('the prober reports a dead endpoint as not alive rather than erroring', async () => {
  const original = global.fetch;
  global.fetch = async () => { throw Object.assign(new Error('nope'), { name: 'TypeError' }); };
  try {
    const res = response();
    await endpoint('probe')({ method: 'POST', ...owned({ body: { url: 'https://example.com/mcp' } }) }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.alive, false);
  } finally { global.fetch = original; }
});

test('the prober does a real read-only handshake and never calls a tool', async () => {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.method);
    const result = body.method === 'initialize'
      ? { protocolVersion: '2025-06-18', serverInfo: { name: 'demo', version: '2.1' } }
      : { tools: [{ name: 'search' }, { name: 'fetch' }] };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }),
      { status: 200, headers: { 'content-type': 'application/json', 'mcp-session-id': 's1' } });
  };
  try {
    const res = response();
    await endpoint('probe')({ method: 'POST', ...owned({ body: { url: 'https://example.com/mcp' } }) }, res);
    assert.equal(res.body.alive, true);
    assert.equal(res.body.serverName, 'demo');
    assert.equal(res.body.toolCount, 2);
    assert.deepEqual(calls, ['initialize', 'tools/list']);
    assert.ok(!calls.includes('tools/call'), 'the prober must never call a tool');
  } finally { global.fetch = original; }
});

test('the prober refuses a cross-site origin', async () => {
  const res = response();
  await endpoint('probe')({
    method: 'POST',
    headers: { origin: 'https://evil.test', host: 'home.test', cookie: 'earth_owner=t' },
    body: { url: 'https://example.com/mcp' },
  }, res);
  assert.equal(res.statusCode, 403);
});
