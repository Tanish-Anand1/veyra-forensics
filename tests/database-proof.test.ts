import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("database proof returns real counts and masked records without identity or token values", async () => {
  const database = new PGlite();
  try {
    await database.exec(await readFile("migrations/001_auth.sql", "utf8"));
    const query = await readFile("scripts/database-proof.sql", "utf8");
    type Snapshot = {
      totals: Record<string, number>;
      accounts: {
        masked_name: string;
        google: boolean;
        github: boolean;
        active_sessions: number;
      }[];
    };
    const empty = (await database.query<{ snapshot: Snapshot }>(query)).rows[0]
      .snapshot;
    assert.equal(empty.totals.users, 0);
    assert.deepEqual(empty.accounts, []);
    const first = "10000000-0000-4000-8000-000000000001";
    const second = "10000000-0000-4000-8000-000000000002";
    await database.query(
      "INSERT INTO users (id,name,email) VALUES ($1,$2,$3),($4,$5,$6)",
      [
        first,
        "Private Example",
        "private@example.test",
        second,
        "Another Person",
        "another@example.test",
      ],
    );
    await database.query(
      'INSERT INTO accounts ("userId",type,provider,"providerAccountId") VALUES ($1,$2,$3,$4),($5,$6,$7,$8)',
      [
        first,
        "oidc",
        "google",
        "private-provider-subject",
        second,
        "oauth",
        "github",
        "private-github-subject",
      ],
    );
    const token = "b".repeat(64);
    await database.query(
      'INSERT INTO sessions ("sessionToken","userId",expires) VALUES ($1,$2,NOW()+INTERVAL \'1 day\')',
      [token, first],
    );
    const snapshot = (await database.query<{ snapshot: Snapshot }>(query))
      .rows[0].snapshot;
    assert.equal(snapshot.totals.users, 2);
    assert.equal(snapshot.totals.google_accounts, 1);
    assert.equal(snapshot.totals.github_accounts, 1);
    assert.equal(snapshot.totals.active_sessions, 1);
    assert.equal(snapshot.totals.hashed_session_records, 1);
    assert.equal(snapshot.totals.retained_provider_tokens, 0);
    assert.equal(snapshot.accounts.length, 2);
    assert.ok(
      snapshot.accounts.some(
        (row) =>
          row.google &&
          row.masked_name === "P*******" &&
          row.active_sessions === 1,
      ),
    );
    const exported = JSON.stringify(snapshot);
    for (const value of [
      first,
      second,
      "Private Example",
      "Another Person",
      "private@example.test",
      "private-provider-subject",
      "private-github-subject",
      token,
    ])
      assert.ok(!exported.includes(value));
    assert.equal(
      (
        await database.query<{ count: number }>(
          "SELECT COUNT(*)::int AS count FROM users",
        )
      ).rows[0].count,
      2,
    );
  } finally {
    await database.close();
  }
});
