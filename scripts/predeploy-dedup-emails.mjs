#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[predeploy-dedup-emails] DATABASE_URL not set; skipping");
  process.exit(0);
}

const sql = neon(url);

try {
  const before = await sql`
    SELECT LOWER(email) AS lemail, COUNT(*)::int AS n
    FROM users
    WHERE email IS NOT NULL
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
  `;

  if (before.length === 0) {
    console.log("[predeploy-dedup-emails] no case-insensitive duplicates found; nothing to do");
    process.exit(0);
  }

  console.log(
    `[predeploy-dedup-emails] found ${before.length} duplicate group(s):`,
    before.map((r) => `${r.lemail} (x${r.n})`).join(", "),
  );

  const updated = await sql`
    WITH dups AS (
      SELECT id, email,
             ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at, id) AS rn
      FROM users
      WHERE email IS NOT NULL
    )
    UPDATE users u
    SET email = CASE
      WHEN position('@' IN d.email) > 0
        THEN regexp_replace(d.email, '@', '+dup-' || u.id::text || '@')
      ELSE d.email || '+dup-' || u.id::text
    END
    FROM dups d
    WHERE u.id = d.id AND d.rn > 1
    RETURNING u.id, u.email
  `;

  console.log(
    `[predeploy-dedup-emails] renamed ${updated.length} row(s):`,
    updated.map((r) => `${r.id} -> ${r.email}`).join("; "),
  );

  const after = await sql`
    SELECT LOWER(email) AS lemail, COUNT(*)::int AS n
    FROM users
    WHERE email IS NOT NULL
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
  `;

  if (after.length > 0) {
    console.error(
      "[predeploy-dedup-emails] duplicates STILL present after dedup; aborting deploy:",
      after,
    );
    process.exit(1);
  }

  console.log("[predeploy-dedup-emails] dedup complete; safe to create unique index");
} catch (err) {
  console.error("[predeploy-dedup-emails] failed:", err);
  process.exit(1);
}
