const { kernel, ownerToken, requireSameOrigin, send } = require('../lib/kernel');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
  try {
    requireSameOrigin(req);
    const token = ownerToken(req);
    if (!token) return send(res, 401, { ok: false, why: 'connect an owner-bound agent before joining an event' });
    const eventId = String(req.body?.eventId || '').trim();
    const decision = req.body?.decision;
    if (!eventId.startsWith('event:')) throw new Error('invalid community event id');
    if (decision !== 'accept' && decision !== 'decline') throw new Error('event response must be accept or decline');
    const result = await kernel('/v1/owner/event-rsvp', {
      method: 'POST', token, body: { eventId, decision },
    });
    return send(res, result.status, result.data);
  } catch (error) {
    return send(res, 400, { ok: false, why: error.message || 'event response failed' });
  }
};
