const { kernel, ownerToken, send } = require('../lib/kernel');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, why: 'method not allowed' });
  try {
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'not owner-bound' });
    const result = await kernel('/v1/owner/approvals', { token });
    return send(res, result.status, result.data);
  } catch {
    return send(res, 503, { ok: false, why: 'Earth Kernel is temporarily unavailable' });
  }
};
