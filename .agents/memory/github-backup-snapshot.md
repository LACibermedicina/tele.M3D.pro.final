---
name: GitHub backup full-history model
description: How the GitHub backup of this repo works (full rewritten history since July 2026), what is excluded, and how to update it safely
---

# GitHub backup — full rewritten history

Remote: `origin` = https://github.com/LACibermedicina/tele.M3D.pro.final (public, default branch `main`).

**Model (since July 13, 2026):** remote `main` holds the FULL local history rewritten to exclude three PDFs (866 commits vs local 868; two commits became empty and were dropped). It is NOT the same commit chain as the local platform-managed branch — local SHAs differ from remote SHAs for every commit. Never push the local branch as-is: it still contains a 183 MB PDF blob that exceeds GitHub's 100 MB hard limit.

**Excluded from backup (permanently, by rewrite):**
- `attached_assets/dokumen.pub_medicina-interna-de-harrison-volumes-1-e-2-19-ed_*.pdf` (183 MB — over GitHub limit)
- `attached_assets/d40733b1-*_1-Reduced-Harrison-21st_*.pdf` and `client/public/uploads/references/harrison-principles-internal-medicine-21ed.pdf` (~45 MB each — copyrighted books in a public repo, DMCA risk; user-safety choice)
- **Why:** GitHub rejects packs with >100 MB blobs; user previously chose to keep copyrighted textbooks out of the public repo. Note: the AI reference feature reads the `client/public/uploads/references/` copy at runtime; a restore from GitHub will miss it.

**How to update the backup:**
1. NEVER rewrite or push the workspace repo directly (platform-managed). Clone to /tmp: `git clone --branch <branch> --single-branch file:///home/runner/workspace /tmp/rewrite`.
2. Run git-filter-repo (single-file script; fetch from newren/git-filter-repo raw if missing): `--force --invert-paths --path <each excluded PDF>`.
3. Verify: no harrison/dokumen blobs in `git rev-list --objects HEAD`; largest blob < 100 MB via `git verify-pack -v`.
4. Token: credential proxy `GET https://$REPLIT_CONNECTORS_HOSTNAME/api/v2/connection?include_secrets=true` with `X_REPLIT_TOKEN: repl $REPL_IDENTITY`; find `connector_name === 'github'`, use `settings.access_token`. (`listConnections('github')` in the sandbox returned 0 — use the proxy directly, unfiltered.)
5. Push via askpass helper (username `x-access-token`, password from env var; never token in argv/URL): `git push --force github HEAD:refs/heads/main` from /tmp/rewrite.
6. Since remote is now the rewritten history, incremental updates can alternatively re-run the same filter (deterministic on unchanged history) — pushes will be fast-forward if local history only appended commits.
7. Verify via API that `branches/main` sha matches the rewritten tip and the recursive tree has no excluded files.

**Sandbox quirks:** `process` is not a global — use `(await import('process')).env`. `spawnSync` is blocked — use async `spawn`.
