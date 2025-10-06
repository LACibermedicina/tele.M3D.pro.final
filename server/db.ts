import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

neonConfig.webSocketConstructor = ws;

function getDatabaseUrl(): string {
  // First try to get from environment
  let dbUrl = process.env.DATABASE_URL;
  
  // If DATABASE_URL looks incomplete (just a password/key), try to read from file
  if (!dbUrl || !dbUrl.startsWith('postgresql://')) {
    const dbConfigPath = join(process.cwd(), '.db-config');
    if (existsSync(dbConfigPath)) {
      try {
        dbUrl = readFileSync(dbConfigPath, 'utf-8').trim();
        console.log('Using database URL from .db-config file');
      } catch (err) {
        console.error('Error reading .db-config:', err);
      }
    }
  }
  
  if (!dbUrl || !dbUrl.startsWith('postgresql://')) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  
  return dbUrl;
}

const connectionString = getDatabaseUrl();
export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });
