import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// db is null when POSTGRES_URL is not set (stateless / OAuth-only mode).
// Callers that need DB must check isDbConfigured before using db.
export const isDbConfigured = !!process.env.POSTGRES_URL;

const client = isDbConfigured
  ? postgres(process.env.POSTGRES_URL!, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: "require",
    })
  : null;

export const db = client ? drizzle(client) : null;

export function getDb() {
  if (!db) throw new Error("Database not configured — set POSTGRES_URL (locally: docker/.env, production: Vercel env vars)");
  return db;
}
