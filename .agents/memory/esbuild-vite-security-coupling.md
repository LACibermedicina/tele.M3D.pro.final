---
name: esbuild/vite security upgrade coupling
description: Why clearing the esbuild HIGH advisory forces a vite major upgrade (and the supporting bumps)
---

# Clearing the esbuild dev-server advisories drags in a vite major upgrade

The HIGH esbuild advisory (dev-server CORS, GHSA-gv7w-rqvm-qjhr) is only
patched in **esbuild 0.28.1**. You cannot satisfy it with the esbuild that
vite 5.x ships.

**Why:** vite 5.4 hard-pins esbuild `<0.22`. Forcing `overrides:
{ esbuild: "^0.28.1" }` makes vite 5.4 call esbuild with a transform target
it no longer supports — the dev server and `npm run build` fail with ~1196
"Transforming destructuring to the configured target environment is not
supported yet" errors. So the override alone is a dead end on vite 5.

**How to apply:** To clear these dev-tooling vulns you must upgrade the whole
chain together:
- `vite` -> `^7.x` (compatible with esbuild 0.28; also clears vite advisory
  GHSA-4w7w-66w2-5vf9).
- `@vitejs/plugin-react` -> `^5.2.0` (its peer accepts vite 7; v6 needs vite 8
  plus rolldown/babel peers).
- `@types/node` -> `^20.19.0` (vite 7 peer requires >=20.19; the repo was
  pinned at 20.16.x which blocks the install with an ERESOLVE).
- keep `overrides: { esbuild: "^0.28.1" }` — even vite 7 bundles esbuild 0.25,
  which still trips the HIGH advisory, so the override is still required.

Node 20.20 satisfies vite 7/8 engines (`^20.19.0`). `@tailwindcss/vite` peer
warns (peers vite ^5||^6) but it is NOT used in vite.config (tailwind loads via
PostCSS), so the warning is harmless.

All these vulns are dev/build tooling only — no production runtime impact.
Do NOT edit vite.config.ts / server/vite.ts / drizzle.config.ts / package.json
scripts; this upgrade needs none of them.
