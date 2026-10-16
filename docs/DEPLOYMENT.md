# Production deployment

17 October 2026. VEYRA public experimental demo: **https://veyra-forensics.vercel.app**.

The VEYRA domain is attached to the existing project for future production releases. The previous `chainbreak-zero.vercel.app` address remains available. No domain purchase or change to the analysis credentials was required.

Vercel project: `chainbreak-zero`, scope `tanishs-projects-66633ee2`.
Current production deployment: `dpl_76BFKGWvjinZcAfkPMEmGmdzxgdi`.
Immutable URL: https://chainbreak-zero-pbu79xvnv-tanishs-projects-66633ee2.vercel.app.

## Mobile cinematic release

Capable phones now use the original real-time sculpture with portrait camera framing, capped pixel ratio, touch response and a short settling motion. Reduced-motion, data-saving and unavailable-graphics paths use a dedicated portrait poster. Replay and immediate skip are available. See [mobile implementation and verification](MOBILE_CINEMATIC.md). The existing authentication and analysis configuration is preserved.

An 18-page product/technical guide is delivered separately at `output/pdf/VEYRA-Complete-Website-Guide.pdf`. Every page was rendered for visual review; text extraction, fonts and bookmarks were checked. Generated PDF output and rendering intermediates are excluded from deployment.

## Current experience and authentication configuration

The current release adds Sources, Cyber ethics, the redesigned footer, readable supporting text and root-address application navigation. Dedicated Google and GitHub credentials, the session secret and a restricted Neon Free database connection are configured in production. The schema is installed; owner database credentials are excluded from the application. See [the experience update](EXPERIENCE_UPDATE.md) for implementation and verification details.

All 28 unit/API tests and 38 local browser tests passed. The deployed origin passed 10 product/navigation browser tests, 13 direct route checks, 29 asset checks and the authentication release check with no page exceptions. Real first-time and returning Google/GitHub sign-ins, profile images, session persistence and logout were verified. GitHub save/rename/reopen/delete and Google's denied access to that record were verified against the hosted database. Aggregate SQL checks confirmed separate users, hashed sessions, discarded provider tokens and no remaining synthetic investigations. No paid model calls were made for this release. Earlier release notes below preserve their original verification scope.

The final follow-up corrects the restored replay position and generic OAuth retry copy. All 14 authentication/product browser tests were rerun and passed after these changes. [Live acceptance details](LIVE_AUTH_ACCEPTANCE.md) distinguish real-provider checks from mocked error coverage.

## Hosting contract

Vite builds the frontend into `dist`. Vercel serves hashed assets and rewrites client routes to `index.html`. `/api/*` reaches the exported Express app in `api/index.ts` on the same origin. Vercel runs the API on Node 24 with a 60-second function limit; the provider timeout is 35 seconds. Local `npm start` continues to use the bundled Express host.

Runtime imports in the serverless dependency tree use explicit `.js` extensions. The first deployment exposed an ESM startup error masked by the local bundle and tsx loader. The published replacement fixes this; `scripts/check-serverless.mjs` verifies separate-file ESM compilation before future releases.

Existing analysis environment names are `OPENAI_API_KEY`, `OPENAI_MODEL` and `TRUST_PROXY`. The key is stored as a sensitive server-only secret. The model is `gpt-5.6-luna`; proxy trust is one hop. Authentication adds the server-only configuration documented in [AUTHENTICATION.md](AUTHENTICATION.md), including database migration and exact provider callbacks. No secret values belong in this document, client bundles or source control. Ignored `.vercel` and `.env*` files contain local deployment state and may contain credentials.

A published Vercel WAF rule named `Analysis endpoint limit` applies a fixed window of 10 combined requests per 60 seconds per IP to `/api/analyze` or `/api/import/screenshots`, before the function. The application's in-memory limiter is an additional control. This unauthenticated demo has no global model-spending cap. The UI preserves input and offers local recovery for hosting-level HTML rate-limit responses.

Production headers prohibit inline scripts, framing, remote scripts, remote fonts and remote browser connections. Provider profile images are allowed only from the two specified Google/GitHub avatar hosts. Styles allow inline renderer values. API responses use `no-store`; hashed assets use immutable caching. Guest local analysis remains in the browser. Optional provider processing requires consent. Explicitly saved investigations persist under their authenticated owner; application code does not log raw conversations. Hosting connection metadata, backups and provider retention are separate from application memory.

Platform references: [Node functions](https://vercel.com/docs/functions/runtimes/node-js), [project configuration](https://vercel.com/docs/project-configuration/vercel-json), [WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) and [forwarded request headers](https://vercel.com/docs/headers/request-headers).

## Release and verification

The project is already linked on this machine. Configure production secrets through Vercel environment management without printing them. Then run:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
node scripts/check-serverless.mjs
vercel deploy --prod --yes --archive=tgz --logs
$env:TEST_BASE_URL='https://veyra-forensics.vercel.app'
node scripts/verify-deployment.mjs
npm run test:e2e
# Real paid provider requests using synthetic conversations only:
npm run test:live
```

Observed on the public alias:

- Six direct routes and 20 assets returned HTTP 200 with security headers. No asset fell through to the SPA. The public asset scan found no configured API key or project-key pattern.
- `/api/status` returned 200 with the configured model. Invalid input and missing consent returned 400. Local API analysis returned 200 with valid quotations and `no-store`.
- All 23 Playwright journeys passed on the public alias: cinematic completion/skip/replay, graph-to-source selection, protective actions, causal prefix replay, upload/export, scenarios, loading geometry, cancellation, recovery, malformed success responses, arbitrary inputs, keyboard controls, distinct mobile/desktop tabs, responsive layouts, automated accessibility checks and WebGL fallback.
- Six real OpenAI calls returned 200 using only the supplied project key and Luna. Ordinary case A and an ambiguous exchange remained insufficient; B, C, a financial request and unfamiliar paraphrased text returned elevated concern. Every accepted finding and summary quotation matched its source. The unfamiliar input produced four model findings, demonstrating contextual extraction beyond the local rules. These prove integration behavior, not detection accuracy.
- A seventh real OpenAI call was exercised through the public browser UI. Its generated summary rendered, selection highlighted message 5 with the exact source/reason/action, all report tabs differed, and replay removed later evidence. `node scripts/live-ui.mjs` reproduces this explicit paid synthetic check.
- A bounded burst of invalid local requests returned ten validation errors followed by HTTP 429. No provider call was made by this check. `scripts/verify-rate-limit.mjs` reproduces it and stops at the first limit response.
- Desktop and mobile screenshots were inspected. The screenshot review recorded no console errors, page exceptions or failed requests.
- All 18 unit/HTTP-boundary tests and the separate-file ESM runtime smoke test passed locally. TypeScript, lint, formatting and the Vercel build passed. The lazy 3D chunk retains its documented advisory size warning.

Evidence lives in ignored `artifacts/deployment/`, `artifacts/final-directive/` and `test-results/`. The scripts reproduce checks using synthetic conversations. Functional public checks do not establish field performance, human usability or screen-reader compatibility. See [final build record](FINAL_BUILD.md) for the complete directive audit and measured public mobile profile.

## Diagnose and roll back

Inspect with `vercel inspect veyra-forensics.vercel.app`. For startup failures use `vercel logs --environment production --no-branch --since 15m --status-code 500 --expand --limit 5`. Do not add raw request-body logging. The CLI's combined `vercel firewall overview` currently returns 402 because IP bypass is unavailable on this plan; that does not invalidate the separately published rule or the observed 429 boundary. Inspect custom rules independently when changing rate limiting.

For a future bad release, use `vercel rollback` and select this or another previously verified healthy deployment, then rerun HTTP and browser checks. Environment and firewall changes have separate state. The first deployment had a broken API and is not a suitable rollback target. Keep a verified deployment available.

Hosting costs, model budget monitoring, operator identity/contact details and jurisdiction-specific policies remain operator responsibilities. This is an experimental demo with fictional supplied cases and no claim of validated detection efficacy.

## Authentication release, 16 October 2026

Deployment `dpl_J3N9t532QbB4xdsuAv1to33PHrEZ` is ready and aliased to the production domain. Its immutable URL is [chainbreak-zero-7el9ixjv0-tanishs-projects-66633ee2.vercel.app](https://chainbreak-zero-7el9ixjv0-tanishs-projects-66633ee2.vercel.app).

Post-release checks passed for nine direct routes, 21 assets, CSP, API validation/consent, public local analysis, login/signup rendering, the protected history redirect, and desktop/mobile layouts with no page exceptions. The existing OpenAI configuration still reports `gpt-5.6-luna`; no extra paid model calls were needed for this authentication release.

`/api/account` reports `configured: false`, with both OAuth providers unavailable. Production currently has no database/OAuth credentials; sign-in and saving intentionally fail closed while the public demonstration works. Apply [the authentication configuration and migration steps](AUTHENTICATION.md) before live provider acceptance. Real Google/GitHub OAuth and hosted PostgreSQL connectivity have **not** been verified.

Constrained production mobile lab results: login LCP 2,444 ms and signup 2,072 ms; CLS 0 on both (390×844, 150 ms latency, 1.6 Mbps, 4× CPU, cache disabled, reduced motion). These are individual lab observations. Reproduce with `TEST_BASE_URL=https://chainbreak-zero.vercel.app PROFILE_ROUTES=/login,/signup node scripts/profile.mjs`, using the shell's environment-variable syntax. The production verification scripts are `scripts/verify-deployment.mjs` and `scripts/verify-auth-release.mjs`.

## VEYRA release, 17 October 2026

The final full browser run passed all 36 tests in 1.7 minutes. All 28 unit/API tests, lint, formatting, TypeScript/build and separate-file serverless startup passed. See [the experience and verification record](VEYRA_REBUILD.md). The optional 3D and PDF chunks retain size advisories.

Post-release acceptance passed on the public canonical origin: 11 routes and 29 discovered assets, security headers, consent/validation failures, local analysis, the actual seven-second cold opening through login and public import navigation, and genuine OpenAI conversation analysis using `gpt-6-luna`. A new generated residency conversation produced valid exact quotations, interactive source/graph selection and timeline linkage on desktop/mobile with no page errors. The graph began at 383px in the desktop live check, with the report tabs fixed at the top of the inspector. Local real vision transcription also passed using `gpt-6-luna`, including preservation of a generated reference.

Production `/api/account` still reports `configured: false`, with Google and GitHub unavailable. The domain release sets `AUTH_URL=https://veyra-forensics.vercel.app` alongside the existing OpenAI/proxy environment values. Real OAuth and hosted private history remain blocked on the provider credentials, `AUTH_SECRET`, PostgreSQL URL and migration described in [AUTHENTICATION.md](AUTHENTICATION.md). No live provider authentication is claimed.

## VEYRA domain release, 17 October 2026

`veyra-forensics.vercel.app` is attached to the existing project and automatically followed the new production deployment. The previous address remains active. Social image metadata and production authentication callback instructions now use the new origin; production `AUTH_URL` is configured accordingly. The shorter `veyra.vercel.app` address was unavailable.

Lint and the TypeScript/production build passed. On the new HTTPS origin, all 11 direct routes, 29 assets, API validation and consent failures, and local analysis passed. All eight product browser tests passed, including the opening, graph/evidence journey, keyboard path, responsive layouts, accessibility and failure recovery. The authentication release check passed for public login/signup, mobile reflow, protected-history redirects and safe missing-credential states with no page errors. The rendered login was also inspected in the in-app browser. No paid model requests were made for the domain change. Live OAuth and private history still require the documented provider/database configuration.

Current domain evidence is recorded in `artifacts/deployment/domain-release.json`, `artifacts/deployment/http-verification.json` and `artifacts/auth/production-verification.json`.
