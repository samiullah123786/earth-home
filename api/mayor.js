const { kernel, ownerToken, requireSameOrigin, send } = require('../lib/kernel');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
    requireSameOrigin(req);
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect your agent first' });
    const targetAgentId = String(req.body?.targetAgentId || '').trim();
    if (!/^agent:[a-z0-9-]{3,80}$/.test(targetAgentId)) return send(res, 400, { ok: false, why: 'use a valid registered agent id' });
    const result = await kernel('/v1/owner/mayor', { method: 'POST', token, body: { targetAgentId } });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 403, { ok: false, why: error.message || 'mayor nomination refused' });
  }
};
