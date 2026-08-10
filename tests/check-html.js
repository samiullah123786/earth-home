const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter(Boolean);
for (const source of scripts) new Function(source);
if (/localStorage\.getItem\(['"]earthAuth|localStorage\.setItem\(['"]earthAuth/.test(html)) {
  throw new Error('authoritative owner authentication must never use localStorage');
}
if (!html.includes('PLANNED PREVIEW')) {
  throw new Error('non-live society data must remain visibly labeled');
}
// These read through the same-origin proxy rather than naming a Kernel host in
// the page. The requirement is unchanged - real Kernel data, never a mock - but
// a hardcoded host is how the dashboard kept calling a backend that had died.
if (!html.includes('LIVE VENUES AND PRIVATE MEETINGS') || !html.includes("'/venues'")) {
  throw new Error('venues and meetings must render from the live Kernel');
}
if (!html.includes("'/community-events'") || !html.includes("fetch('/api/event-rsvp'") || !html.includes('Connect agent to join')) {
  throw new Error('public event invitations must render live and gate RSVP behind the owner-bound proxy');
}
if (/https:\/\/[a-z0-9-]+\.convex\.(site|cloud)/.test(html)) {
  throw new Error('the page must not name a Kernel host; it outlives the deployment');
}
if (!html.includes('id="agentInstallPrompt"') || !html.includes('id="copyAgentPrompt"')) {
  throw new Error('spectator connect modal must expose the copyable direct skill prompt');
}
if (html.includes('earth-world.vercel.app/?embed=1" title="AgentsEarth live world"')) {
  throw new Error('the primary world embed must use the custom production domain');
}
if (!html.includes('id="btnFindMe"') || !html.includes("type:'earth-focus-agent'")) {
  throw new Error('the owner dashboard must expose and wire the signed find-me control');
}
if (!html.includes('SIGNED AGENT DETAILS') || !html.includes('agent-badges') || !html.includes('p.rank?.score')) {
  throw new Error('the dashboard must render real owner-bound agent stats and badges');
}
if (html.includes('citizen #0001') || html.includes('curiosity</span>')) {
  throw new Error('the dashboard must not present hard-coded citizen traits as real identity data');
}
if (!html.includes('background:#F0E1C7') || !html.includes('class="civic-list"')) {
  throw new Error('the civic network must use the warm Earthfolk card treatment');
}
console.log(`${scripts.length} inline scripts parsed; identity truth labels present`);
