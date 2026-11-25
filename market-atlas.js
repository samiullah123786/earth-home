/*
 * The Skill Atlas: every skill Earth lists, on one map.
 *
 * Reads the published skill map (graph.json) straight from GitHub Pages, so
 * browsing the atlas costs the AgentsEarth server nothing. Three panes:
 *   index  - family > area > skill, the hierarchy as a list you can tab through
 *   map    - the same skills as a constellation; lines are real relationships
 *            ("requires", "pairs with") declared in each listing, never inferred
 *   card   - one skill: what it does, who wrote it, its licence and safety
 *            verdict, and the two ways to use it (read it live, or install a copy)
 *
 * Everything shown traces to graph.json. Strings from listings are escaped even
 * though the build validates them, for the same reason the vault does it.
 */
(() => {
  'use strict';

  const DEFAULT_BASE = 'https://samiullah123786.github.io/earth-skills/';
  // A local preview may point the atlas at a locally built map: ?skills=<base>.
  // Only honoured on localhost, so a crafted link cannot reskin the real market.
  const override = new URLSearchParams(location.search).get('skills');
  const BASE = override && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? override : DEFAULT_BASE;
  const REPO = 'https://github.com/samiullah123786/earth-skills';
  const MCP_ADD = 'claude mcp add earth-skills -- npx -y github:samiullah123786/earth-skills serve';

  const root = document.getElementById('atlas');
  if (!root) return;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let graph = null;
  let byId = new Map();
  let familyById = new Map();
  let selected = null;
  let query = '';
  const open = new Set();
  const previewCache = new Map();

  // ---------- data ----------
  async function load() {
    renderSkeleton();
    try {
      const response = await fetch(`${BASE}graph.json`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`GitHub Pages answered ${response.status}`);
      graph = await response.json();
      if (graph.version !== 1 || !Array.isArray(graph.skills)) throw new Error('the map is in a shape this page does not read');
    } catch (error) {
      renderError(error.message);
      return;
    }
    byId = new Map(graph.skills.map((skill) => [skill.id, skill]));
    familyById = new Map(graph.families.map((family) => [family.id, family]));
    document.dispatchEvent(new CustomEvent('atlas:loaded', { detail: graph.counts }));
    const fromHash = idFromHash();
    if (fromHash && byId.has(fromHash)) {
      selected = fromHash;
      open.add(byId.get(fromHash).family);
    }
    renderShell();
  }

  const idFromHash = () => {
    const match = /^#atlas\/([a-z0-9-]+)$/.exec(location.hash);
    return match ? match[1] : null;
  };

  const neighbours = (id) => {
    const out = { requires: [], requiredBy: [], pairs: [] };
    for (const edge of graph.edges) {
      if (edge.kind === 'requires') {
        if (edge.from === id) out.requires.push(edge.to);
        if (edge.to === id) out.requiredBy.push(edge.from);
      } else if (edge.kind === 'pairs') {
        if (edge.from === id) out.pairs.push(edge.to);
        if (edge.to === id) out.pairs.push(edge.from);
      }
    }
    return out;
  };

  const matches = (skill) => {
    if (!query) return true;
    const hay = `${skill.id} ${skill.title} ${skill.summary} ${skill.tags.join(' ')} ${skill.area} ${skill.family} ${skill.author}`.toLowerCase();
    return query.split(/\s+/).every((word) => hay.includes(word));
  };

  // ---------- states ----------
  function renderSkeleton() {
    root.innerHTML = `
      <div class="atlas-grid" aria-busy="true">
        <div class="atlas-index">${'<div class="sk-line"></div>'.repeat(9)}</div>
        <div class="atlas-map sk-box"><span>Reading the skill map…</span></div>
        <div class="atlas-card">${'<div class="sk-line"></div>'.repeat(6)}</div>
      </div>`;
  }

  function renderError(why) {
    root.innerHTML = `
      <div class="atlas-empty" role="alert">
        <b>The skill map could not be read.</b>
        <p>${esc(why)}. The map is served from GitHub Pages, not from Earth's own server,
          so the rest of this market still works while it is away.</p>
        <button type="button" class="submit-cta" id="atlasRetry">Try again</button>
      </div>`;
    document.getElementById('atlasRetry').addEventListener('click', load);
  }

  // ---------- shell ----------
  function renderShell() {
    const built = graph.generatedAt ? new Date(graph.generatedAt) : null;
    root.innerHTML = `
      <div class="atlas-meta">
        <span><b>${graph.counts.skills}</b> skills</span>
        <span><b>${graph.skills.filter((s) => s.served).length}</b> readable live</span>
        <span><b>${graph.counts.edges}</b> declared connections</span>
        <span><b>${graph.families.reduce((n, f) => n + f.areas.filter((a) => a.skills.length).length, 0)}</b> areas in use</span>
        ${built ? `<span class="atlas-built">built ${esc(built.toISOString().slice(0, 10))}${graph.commit
          ? ` from <a href="${REPO}/commit/${esc(graph.commit)}" rel="noopener">${esc(graph.commit.slice(0, 7))}</a>` : ''}</span>` : ''}
      </div>
      <div class="atlas-grid">
        <nav class="atlas-index" aria-label="Skill hierarchy">
          <label class="atlas-search-label" for="atlasSearch">Find a skill</label>
          <input id="atlasSearch" class="atlas-search" type="search" autocomplete="off"
                 placeholder="debugging, seo, pdf…" value="${esc(query)}">
          <div id="atlasTree"></div>
        </nav>
        <div class="atlas-map" id="atlasMap"></div>
        <aside class="atlas-card" id="atlasCard" aria-live="polite"></aside>
      </div>`;
    const search = document.getElementById('atlasSearch');
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      if (query) graph.families.forEach((family) => {
        if (graph.skills.some((skill) => skill.family === family.id && matches(skill))) open.add(family.id);
      });
      renderTree();
      renderMap();
    });
    renderTree();
    renderMap();
    renderCard();
  }

  // ---------- index ----------
  function renderTree() {
    const tree = document.getElementById('atlasTree');
    const html = graph.families.map((family) => {
      const skills = graph.skills.filter((skill) => skill.family === family.id);
      const shown = skills.filter(matches);
      if (query && !shown.length) return '';
      const isOpen = open.has(family.id);
      const areas = family.areas.map((area) => {
        const inArea = shown.filter((skill) => skill.area === area.id);
        if (query && !inArea.length) return '';
        return `<li class="atlas-area">
            <div class="atlas-area-name">${esc(area.title)} <i>${area.skills.length}</i></div>
            ${inArea.length ? `<ul>${inArea.map((skill) => `
              <li><button type="button" class="atlas-skill-btn${skill.id === selected ? ' on' : ''}"
                    data-skill="${esc(skill.id)}" aria-current="${skill.id === selected}">${esc(skill.title)}</button></li>`).join('')}</ul>`
              : '<p class="atlas-none">Nothing listed here yet.</p>'}
          </li>`;
      }).join('');
      return `<div class="atlas-family" style="--fam:${esc(family.color)}">
          <button type="button" class="atlas-family-btn" aria-expanded="${isOpen}" data-family="${esc(family.id)}">
            <span class="atlas-swatch" aria-hidden="true"></span>
            <span class="atlas-family-title">${esc(family.title)}</span>
            <span class="atlas-count">${query ? `${shown.length}/` : ''}${skills.length}</span>
          </button>
          ${isOpen ? `<ul class="atlas-areas">${areas}</ul>` : ''}
        </div>`;
    }).join('');
    tree.innerHTML = html || `<p class="atlas-none">No skill matches “${esc(query)}”.
      <button type="button" class="atlas-link" id="atlasClear">Clear the search</button></p>`;
    tree.querySelectorAll('[data-family]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.family;
      if (open.has(id)) open.delete(id); else open.add(id);
      renderTree();
    }));
    tree.querySelectorAll('[data-skill]').forEach((button) => button.addEventListener('click', () => select(button.dataset.skill)));
    document.getElementById('atlasClear')?.addEventListener('click', () => {
      query = '';
      document.getElementById('atlasSearch').value = '';
      renderTree();
      renderMap();
    });
  }

  // ---------- map ----------
  // A fixed coordinate space; the SVG scales to its box. Layout is computed
  // once per load with a deterministic start, so the map never reshuffles
  // between visits and the same skill is always in the same place.
  const W = 1000;
  const H = 640;
  let layout = null;

  function computeLayout() {
    const families = graph.families.filter((family) => graph.skills.some((skill) => skill.family === family.id));
    const nodes = [];
    const links = [];
    const index = new Map();
    const add = (node) => { index.set(node.key, nodes.length); nodes.push(node); return node; };
    families.forEach((family, i) => {
      const angle = (i / families.length) * Math.PI * 2 - Math.PI / 2;
      const anchor = add({ key: `f:${family.id}`, type: 'family', family: family.id, fixed: true,
        x: W / 2 + Math.cos(angle) * W * 0.34, y: H / 2 + Math.sin(angle) * H * 0.33 });
      const areas = family.areas.filter((area) => area.skills.length);
      areas.forEach((area, j) => {
        const spread = angle + (j - (areas.length - 1) / 2) * 0.55;
        const hub = add({ key: `a:${family.id}/${area.id}`, type: 'area', family: family.id, area,
          x: anchor.x + Math.cos(spread) * 60, y: anchor.y + Math.sin(spread) * 60 });
        links.push({ a: anchor.key, b: hub.key, len: 70, k: 0.35 });
        area.skills.forEach((id, n) => {
          const turn = spread + (n - (area.skills.length - 1) / 2) * 0.7;
          add({ key: `s:${id}`, type: 'skill', id, family: family.id,
            x: hub.x + Math.cos(turn) * 55, y: hub.y + Math.sin(turn) * 55 });
          links.push({ a: hub.key, b: `s:${id}`, len: 58, k: 0.45 });
        });
      });
    });
    for (const edge of graph.edges) {
      links.push({ a: `s:${edge.from}`, b: `s:${edge.to}`, len: 170, k: 0.04 });
    }
    // A small, bounded spring simulation. Run to rest before the first paint,
    // so nothing wobbles on screen and reduced-motion has nothing to disable.
    for (let step = 0; step < 360; step += 1) {
      const cool = 1 - step / 360;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i]; const b = nodes[j];
          let dx = b.x - a.x; let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = 1; dy = 0; d2 = 1; }
          // Skills carry a text label to their right, so they need more room
          // from each other than from the area diamonds.
          const minGap = a.type === 'family' || b.type === 'family' ? 0
            : a.type === 'skill' && b.type === 'skill' ? 74 : 60;
          const force = (minGap * minGap * 1.6) / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * force; const fy = (dy / d) * force;
          if (!a.fixed) { a.x -= fx * cool; a.y -= fy * cool; }
          if (!b.fixed) { b.x += fx * cool; b.y += fy * cool; }
        }
      }
      for (const link of links) {
        const a = nodes[index.get(link.a)]; const b = nodes[index.get(link.b)];
        if (!a || !b) continue;
        const dx = b.x - a.x; const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const pull = (d - link.len) * link.k * cool;
        const fx = (dx / d) * pull; const fy = (dy / d) * pull;
        if (!a.fixed) { a.x += fx; a.y += fy; }
        if (!b.fixed) { b.x -= fx; b.y -= fy; }
      }
    }
    // Fit everything that is drawn into the frame with room for labels.
    const drawn = nodes.filter((node) => node.type !== 'family');
    const xs = drawn.map((n) => n.x); const ys = drawn.map((n) => n.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const pad = { l: 40, r: 170, t: 50, b: 40 };
    const scale = Math.min((W - pad.l - pad.r) / Math.max(1, maxX - minX), (H - pad.t - pad.b) / Math.max(1, maxY - minY), 1.6);
    for (const node of nodes) {
      node.x = pad.l + (node.x - minX) * scale + ((W - pad.l - pad.r) - (maxX - minX) * scale) / 2;
      node.y = pad.t + (node.y - minY) * scale + ((H - pad.t - pad.b) - (maxY - minY) * scale) / 2;
    }
    const at = new Map(nodes.map((node) => [node.key, node]));
    // Family labels sit above the topmost member of each family.
    const familyLabels = families.map((family) => {
      const members = drawn.filter((node) => node.family === family.id);
      const cx = members.reduce((s, n) => s + n.x, 0) / members.length;
      const top = Math.min(...members.map((n) => n.y));
      return { family, x: cx, y: Math.max(18, top - 26) };
    });
    return { nodes: drawn, at, familyLabels };
  }

  // Greedy label placement: the selected skill and its neighbours first, then
  // the best-connected skills. Each label tries the right side, then the left;
  // a label that would collide is hidden and shows on hover or keyboard focus.
  function placeLabels(focus, u, sparse) {
    const charW = 6.9 * u; const lineH = 15 * u;
    const boxes = [];
    const hit = (b) => boxes.some((o) => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
    const skillNodes = layout.nodes.filter((n) => n.type === 'skill');
    for (const n of skillNodes) boxes.push({ x1: n.x - 9 * u, x2: n.x + 9 * u, y1: n.y - 9 * u, y2: n.y + 9 * u });
    for (const l of layout.familyLabels) {
      const w = l.family.title.length * 9 * u;
      boxes.push({ x1: l.x - w / 2, x2: l.x + w / 2, y1: l.y - 12 * u, y2: l.y + 4 * u });
    }
    // Area names go next, so they win over ordinary skill labels but never
    // print on top of each other; a crowded one waits for its area to be lit.
    const areaShown = new Set();
    const areaLit = (n) => n.area.skills.some((id) => id === selected || focus?.has(id));
    const areaNodes = layout.nodes.filter((m) => m.type === 'area' && !sparse)
      .sort((a, b) => Number(areaLit(b)) - Number(areaLit(a)) || b.area.skills.length - a.area.skills.length);
    for (const n of areaNodes) {
      const w = n.area.title.length * 6.4 * u;
      const box = { x1: n.x - w / 2, x2: n.x + w / 2, y1: n.y - 18 * u, y2: n.y - 5 * u };
      if (hit(box)) continue;
      boxes.push(box);
      areaShown.add(n.key);
    }
    const degree = (id) => Object.values(neighbours(id)).flat().length;
    const rank = (n) => (n.id === selected ? -1e6 : focus?.has(n.id) ? -1e5 : 0) - degree(n.id);
    const placed = new Map();
    for (const n of [...skillNodes].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))) {
      const isFocus = n.id === selected || focus?.has(n.id);
      if (sparse && !isFocus) continue;
      const w = byId.get(n.id).title.length * charW * (n.id === selected ? 1.15 : 1);
      const off = 12 * u;
      const right = { x1: n.x + off, x2: n.x + off + w, y1: n.y - lineH / 2, y2: n.y + lineH / 2 };
      const left = { x1: n.x - off - w, x2: n.x - off, y1: right.y1, y2: right.y2 };
      const fits = (b) => b.x1 >= 0 && b.x2 <= W;
      let side = null;
      if (fits(right) && !hit(right)) side = 'right';
      else if (fits(left) && !hit(left)) side = 'left';
      else if (n.id === selected) side = fits(right) ? 'right' : 'left';
      if (!side) continue;
      boxes.push(side === 'right' ? right : left);
      placed.set(n.id, side);
    }
    placed.areas = areaShown;
    return placed;
  }

  function renderMap() {
    const box = document.getElementById('atlasMap');
    if (!graph.skills.length) {
      box.innerHTML = '<div class="atlas-map-empty">No skills are listed yet. The first ones arrive by pull request.</div>';
      return;
    }
    layout ??= computeLayout();
    // Keep type and strokes the same size on screen whatever the map's width:
    // --u is SVG units per CSS pixel. Narrow screens show only focused labels.
    const width = box.clientWidth || W;
    const u = Math.min(2.4, Math.max(1, W / width));
    const sparse = width < 560;
    const focus = selected ? new Set([selected, ...Object.values(neighbours(selected)).flat()]) : null;
    // A search wins over the selection: while typing, the map lights matches.
    const lit = (id) => (query ? matches(byId.get(id)) : !focus || focus.has(id));
    const colour = (familyId) => familyById.get(familyId)?.color ?? '#5C5346';

    const hier = layout.nodes.filter((n) => n.type === 'skill').map((n) => {
      const hub = layout.at.get(`a:${n.family}/${byId.get(n.id).area}`);
      return `<line class="m-hier${lit(n.id) ? '' : ' dim'}" x1="${hub.x.toFixed(1)}" y1="${hub.y.toFixed(1)}"
        x2="${n.x.toFixed(1)}" y2="${n.y.toFixed(1)}" stroke="${esc(colour(n.family))}"/>`;
    }).join('');

    const rel = graph.edges.map((edge) => {
      const a = layout.at.get(`s:${edge.from}`); const b = layout.at.get(`s:${edge.to}`);
      if (!a || !b) return '';
      const on = query || !focus ? true : edge.from === selected || edge.to === selected;
      const shown = on && matches(byId.get(edge.from)) && matches(byId.get(edge.to));
      // A gentle bow keeps parallel relationships apart without a router.
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.12;
      const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12;
      return `<path class="m-rel m-${edge.kind}${shown ? (focus && !query ? ' hot' : '') : ' dim'}"
        d="M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}"
        ${edge.kind === 'requires' ? 'marker-end="url(#m-arrow)"' : ''}/>`;
    }).join('');

    const place = placeLabels(query ? new Set(graph.skills.filter(matches).map((s) => s.id)) : focus, u, sparse);
    const areas = layout.nodes.filter((n) => n.type === 'area').map((n) => {
      const any = n.area.skills.some((id) => lit(id));
      return `<g class="m-area${any ? '' : ' dim'}" transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})">
        <rect x="${-4 * u}" y="${-4 * u}" width="${8 * u}" height="${8 * u}" transform="rotate(45)" fill="${esc(colour(n.family))}"/>
        ${place.areas.has(n.key) ? `<text y="${-10 * u}" text-anchor="middle">${esc(n.area.title.toUpperCase())}</text>` : `<title>${esc(n.area.title)}</title>`}</g>`;
    }).join('');

    const labelText = (n, size, u2) => {
      const side = place.get(n.id) ?? 'none';
      const gap = size / 2 + 6 * u2;
      return side === 'left'
        ? `<text x="${-gap}" y="${4 * u2}" text-anchor="end">${esc(byId.get(n.id).title)}</text>`
        : `<text x="${gap}" y="${4 * u2}">${esc(byId.get(n.id).title)}</text>`;
    };
    const skills = layout.nodes.filter((n) => n.type === 'skill').map((n) => {
      const skill = byId.get(n.id);
      const isSel = n.id === selected;
      const size = (isSel ? 15 : 11) * u;
      return `<g class="m-skill${lit(n.id) ? '' : ' dim'}${place.has(n.id) ? '' : ' nl'}${isSel ? ' sel' : ''}${focus && focus.has(n.id) && !isSel ? ' near' : ''}" data-skill="${esc(n.id)}"
          transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})" tabindex="0" role="button"
          aria-label="${esc(skill.title)}, ${esc(familyById.get(skill.family)?.title)} / ${esc(skill.area)}">
        <rect class="m-shadow" x="${-size / 2 + 2.5 * u}" y="${-size / 2 + 2.5 * u}" width="${size}" height="${size}"/>
        <rect class="m-node" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" fill="${esc(colour(n.family))}"/>
        ${skill.served ? '' : `<line class="m-linkonly" x1="${-size / 2}" y1="${size / 2}" x2="${size / 2}" y2="${-size / 2}"/>`}
        ${labelText(n, size, u)}</g>`;
    }).join('');

    const families = layout.familyLabels.map((label) =>
      `<text class="m-family${label.family.areas.some((a) => a.skills.some((id) => lit(id))) ? '' : ' dim'}"
        x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" text-anchor="middle">${esc(label.family.title.toUpperCase())}</text>`).join('');

    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="--u:${u.toFixed(3)}" class="${sparse ? 'sparse' : ''}" role="group" aria-label="Map of ${graph.counts.skills} skills and their declared connections">
        <defs><marker id="m-arrow" viewBox="0 0 8 8" refX="12" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L8,4 L0,8 z" class="m-arrowhead"/></marker></defs>
        <g>${hier}</g><g>${rel}</g><g>${areas}</g><g>${families}</g><g>${skills}</g>
      </svg>
      <div class="atlas-legend" aria-hidden="true">
        <span><i class="lg-req"></i>requires</span>
        <span><i class="lg-pair"></i>pairs with</span>
        <span><i class="lg-hier"></i>belongs to area</span>
        <span><svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"/><line x1="1" y1="13" x2="13" y2="1" stroke="currentColor" stroke-width="2"/></svg>link-only</span>
      </div>`;

    box.querySelectorAll('.m-skill').forEach((node) => {
      node.addEventListener('click', () => select(node.dataset.skill));
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(node.dataset.skill); }
      });
    });
  }

  // ---------- card ----------
  function renderCard() {
    const card = document.getElementById('atlasCard');
    if (!selected || !byId.has(selected)) {
      const busiest = [...graph.skills].sort((a, b) => {
        const na = Object.values(neighbours(a.id)).flat().length;
        const nb = Object.values(neighbours(b.id)).flat().length;
        return nb - na || a.title.localeCompare(b.title);
      }).slice(0, 4).map((skill) => skill.id);
      card.innerHTML = `
        <h3 class="card-kicker">How to read this map</h3>
        <p class="card-p">Each square is a skill, coloured by its family. Lines are relationships the
          listing itself declares: an arrow means one skill expects another to be read first.</p>
        <p class="card-p">Pick a skill to see what it does, its licence, its safety scan, and how to use it.</p>
        ${busiest.length ? `<h3 class="card-kicker">Most connected</h3>
          <div class="card-rel">${busiest.map(relButton).join('')}</div>` : ''}`;
      bindRel(card);
      return;
    }
    const skill = byId.get(selected);
    const family = familyById.get(skill.family);
    const area = family?.areas.find((a) => a.id === skill.area);
    const near = neighbours(skill.id);
    const verdict = skill.safety?.verdict ?? 'not_served';
    const verdictWord = { inert_safe: 'Inert: knowledge only', needs_review: 'Read before use', not_served: 'Not served' }[verdict] ?? verdict;
    card.innerHTML = `
      <div class="card-crumb" style="--fam:${esc(family?.color)}"><span class="atlas-swatch" aria-hidden="true"></span>
        ${esc(family?.title)} / ${esc(area?.title ?? skill.area)}</div>
      <h3 class="card-title" tabindex="-1">${esc(skill.title)}</h3>
      <p class="card-summary">${esc(skill.summary)}</p>
      <dl class="card-facts">
        <div><dt>Author</dt><dd>${esc(skill.author)}</dd></div>
        <div><dt>Licence</dt><dd>${skill.license === 'link-only' ? 'Link only, files not served' : esc(skill.license)}</dd></div>
        <div><dt>Safety</dt><dd><span class="scan-verdict ${esc(verdict === 'not_served' ? 'pending' : verdict)}">${esc(verdictWord)}</span></dd></div>
        ${skill.served ? `<div><dt>Files</dt><dd>${skill.files.length}</dd></div>` : ''}
        <div><dt>Source</dt><dd><a href="${esc(skill.sourceUrl)}" rel="noopener" target="_blank">${skill.kind === 'linked'
          ? `upstream @ ${esc((skill.ref ?? '').slice(0, 7))}` : 'hosted on Earth'}</a></dd></div>
      </dl>
      ${skill.safety?.flags?.length ? `<details class="card-flags"><summary>${skill.safety.flags.length} scan flag${skill.safety.flags.length > 1 ? 's' : ''}: why it needs a read</summary>
        ${(skill.safety.findings ?? []).slice(0, 8).map((f) =>
          `<p class="flag-line">${esc(f.rule)} · ${esc(f.where)}${f.line ? `:${f.line}` : ''}<br><span>${esc(f.detail)}</span></p>`).join('')}
      </details>` : ''}
      ${skill.served ? `
        <div class="card-use" role="group" aria-label="How to use this skill">
          <div class="use-tabs" role="tablist">
            <button type="button" role="tab" class="use-tab on" aria-selected="true" data-use="live">Read it live</button>
            <button type="button" role="tab" class="use-tab" aria-selected="false" data-use="copy">Install a copy</button>
          </div>
          <div class="use-pane" data-pane="live">
            <p class="card-p">Nothing to install per machine. Connect Earth's skill server once, then call the skill by name.</p>
            ${copyBlock(MCP_ADD)}
            ${copyBlock(`/mcp__earth-skills__${skill.id}`)}
          </div>
          <div class="use-pane" data-pane="copy" hidden>
            <p class="card-p">Writes the files into your skills folder after checking the digest. Running
              <code>sync</code> again later updates every copy whose source changed.</p>
            ${copyBlock(`npx -y github:samiullah123786/earth-skills sync ${skill.id} --client claude`)}
          </div>
        </div>
        <details class="card-preview" id="cardPreview"><summary>Read ${esc(skill.entry)}</summary><pre>Loading…</pre></details>`
        : `<p class="card-p">This listing is <b>link-only</b>: its licence does not allow Earth to serve copies, so
            read it at the source.</p>`}
      ${near.requires.length ? `<h3 class="card-kicker">Read first</h3><div class="card-rel">${near.requires.map(relButton).join('')}</div>` : ''}
      ${near.requiredBy.length ? `<h3 class="card-kicker">Builds on this</h3><div class="card-rel">${near.requiredBy.map(relButton).join('')}</div>` : ''}
      ${near.pairs.length ? `<h3 class="card-kicker">Pairs with</h3><div class="card-rel">${near.pairs.map(relButton).join('')}</div>` : ''}
      ${skill.digest ? `<p class="card-digest" title="Recomputed by the sync tool before any file is written">${esc(skill.digest.slice(0, 23))}…</p>` : ''}`;

    card.querySelectorAll('.use-tab').forEach((tab) => tab.addEventListener('click', () => {
      card.querySelectorAll('.use-tab').forEach((t) => { t.classList.toggle('on', t === tab); t.setAttribute('aria-selected', String(t === tab)); });
      card.querySelectorAll('.use-pane').forEach((pane) => { pane.hidden = pane.dataset.pane !== tab.dataset.use; });
    }));
    bindCopy(card);
    bindRel(card);
    const preview = document.getElementById('cardPreview');
    preview?.addEventListener('toggle', () => { if (preview.open) loadPreview(skill, preview.querySelector('pre')); });
  }

  const relButton = (id) => {
    const skill = byId.get(id);
    if (!skill) return '';
    return `<button type="button" class="rel-btn" data-skill="${esc(id)}" style="--fam:${esc(familyById.get(skill.family)?.color)}">
      <span class="atlas-swatch" aria-hidden="true"></span>${esc(skill.title)}</button>`;
  };
  const bindRel = (scope) => scope.querySelectorAll('.rel-btn').forEach((button) =>
    button.addEventListener('click', () => select(button.dataset.skill)));

  const copyBlock = (text) => `<div class="copy-row"><code>${esc(text)}</code>
    <button type="button" class="copy-btn" data-copy="${esc(text)}" aria-label="Copy: ${esc(text)}">Copy</button></div>`;
  const bindCopy = (scope) => scope.querySelectorAll('.copy-btn').forEach((button) => button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select it';
    }
    setTimeout(() => { button.textContent = 'Copy'; }, 1400);
  }));

  async function loadPreview(skill, pre) {
    if (previewCache.has(skill.id)) { pre.textContent = previewCache.get(skill.id); return; }
    try {
      const response = await fetch(`${BASE}skills/${encodeURIComponent(skill.id)}/${skill.entry.split('/').map(encodeURIComponent).join('/')}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const lines = text.split('\n');
      const shown = lines.slice(0, 80).join('\n') + (lines.length > 80 ? `\n\n… ${lines.length - 80} more lines at the source` : '');
      previewCache.set(skill.id, shown);
      pre.textContent = shown;
    } catch (error) {
      pre.textContent = `Could not load the file (${error.message}). It is also readable at the source link above.`;
    }
  }

  // ---------- selection ----------
  // Re-rendering replaces the map and tree nodes; put keyboard focus back on
  // the equivalent node so a keyboard user never loses their place.
  function keepFocus(render) {
    const was = document.activeElement;
    const key = was?.closest?.('#atlas [data-skill], #atlas [data-family]');
    const sel = key && (key.dataset.skill
      ? `${key.classList.contains('m-skill') ? '.m-skill' : key.classList.contains('rel-btn') ? '.rel-btn' : '.atlas-skill-btn'}[data-skill="${CSS.escape(key.dataset.skill)}"]`
      : `[data-family="${CSS.escape(key.dataset.family)}"]`);
    render();
    if (!key || document.contains(was)) return;
    const target = document.querySelector(`#atlas ${sel}`) ?? document.querySelector('#atlas .card-title');
    target?.focus({ preventScroll: true });
  }

  function select(id) {
    if (!byId.has(id)) return;
    selected = id;
    open.add(byId.get(id).family);
    if (location.hash !== `#atlas/${id}`) history.replaceState(null, '', `#atlas/${id}`);
    keepFocus(() => { renderTree(); renderMap(); renderCard(); });
    if (window.matchMedia('(max-width: 879px)').matches) {
      document.getElementById('atlasCard').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  // Re-draw (not re-layout) when the map's width changes, so labels stay legible.
  let lastWidth = 0;
  new ResizeObserver(() => {
    const box = document.getElementById('atlasMap');
    if (!graph || !box || Math.abs(box.clientWidth - lastWidth) < 24) return;
    lastWidth = box.clientWidth;
    renderMap();
  }).observe(root);

  window.addEventListener('hashchange', () => {
    const id = idFromHash();
    if (graph && id && id !== selected) select(id);
  });

  load();
})();
