---
name: GitHub backup snapshot model
description: How the GitHub backup of this repo works, why history is not pushed, and how to update the backup
---

# GitHub backup — snapshot model

Remote: `origin` = https://github.com/LACibermedicina/tele.M3D.pro.final (public, default branch `main`).

**Rule:** the local branch history (~390 commits) can NEVER be pushed as-is — it contains a 183 MB PDF (`attached_assets/dokumen.pub_medicina-interna-de-harrison-*.pdf`) that exceeds GitHub's 100 MB hard limit. GitHub rejects the whole pack. Remote `main` is therefore an **unrelated snapshot history**, not the local branch history. Do not set upstream tracking between local branches and `origin/main`, and never try a plain `git push origin <branch>:main` (non-fast-forward + oversized blob).

**Why:** user chose snapshot backup over destructive history rewrite (July 2026). Also excluded from the backup by user-safety choice: the two ~45 MB Harrison 21st-ed PDFs (`attached_assets/d40733b1-*_1-Reduced-Harrison-21st_*.pdf`, `client/public/uploads/references/harrison-principles-internal-medicine-21ed.pdf`) — copyrighted books in a public repo risk DMCA. Note: the app's AI reference feature reads the `client/public/uploads/references/` copy at runtime; a restore from GitHub will miss it.

**How to update the backup (fast-forward snapshot chain):**
1. Get token: credential proxy `GET https://$REPLIT_CONNECTORS_HOSTNAME/api/v2/connection?include_secrets=true` with `X_REPLIT_TOKEN: repl $REPL_IDENTITY`; find `connector_name === 'github'`, use `settings.access_token`. (Filtering with `connector_names=github` returned 0 items — list unfiltered.)
2. Temp index: `GIT_INDEX_FILE=/tmp/idx git add -A .` then `git update-index --force-remove` the excluded PDFs.
3. `git write-tree` → `git commit-tree <tree> -p <current remote main sha> -m "..."` (parent = remote main tip keeps pushes fast-forward; author `LACibermedicina <LACibermedicina@users.noreply.github.com>`).
4. Push via askpass helper (username `x-access-token`, password = token; never put token in argv/URL): `git push origin <commit>:refs/heads/main`.
5. Verify via API that `branches/main` sha matches and blob count ≈ `git ls-files | wc -l` minus exclusions.

**Connector quirk:** the account-level GitHub connection needed `proposeIntegration("connection:conn_…")` (user confirmation) before the credential proxy returned it for this Repl; `addIntegration` alone reported `connectionAlreadyAdded` but bound nothing. In the code_execution sandbox `process` is not a global — use `(await import('process')).env`. `spawnSync` is blocked ("blocked the event loop") — use async `spawn`.
