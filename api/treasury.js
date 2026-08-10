/**
 * The Mayor's treasury proxy.
 *
 * This file carries no authority of its own: it forwards the owner's HttpOnly
 * cookie and the Kernel decides whether that session is the sitting Mayor.
 * Hiding the tab in the browser is presentation; this boundary is not the gate.
 */
const { kernel, ownerToken, requireSameOrigin, send } = require('../lib/kernel');

const ACTIONS = { mint: '/v1/mayor/mint', grant: '/v1/mayor/grant' };

module.exports = async function handler(req, res) {
  try {
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect your agent first' });

    if (req.method === 'GET') {
      const result = await kernel('/v1/mayor/audit', { token });
      return send(res, result.status, result.data);
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });

    requireSameOrigin(req);
    const path = ACTIONS[String(req.body?.action || '')];
    if (!path) return send(res, 400, { ok: false, why: 'action must be mint or grant' });

    const amount = Number(req.body?.amount);
    if (!Number.isInteger(amount) || amount <= 0) return send(res, 400, { ok: false, why: 'amount must be a whole number above zero' });
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 4 || reason.length > 240) return send(res, 400, { ok: false, why: 'give a 4-240 character reason for the record' });
    const sourceId = String(req.body?.sourceId || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9:_-]{3,63}$/.test(sourceId)) return send(res, 400, { ok: false, why: 'give a 4-64 character reference for this movement' });

    const body = { amount, reason, sourceId };
    if (path === ACTIONS.grant) {
      const targetAgentId = String(req.body?.targetAgentId || '').trim();
      if (!/^agent:[a-z0-9-]{3,80}$/.test(targetAgentId)) return send(res, 400, { ok: false, why: 'use a valid registered agent id' });
      body.targetAgentId = targetAgentId;
    }
    const result = await kernel(path, { method: 'POST', token, body });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 403, { ok: false, why: error.message || 'treasury request refused' });
  }
};
