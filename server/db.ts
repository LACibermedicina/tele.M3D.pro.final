import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

function getDatabaseUrl(): string | null {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.startsWith("postgresql://")) {
    return dbUrl;
  }

  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  if (PGHOST && PGUSER && PGDATABASE) {
    const password = PGPASSWORD || dbUrl || "";
    const port = PGPORT || "5432";
    return `postgresql://${PGUSER}:${password}@${PGHOST}:${port}/${PGDATABASE}?sslmode=require`;
  }

  return null;
}

export function isDatabaseUrlConfigured(): boolean {
  return getDatabaseUrl() !== null;
}

function createPool(): pg.Pool {
  const url = getDatabaseUrl();
  if (!url) {
    console.error(
      "DATABASE_URL is not set. Database operations will fail until it is configured (e.g. via /instalar).",
    );
    // Placeholder pool: construction never connects; queries will fail loudly.
    return new Pool({
      connectionString: "postgresql://not_configured:not_configured@127.0.0.1:1/not_configured",
    });
  }
  return new Pool({ connectionString: url });
}

let currentPool: pg.Pool = createPool();
let currentDb = drizzle(currentPool, { schema });

/**
 * Recreates the pg pool + drizzle instance from the current environment.
 * Used by the /instalar installer so a repaired DATABASE_URL takes effect
 * without a manual server restart. The old pool is drained in background.
 */
export function reinitializeDatabase(): void {
  const oldPool = currentPool;
  currentPool = createPool();
  currentDb = drizzle(currentPool, { schema });
  oldPool.end().catch(() => {
    /* old pool may already be broken; ignore */
  });
}

function liveProxy<T extends object>(getTarget: () => T): T {
  return new Proxy({} as T, {
    get(_ignored, prop) {
      const target = getTarget() as any;
      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(_ignored, prop) {
      return prop in (getTarget() as any);
    },
  });
}

// Exported as live proxies so every module that imported { db, pool } keeps
// working after reinitializeDatabase() swaps the underlying instances.
export const pool: pg.Pool = liveProxy(() => currentPool);
export const db: ReturnType<typeof drizzle<typeof schema>> = liveProxy(() => currentDb);
