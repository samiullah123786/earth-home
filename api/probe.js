/**
 * The MCP handshake prober: proof an endpoint is alive, without running it.
 *
 * Deliberately NOT on the Kernel. The droplet hosts the Kernel itself, and
 * outbound fetches to publisher-supplied URLs from that box would be an SSRF
 * path into our own backend. This function runs in Vercel's isolated network,
 * where nothing of ours lives to be reached.
 *
 * Read-only by construction: it speaks exactly two JSON-RPC methods -
 * `initialize` and `tools/list` - and never `tools/call`. HTTPS only, no
 * redirects followed, no credentials, no custom ports, and hosts that shape
 * like private space are refused before any packet leaves.
 */
const { requireSameOrigin, send } = require('../lib/kernel');

const TIMEOUT_MS = 6_000;

function refuseUrl(raw) {
  let url;
  try { url = new URL(String(raw ?? '')); } catch { return 'that is not a URL'; }
  if (url.protocol !== 'https:') return 'https only';
  if (url.username || url.password) return 'no credentials in probe URLs';
  if (url.port && url.port !== '443') return 'no custom ports';
  const host = url.hostname.toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return 'no IP-literal hosts';
  if (!host.includes('.')) return 'no bare hostnames';
  if (/(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/.test(host)) return 'no private-shaped hosts';
  if (host.endsWith('.agentsearth.com') || host === 'agentsearth.com') return 'the prober does not probe Earth itself';
  return null;
}

async function rpc(url, sessionId, method, params, id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });
    if (response.status >= 300 && response.status < 400) {
      return { error: 'endpoint redirects; probes do not follow' };
    }
    const session = response.headers.get('mcp-session-id') ?? sessionId ?? null;
    const raw = await response.text();
    // Streamable HTTP replies either as plain JSON or as SSE data lines.
    let payload = null;
    try { payload = JSON.parse(raw); } catch {
      const dataLine = raw.split('\n').find((line) => line.startsWith('data:'));
      if (dataLine) { try { payload = JSON.parse(dataLine.slice(5)); } catch { /* fallthrough */ } }
    }
    if (!payload) return { error: `unparseable reply (${response.status})`, session };
    return { result: payload.result ?? null, rpcError: payload.error ?? null, session, status: response.status };
  } catch (error) {
    return { error: error.name === 'AbortError' ? 'timed out' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, why: 'method not allowed' });
  try {
    requireSameOrigin(req);
  } catch {
    return send(res, 403, { ok: false, why: 'same-origin only' });
  }
  const url = String(req.body?.url ?? '').trim();
  const refusal = refuseUrl(url);
  if (refusal) return send(res, 400, { ok: false, why: refusal });

  const hello = await rpc(url, null, 'initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'earth-market-prober', version: '1' },
  }, 1);
  if (hello.error) return send(res, 200, { ok: true, alive: false, why: hello.error });
  if (hello.rpcError) return send(res, 200, { ok: true, alive: false, why: `server error: ${String(hello.rpcError.message ?? '').slice(0, 120)}` });

  const serverInfo = hello.result?.serverInfo ?? {};
  const listing = await rpc(url, hello.session, 'tools/list', {}, 2);
  const tools = Array.isArray(listing.result?.tools) ? listing.result.tools : [];

  return send(res, 200, {
    ok: true,
    alive: true,
    protocolVersion: String(hello.result?.protocolVersion ?? '').slice(0, 40),
    serverName: String(serverInfo.name ?? 'unnamed').slice(0, 80),
    serverVersion: String(serverInfo.version ?? '').slice(0, 40),
    toolCount: tools.length,
    tools: tools.slice(0, 10).map((tool) => String(tool?.name ?? '').slice(0, 60)).filter(Boolean),
    note: 'read-only handshake: initialize and tools/list, never tools/call',
  });
};
