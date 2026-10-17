import "dotenv/config";
import pg from "pg";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in your private server environment.");
  process.exit(1);
}
let pool;
try {
  const url = new URL(process.env.DATABASE_URL.trim());
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    url.searchParams.set("sslmode", "verify-full");
  pool = new pg.Pool({
    connectionString: url.href,
    max: 1,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  const client = await pool.connect();
  let snapshot;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = 8000");
    const query = await readFile(
      new URL("./database-proof.sql", import.meta.url),
      "utf8",
    );
    snapshot = (await client.query(query)).rows[0].snapshot;
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  snapshot.source = url.hostname.endsWith(".neon.tech")
    ? "Hosted Neon PostgreSQL"
    : "Configured PostgreSQL";
  snapshot.capture_method =
    "Direct PostgreSQL query in a read-only transaction";
  const serialized = JSON.stringify(snapshot, null, 2);
  const path = "output/private/veyra-database-proof.json";
  await mkdir("output/private", { recursive: true });
  await writeFile(path, serialized, { mode: 0o600 });
  console.log(
    JSON.stringify({
      path,
      users: snapshot.totals.users,
      linkedAccounts: snapshot.totals.linked_accounts,
      activeSessions: snapshot.totals.active_sessions,
      sha256: createHash("sha256").update(serialized).digest("hex"),
    }),
  );
} catch {
  console.error(
    "Database proof failed. Check the private connection and read permissions. No connection details are logged.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
