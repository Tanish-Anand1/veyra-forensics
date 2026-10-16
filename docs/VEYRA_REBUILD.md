# VEYRA experience rebuild

17 October 2026. Public brand: VEYRA. Existing deployment hostname and internal record/storage identifiers remain compatible with saved reports.

## Experience and implementation

The first visit to `/` presents an original seven-second titanium sculpture sequence, then replaces the URL with `/login?next=%2Finvestigate%2Fimport`. A verified session reaches the investigation workspace. The sign-in page and sculpture remain mounted during the transition. Skip is available immediately, reduced motion bypasses the film, and session storage suppresses normal-navigation replays. Direct login/signup never waits for the film. Mobile and WebGL failures use a render of the same original geometry. A bounded readiness timeout also permits recovery if rendering never initializes.

The user authorized original geometry because the referenced video was unavailable. No reference artwork was copied and no claim of matching an unseen video is made.

`/about` explains the product publicly and includes an interactive, explicitly fictional conversation computed with the same local engine. `/investigate/import` accepts WhatsApp TXT/ZIP exports, screenshots and pasted conversations. It retains editable reconstruction, source provenance, explicit model consent, bounded processing, graph inspection, replay, separate report views, save/delete and PDF/JSON export.

Source selection focuses the relevant graph connection. Selecting a finding or edge reveals exact messages, explanation and protective action. The counterfactual explorer derives a clearly hypothetical view; original evidence and exported reports remain unchanged. Replay uses only available prefix evidence, with full-context model interpretations withheld until completion.

## Font and material system

| Role                  | Family           | Shipped weights |
| --------------------- | ---------------- | --------------- |
| Wordmark              | Archivo Black    | 400             |
| Cinematic headings    | Barlow Condensed | 600, 700, 800   |
| Interface and reports | IBM Plex Sans    | 400, 500, 600   |
| Technical identifiers | IBM Plex Mono    | 400, 500        |

The app uses React/Vite, so the Google Fonts families are self-hosted with Fontsource rather than `next/font`. Latin subsets use swap and system fallbacks. No additional display families are installed. Pair-specific spacing shapes the wordmark at its native weight. PDF exports embed the brand and UI fonts; complex-script excerpts retain browser shaping and exact UTF-8 attachments.

The 3D scene uses original extruded bevelled ribs, layered backing plates, a connected structural lattice, a controlled red fracture and a procedural studio environment. Pointer movement makes a small camera adjustment on fine-pointer devices. The canvas renders on demand after the finite sequence; mobile/reduced-motion routes avoid its chunk entirely.

Physical-material shaders are prepared with Three.js `compileAsync` before the first scene draw. Preparation and film playback have separate clocks, so a cold download cannot truncate the brand reveal. Skip remains available during preparation. A local Arial metric fallback reserves the condensed headline rail while Barlow loads; it adds no downloaded font family.

## Authentication configuration boundary

Google/GitHub authorization-code flows, Auth.js protections and server-side database sessions already exist and are preserved. Automated tests use mocked providers with the real Auth.js/session/PostgreSQL code. There is no fake production login endpoint.

Production still requires `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` and `DATABASE_URL`. Configure exact HTTPS callbacks and apply the migration as described in [AUTHENTICATION.md](AUTHENTICATION.md). Provider buttons remain disabled with an explanation when configuration is missing. Mocked tests do not establish that live provider credentials work.

## Reproduce verification

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` against the built server. `scripts/render-veyra.mjs` captures the four requested desktop/mobile compositions, intro stages and original fallback assets. `scripts/verify-forensics-live.ts` and `scripts/verify-forensics-ui.ts` make paid, bounded calls using newly generated nonpersonal conversations, only when explicitly run with the intended server key.

Final executed results, screenshots and deployment evidence are recorded below after verification. These checks are engineering acceptance tests, not a representative user study or an accuracy benchmark.

## Executed acceptance results

- ESLint, TypeScript/production build and Prettier passed. The separate-file serverless ESM startup check returned HTTP 200. Production dependency audit reported zero vulnerabilities.
- All 28 unit/API tests passed, including real Auth.js machinery with mocked Google/GitHub responses, PostgreSQL ownership, expiry, unsafe redirects, consent and import boundaries.
- The final full browser run passed all 36 checks in 1.7 minutes. Earlier fixture/graphics timing failures and mobile transient overflow were fixed and rerun. The final suite includes both providers through real Auth.js with mocked provider responses, import/review, source selection, stable report tabs, replay, PDF, ownership/history, keyboard, mobile and axe checks.
- Actual desktop 3D and pointer response were exercised using Intel UHD graphics through ANGLE Direct3D11. Software WebGL had produced a twenty-second main-thread stall; it now receives the static sculpture rather than compiling the PBR scene. Reduced motion, skip and WebGL initialization failure were also exercised.
- Rendered views were inspected at 1920×1080, 1440×900, 1366×768 and 390px, with additional 320px reflow checks. Screenshots and computed font-family/weight evidence are in `artifacts/veyra`. The PDF was rendered and inspected; source headings are kept with their content and exact UTF-8 evidence remains attached.
- Real text analysis and screenshot transcription calls on the built local server used `gpt-6-luna`. Five grounded findings and two reconstructed messages were returned, including an exact newly generated reference. Browser/model fixtures and live checks use generated nonpersonal material, not a user-study dataset.

Mobile lab results after the final artwork/font changes, 390×844, 150ms latency, 1.6Mbps download, 4× CPU slowdown and disabled cache:

| Route                 | LCP     | CLS     | WebGL loaded |
| --------------------- | ------- | ------- | ------------ |
| `/login`              | 2,660ms | 0       | No           |
| `/signup`             | 2,164ms | 0       | No           |
| `/investigate/import` | 2,080ms | 0.00198 | No           |

Login remains 160ms above the 2.5-second lab target. An earlier run under concurrent browser/test load measured 5,700ms. These are individual lab samples, not field percentiles; INP and real-user Core Web Vitals were not measured. The 3D and PDF/font-embedding chunks retain build-size advisories but load only when used. Consolidating the fallback image removed an unnecessary second 34KB image request on authentication routes.

Live OAuth and hosted private storage remain unverified until the required provider/database configuration exists. No model accuracy, fraud-detection rate or independently verified identity is claimed.

The first production acceptance check exposed the initialization timeout cutting the film short on a cold load. The shader preparation/clock change addresses that failure. A second visual pass moved counterfactual controls into the toolbar, placed stable report tabs above their content, and reset the inspector when evidence changes. The graph now begins within the first 460px in the desktop acceptance case; the original source is immediately available in the Evidence view. Status text can shrink and wrap during reconstruction on mobile. All six import browser journeys passed after these refinements.

Final production: `dpl_HTYgTnCUUov5h6j3nE2vZStaJCrG`, https://chainbreak-zero.vercel.app. The cold production opening passed after the preparation fix. Live OpenAI analysis, exact quotations, selected graph/source relationships, timeline, desktop/mobile rendering and safe missing-authentication configuration passed with no page errors. In the live desktop investigation, the graph began at 383px and inspector tabs aligned with the top of the report pane. Production screenshots and machine-readable results are in `artifacts/auth`, `artifacts/deployment` and `artifacts/forensics/release`.
