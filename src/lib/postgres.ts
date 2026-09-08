import { Pool } from "pg";

type CachedPool = {
  pool: Pool;
  url: string;
};

declare global {
  // Keep one pool across hot reloads so dev mode does not exhaust connections.
  var __sailPostgresPool: CachedPool | undefined;
}

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is missing. Set it to your Docker Postgres connection string.");
  }

  return url;
}

export function getPool() {
  const url = getDatabaseUrl();

  if (!globalThis.__sailPostgresPool || globalThis.__sailPostgresPool.url !== url) {
    globalThis.__sailPostgresPool = {
      url,
      pool: new Pool({ connectionString: url }),
    };
  }

  return globalThis.__sailPostgresPool.pool;
}

export function isSafeIdentifier(value: string) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}
