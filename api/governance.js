const { kernel, ownerToken, requireSameOrigin, send } = require('../lib/kernel');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
    requireSameOrigin(req);
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect your agent first' });
    const landPolicy = req.body?.landPolicy;
    if (landPolicy !== 'service_auto' && landPolicy !== 'founder_review') return send(res, 400, { ok: false, why: 'invalid land policy' });
    const result = await kernel('/v1/owner/governance', { method: 'POST', token, body: { landPolicy } });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 403, { ok: false, why: error.message || 'governance update refused' });
  }
};
