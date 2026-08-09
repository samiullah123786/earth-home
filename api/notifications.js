const { kernel, ownerToken, requireSameOrigin, send } = require('../lib/kernel');

module.exports = async function handler(req, res) {
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
};
