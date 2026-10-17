# Private database proof

This operator workflow exports a masked snapshot of actual stored users, linked OAuth accounts and sessions. It is not a chronological login-event log. The current schema does not retain historical sign-in events or login timestamps.

## Hosted console

Open the existing VEYRA Neon resource in Vercel Storage and choose **Query**. Keep **Read-only** checked and run `scripts/database-proof.sql`. The result contains counts, masked names, hashed account references, provider flags and session status. No token values, emails, full names, raw user/provider identifiers, avatar URLs or connection credentials are selected.

Copy the returned JSON object into `output/private/veyra-database-proof.json`. The console's default Copy results format is CSV; choose JSON or extract the `snapshot` object before saving. Do not copy the full user or session tables.

## Direct connection

With an authorized `DATABASE_URL` configured privately in the server environment, run:

```sh
npm run db:proof
```

The script uses verified TLS for remote PostgreSQL, a bounded connection/query timeout and a read-only transaction. It runs the same SELECT and writes the masked snapshot locally. It does not create, update or delete records. It logs aggregate counts and a checksum, never connection details.

## PDF

After `npm ci`, install Python's `reportlab`, `fonttools`, `brotli` and `pypdf` if needed, then run:

```sh
python scripts/create-database-proof.py
```

The PDF goes to `output/pdf/VEYRA-Private-Database-Proof.pdf`. The snapshot and PDF are excluded by `.gitignore` and `.vercelignore`. They are not public application assets or API responses. Review a report before sharing it and refresh the snapshot when current counts matter.

The checksum identifies the exported JSON; it is not an independent attestation. Active sessions are unexpired database sessions, not a count of people currently viewing a page. Stored accounts are not necessarily unique people. A zero session count does not identify when someone last logged in.

`tests/database-proof.test.ts` runs the actual SQL against embedded PostgreSQL with clearly fictional fixtures, checking empty and populated results, counts and exclusion of identity/token values. Hosted verification uses the authenticated database console; local test results do not prove hosted configuration.
