import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";

if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL before running migrations.");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
});
try {
  await pool.query(
    await readFile(
      new URL("../migrations/001_auth.sql", import.meta.url),
      "utf8",
    ),
  );

  await pool.query("DELETE FROM auth_rate_limits WHERE reset_at < $1", [
    Date.now(),
  ]);
  await pool.query("DELETE FROM sessions WHERE expires < NOW()");
  console.log("Authentication and investigation schema ready.");
} catch {
  console.error(
    "Migration failed. Check database connectivity and migration permissions; no credentials are logged.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
