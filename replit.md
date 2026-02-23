# Medical Practice Management App

## Overview
A full-stack medical practice management application built with Express.js backend and React frontend.

## Architecture
- **Backend**: Express.js with TypeScript (`server/`)
- **Frontend**: React with Vite (`client/`)
- **Database**: PostgreSQL via Neon (Drizzle ORM with `drizzle-orm/node-postgres`)
- **Shared types**: `shared/schema.ts`

## Key Files
- `server/db.ts` - Database connection (constructs URL from individual PG env vars if DATABASE_URL is not a full connection string)
- `server/routes.ts` - API routes
- `server/storage.ts` - Database storage layer
- `server/index.ts` - Server entry point
- `shared/schema.ts` - Drizzle schema and types (46 tables)
- `client/src/App.tsx` - Frontend entry point

## Database
- PostgreSQL hosted on Neon (heliumdb)
- Uses `drizzle-orm/node-postgres` with `pg` driver
- Environment variables: `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- Schema migrations via `npm run db:push`
- On startup, creates default doctor user and schedule if not present

## AI Services
- **Primary**: Google Gemini API (`gemini-2.0-flash`) via `server/services/gemini.ts`
- **Fallback**: Replit OpenAI AI Integrations (`gpt-4o-mini`) — auto-fallback when Gemini quota/rate limits are hit
- **Environment**: `GEMINI_API_KEY`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- **Integration files**: `server/replit_integrations/` (chat, audio, image, batch)

## Dependencies
- jspdf v4.2.0 (PDF generation)
- openai (for Replit AI Integrations fallback)
- See `package.json` for full list

## Running
- `npm run dev` starts the development server (Express + Vite on port 5000)
