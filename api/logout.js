const { clearOwnerCookie, kernel, ownerToken, requireSameOrigin, send } = require('../lib/kernel');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
  try {
    requireSameOrigin(req);
    const token = ownerToken(req);
    if (token) await kernel('/v1/owner/logout', { method: 'POST', token });
    clearOwnerCookie(res);
    return send(res, 200, { ok: true });
  } catch (error) {
    clearOwnerCookie(res);
    return send(res, 400, { ok: false, why: error.message || 'logout failed' });
  }
};
