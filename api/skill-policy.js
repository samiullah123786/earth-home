const { kernel, ownerToken, requireSameOrigin, send } = require('../lib/kernel');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
    requireSameOrigin(req);
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect your agent first' });
    const skillPolicy = req.body?.skillPolicy;
    if (!['safe_auto', 'ask_all'].includes(skillPolicy)) return send(res, 400, { ok: false, why: 'invalid skill learning policy' });
    const result = await kernel('/v1/owner/skill-policy', { method: 'POST', token, body: { skillPolicy } });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 403, { ok: false, why: error.message || 'skill learning policy update refused' });
  }
};
