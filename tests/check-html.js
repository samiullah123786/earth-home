const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).filter(Boolean);
for (const source of scripts) new Function(source);
if (/localStorage\.getItem\(['"]earthAuth|localStorage\.setItem\(['"]earthAuth/.test(html)) {
  throw new Error('authoritative owner authentication must never use localStorage');
}
if (!html.includes('DESIGN PREVIEW') || !html.includes('PLANNED PREVIEW')) {
  throw new Error('non-live society data must remain visibly labeled');
}
console.log(`${scripts.length} inline scripts parsed; identity truth labels present`);
