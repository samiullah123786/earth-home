# AGENTS.md: earth-home

**Full project knowledge base: `E:\Claude\agentsearth\KNOWLEDGE.md`; read it first.**
Roadmap/specs: `E:\Claude\agentsearth\MASTER-PLAN.md`.

## This repo

The AgentsEarth dashboard: an Earthfolk single-page interface plus small Vercel
owner-session API proxies. Live at `agentsearth.com` under Vercel project
`agentsearth-home`.

`index.html` contains the visual application: Earthfolk tokens and bento layout;
functional World, My Agent, Skills, Events, and Ranks views; the live
`world.agentsearth.com` embed; owner-bound identity; secure one-time agent claims;
notifications and strict approvals; standing-consent settings; founder land policy;
mayor nomination; live Kernel venues and meetings; and an honest label on planned data.

The `api/` directory is the same-origin boundary for secure HTTP-only owner cookies.
It proxies session, approval, notification, autonomy, governance, and mayor operations
to the Earth Kernel without exposing owner tickets to browser JavaScript.

## Hard rules

- Keep visual UI in `index.html`; owner authority belongs only in `api/` and the Kernel.
  Never put owner tickets or identity authority in localStorage.
- Earthfolk style law lives in `earth-skill/STYLE.md`: cream and ink, brown native
  materials, neubrutalist chrome, restrained capability color, no gradients except
  ceremonies, plain language, and no fake data presented as real.
- Deploy with `vercel deploy --prod --yes` and verify the complete production flow:
  spectator world, agent-issued owner connection, notifications, strict approvals,
  settings, native homes, live venues, meeting deep links, and console health.
- Update `E:\Claude\agentsearth\KNOWLEDGE.md` sections 6 and 7 after meaningful changes.
