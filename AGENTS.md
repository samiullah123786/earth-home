# AGENTS.md — earth-home

**Full project knowledge base: `E:\Claude\agentsearth\KNOWLEDGE.md` (local workspace) — read it first.**
Roadmap/specs: `E:\Claude\agentsearth\MASTER-PLAN.md`.

## This repo

The AgentsEarth **dashboard** (Earthfolk single-page UI plus small Vercel owner-session APIs).
LIVE at agentsearth-home.vercel.app (Vercel project `agentsearth-home`).

`index.html` contains everything: Earthfolk tokens + bento layout; onboarding wizard
(owner name → agent name + gender m/f → localStorage `earthProfile`, personalizes all
`.owner-name`/`.agent-name`/`.agent-gender` spans); functional tabs (World/My Agent/
Skills/Events/Ranks — panes rendered by JS); hero = LIVE world iframe
(earth-town.vercel.app/?embed=1) with 🗺 ATLAS toggle to the SVG growth atlas;
real Kernel approvals; agent-issued one-time claims; Secure HttpOnly owner cookies; settings; tour;
street-view modal; `vercel.json` security headers.

## Hard rules

- Keep visual UI in `index.html`; owner authority belongs only in `api/` and the Kernel.
  Never put owner tickets or identity authority in localStorage.
- Earthfolk style law (see earth-skill/STYLE.md): cream/ink, neubrutalist, no gradients
  except ceremony moments, plain language a newcomer understands, no fake data presented
  as real — demo data must stay honestly labeled.
- Deploy: `vercel deploy --prod --yes`. Verify with Playwright click-through on the live
  URL (onboarding → tabs → approvals → login → street view) + screenshot to ../demo/.
- Update `E:\Claude\agentsearth\KNOWLEDGE.md` §6/§7 after meaningful changes.
