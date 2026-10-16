import pg from "pg";
import PostgresAdapter from "@auth/pg-adapter";
import { createHash } from "node:crypto";
import type { Adapter } from "@auth/core/adapters";

export function databasePool() {
  if (!process.env.DATABASE_URL) return undefined;
  let connectionString = process.env.DATABASE_URL;
  try {
    const url = new URL(connectionString);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      url.searchParams.set("sslmode", "verify-full");
      connectionString = url.href;
    }
  } catch {
    return undefined;
  }
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 8_000,
    query_timeout: 10_000,
  });
  pool.on("error", () =>
    console.error(JSON.stringify({ event: "database_pool_error" })),
  );
  return pool;
}

export function privateAdapter(pool: pg.Pool): Adapter {
  const adapter = PostgresAdapter(pool);
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  return {
    ...adapter,
    async linkAccount({ userId, provider, providerAccountId, type }) {
      await adapter.linkAccount!({ userId, provider, providerAccountId, type });
    },
    async createSession(session) {
      await adapter.createSession!({
        ...session,
        sessionToken: hash(session.sessionToken),
      });
      return session;
    },
    async getSessionAndUser(token) {
      const result = await adapter.getSessionAndUser!(hash(token));
      return result
        ? { ...result, session: { ...result.session, sessionToken: token } }
        : null;
    },
    async updateSession(session) {
      const result = await pool.query(
        'UPDATE sessions SET expires = COALESCE($2, expires) WHERE "sessionToken" = $1 RETURNING *',
        [hash(session.sessionToken), session.expires ?? null],
      );
      return result.rows[0]
        ? { ...result.rows[0], sessionToken: session.sessionToken }
        : null;
    },
    async deleteSession(token) {
      await adapter.deleteSession!(hash(token));
    },
  };
}
