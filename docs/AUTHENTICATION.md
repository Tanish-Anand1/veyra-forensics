# Authentication and private investigations

The existing stack is Vite/React with Express 5, not Next.js. Authentication uses the official `@auth/express` integration and `@auth/pg-adapter`. Auth.js handles authorization codes, PKCE, OAuth state, Google OIDC nonce, CSRF, cookies and provider callbacks. The Express integration is currently marked experimental upstream; its installed version is locked in `package-lock.json` and covered by HTTP and browser regression tests.

## Required configuration

Set these **server-side** in the deployment environment. Never prefix them with `VITE_`, put values in client code, commit an environment file, or paste credentials into issue reports.

| Variable             | Value                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_URL`           | `http://localhost:3000` locally; `https://veyra-forensics.vercel.app` in production                                                                  |
| `AUTH_SECRET`        | At least 32 cryptographically random characters; generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` |
| `AUTH_GOOGLE_ID`     | Google OAuth web application client ID                                                                                                               |
| `AUTH_GOOGLE_SECRET` | Its client secret                                                                                                                                    |
| `AUTH_GITHUB_ID`     | GitHub OAuth App client ID                                                                                                                           |
| `AUTH_GITHUB_SECRET` | Its client secret                                                                                                                                    |
| `DATABASE_URL`       | PostgreSQL connection string supplied by the database provider, with certificate-verified TLS for remote connections                                 |
| `TRUST_PROXY`        | `1` on the existing Vercel deployment; `0` when serving directly locally                                                                             |

Do not change the existing `OPENAI_API_KEY` or `OPENAI_MODEL` configuration. Auth does not call OpenAI. A single configured OAuth provider can operate independently; an unavailable provider stays visibly disabled. Missing database, secret or providers disables sign-in and private storage while leaving guest analysis available.

Production configuration was completed on 17 October 2026: the dedicated Google and GitHub clients, `AUTH_SECRET`, canonical `AUTH_URL` and restricted PostgreSQL runtime connection are stored as sensitive Vercel production variables. The schema migration is applied. Provider acceptance is recorded separately below; configuration alone does not prove a completed OAuth journey.

## Provider registration

Create separate local and production OAuth apps where the provider supports only one callback. Register the public homepage, privacy and terms URLs in the provider consent configuration.

| Provider | Local callback                                   | Production callback                                           |
| -------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Google   | `http://localhost:3000/api/auth/callback/google` | `https://veyra-forensics.vercel.app/api/auth/callback/google` |
| GitHub   | `http://localhost:3000/api/auth/callback/github` | `https://veyra-forensics.vercel.app/api/auth/callback/github` |

Google: choose a **Web application** client in Google Cloud, configure OAuth consent, use `http://localhost:3000` and the production HTTPS origin as authorized JavaScript origins if requested, and add the exact redirect URIs above. While the Google consent app is in testing, add the intended test users. Publish the consent app and complete any provider-required verification before opening sign-in to everyone. Scopes are only `openid email profile`; offline access is not requested.

GitHub: create an **OAuth App** under Developer settings with the exact callback. The implementation requests no additional scopes, uses the authenticated public `/user` profile and does not request repositories or private email. PKCE S256 is enabled. Existing broader permissions granted to an OAuth App remain governed by GitHub; use a dedicated app for this product.

Always use the canonical domain for login. Authentication requests to another Host are rejected. Do not use arbitrary Vercel preview domains as production callbacks. For preview OAuth testing, register a dedicated fixed HTTPS preview domain and separate credentials.

## Database setup and release

1. Provision a PostgreSQL database with a connection pool suitable for serverless workloads. Set `DATABASE_URL` using the host's verified TLS URL. Do not disable certificate validation. Restrict network/database access to the service according to the host's controls.
2. Run `npm run db:migrate` with the database owner's migration connection in the environment. This applies the idempotent `migrations/001_auth.sql`. It creates users, linked accounts, sessions, investigations and shared abuse-limit counters. It also clears expired sessions and rate counters. No DDL runs in web requests or builds.
3. Use a separate least-privilege runtime role for `DATABASE_URL`: `CONNECT` on this database, `USAGE` on its application schema, `SELECT, INSERT, UPDATE, DELETE` on these five tables, and `USAGE, SELECT` on the accounts/sessions sequences. No `CREATE`, `ALTER`, role-management, or access to other databases is needed. The migration revokes PUBLIC access to application tables. Keep migration credentials outside the deployed application.
4. Set all production environment variables in Vercel and redeploy. `vercel env ls` lists names without exposing values. Confirm `/api/account` reports `configured: true` and the intended provider availability. Configure backup retention and operational contact information appropriate to the deployment.
5. Run the real-provider verification checklist below using accounts you control. Mock tests do not prove provider credentials or provider app configuration.

The runtime pool permits three connections per function instance. Use a managed pooler and size aggregate connection capacity for the expected instance count. Schema changes are additive; rolling back the application leaves saved records intact. Schedule the maintenance migration or equivalent cleanup at least daily to remove expired sessions and abuse counters. Back up before applying future destructive migrations.

Remote runtime connection URLs are normalized to `sslmode=verify-full`; certificate failures are never bypassed. Local loopback development connections may use plain PostgreSQL. Connection, query and statement timeouts bound failures, and idle pool errors log only a category.

## Security and data behavior

- Seven-day opaque database sessions; the library renews sessions and cookies after a day of activity. Cookies are HttpOnly, SameSite=Lax, path `/`, with Secure and the `__Secure-` prefix on HTTPS. Tokens are SHA-256 hashed before database storage; logout deletes the current session. Provider access, refresh and ID tokens are never retained; a database constraint reinforces this.
- Auth.js provides OAuth state, PKCE and CSRF checks. Authentication POSTs additionally require the configured exact Origin. Host and forwarded headers are pinned to `AUTH_URL`; only product destinations (`/analyze`, `/investigate/import`, `/history`, valid investigation paths) are allowed after login. External and malformed redirects fall back to `/history`.
- Users are identified by provider + provider account ID. Google email is retained only when `email_verified === true`; GitHub email is not collected. Missing/unverified email is nullable. Automatic email-based account linking is disabled. Use the original provider to return to the same workspace. There is no account-linking UI in this release.
- The browser never exchanges authorization codes or receives provider tokens. Server diagnostics include error categories only, never token/profile/cause objects. Profile images are restricted to Google/GitHub avatar hosts and sent with no referrer; the CSP permits those hosts only for images.
- `/api/investigations` requires a valid, unexpired database session for every request. Ownership comes from that session, never a request field. Every individual SELECT and DELETE includes both investigation ID and owner ID. Another user's or nonexistent ID returns the same 404. Title updates also enforce ownership; arbitrary report updates are not supported.
- Saving requires an explicit action and confirmation. The server validates bounded source text and model evidence, and rebuilds canonical graph relationships and actions. A saved report is user-submitted evidence, not proof of independently verified identity or provider execution. Existing local/OpenAI behavior remains unchanged.
- A guest can explicitly keep a report in tab-scoped session storage for OAuth recovery (30-minute logical expiry). It is never auto-saved to the database. Reopening discards expired recovery copies; clear, successful save and logout remove them. No conversation is placed in cookies, URLs or local storage. Local storage contains only a sign-out event timestamp for cross-tab session refresh.
- Rate limits are shared PostgreSQL counters: 20 sensitive auth requests per minute/IP, 120 auth/session reads per minute/IP, 20 history mutations and 120 history reads per minute/user. Keys are HMAC-pseudonymized. Requests fail closed when the database fails. Existing OpenAI rate controls remain unchanged.
- History displays up to 100 investigations per account. Delete removes the live record immediately; hosting backups follow the database operator's configured retention. Logout revokes this browser's current session; other device sessions expire normally.

## Verification

Run:

```sh
npm run build
npm run lint
npm test
npm run test:e2e
node scripts/check-serverless.mjs
```

`tests/auth.test.ts` runs the migration and official adapter against an embedded PostgreSQL engine (PGlite). Google OIDC discovery/token responses and signed ID tokens, and GitHub provider responses, are mocked. Auth.js itself handles the real code/state/PKCE/CSRF/session machinery. Tests cover new and existing users, secure cookie policy, token hashing/discard, expiry, logout, ownership, deletion, bad state, provider cancellation/failure, open redirects, CSRF, Host checks and rate limits. There is no deployed test-login endpoint or environment switch that enables fake authentication.

`tests/browser/auth.spec.ts` serves the real built UI with the real Express/Auth.js/session/database routes and test-only mocked providers. It covers browser cookies, refresh, signup/login, save/revisit/delete, session expiry, cancellation/retry, guest report recovery, keyboard access, mobile widths and axe checks. The test harness is only imported by tests. Screenshots go to `artifacts/auth`.

Real-provider acceptance, only after configuration:

1. In a fresh browser, sign up with Google, confirm the provider consent scope and return to the intended destination. Refresh, save an analysis, revisit it, delete it and log out. Sign in again and confirm the same workspace.
2. Repeat with GitHub, including an account with no public email. Confirm no repository/private-email permission request.
3. Cancel each provider's authorization; confirm a useful retry screen. Test an expired session, provider outage/misconfiguration and rejected redirect. The public demonstration must remain available.
4. Use two separate users/browser profiles. Confirm one cannot list, fetch or delete the other's investigation, including direct API requests with a known ID.
5. Inspect HTTPS session cookies, production database permissions and logs without copying secrets into reports.

The initial implementation had no production provider or database credentials. That historical limitation was resolved during the 17 October setup. The mock suite remains separate evidence from live provider acceptance.

Live acceptance on 17 October 2026 passed for Google and GitHub first-time authorization, returning-user login, profile images, refresh persistence and logout. A synthetic GitHub report was saved, renamed, reopened, refreshed and deleted after explicit cleanup approval. The Google account had a separate empty history and received the same not-found response when opening the GitHub report directly. Read-only aggregate SQL inspection confirmed one account per provider, two users, hashed session tokens, no retained provider tokens and zero remaining investigations. No private profile or credential values were written to the acceptance record. See [the experience update](EXPERIENCE_UPDATE.md) for the final regression fixes and the distinction between live and mocked failure tests.

Implementation verification on 16 October 2026: 21 unit/HTTP tests and 29 browser journeys passed, including six authentication journeys. The six auth tests were rerun after the final save-confirmation and artwork optimization changes and passed with isolated databases. TypeScript/build, ESLint, formatting, separate-file serverless startup and the production dependency audit passed (zero reported dependency vulnerabilities). The optional 3D chunk retains its existing size advisory.

Local built-page mobile lab results (390×844, 150 ms latency, 1.6 Mbps download, 4× CPU slowdown, cache disabled, reduced motion): login LCP 2,364 ms; signup LCP 2,088 ms; CLS 0 on both. No WebGL chunk loaded on these reduced-motion mobile paths. These are individual lab runs, not field percentiles or a guarantee for every device. The auth fallback is a 29,724-byte WebP encoded from the original Three.js sculpture.

References: [Auth.js Express](https://authjs.dev/reference/express), [PostgreSQL adapter](https://authjs.dev/getting-started/adapters/pg), [GitHub OAuth flow and PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).
