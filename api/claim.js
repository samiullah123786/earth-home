const { kernel, requireSameOrigin, send, setOwnerCookie } = require('../lib/kernel');

module.exports = async function handler(req, res) {
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
};
