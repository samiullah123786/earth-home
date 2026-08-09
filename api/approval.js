const { kernel, ownerToken, requireSameOrigin, send } = require('../lib/kernel');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
  try {
    requireSameOrigin(req);
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'not owner-bound' });
    const result = await kernel('/v1/owner/approval', {
      method: 'POST', token,
      body: { approvalId: req.body?.approvalId, decision: req.body?.decision },
    });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 400, { ok: false, why: error.message || 'decision failed' });
  }
};
