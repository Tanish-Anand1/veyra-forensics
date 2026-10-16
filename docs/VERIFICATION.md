# Delivery verification

16 October 2026. Verified locally on Windows, Node 25.9.0, with the built Express application at `http://localhost:3000`, then deployed and verified at **https://chainbreak-zero.vercel.app**. The public API runs on Vercel Node 24. See [deployment evidence and release instructions](DEPLOYMENT.md).

## Working brief

Outcome: help a person inspect how requests, pressure and claims develop in a digital conversation, with traceable evidence rather than a fraud probability.

Scope: original editorial website, deterministic cinematic, local and optional OpenAI analysis, evidence graph, progression timeline, hypothetical scenarios, realistic fictional cases, exports, accurate demo policies and Vercel deployment. Identity verification, live threat intelligence, accounts, cryptographic privacy and a validated detector benchmark are excluded.

Acceptance: unfamiliar text can be analyzed; accepted findings cite actual messages; graph and report agree; local mode sends no text; model mode requires consent; failures preserve input; primary controls and direct routes work at the requested widths; production assets load under the actual security policy.

## Final directive release

Authentication has since been added. The original exclusions and results below describe the earlier release. See [AUTHENTICATION.md](AUTHENTICATION.md) for the current account/database architecture, credential requirements and verification scope. Live OAuth is not verified without valid provider credentials.

The latest release passes 18 unit/HTTP tests, 23 public Playwright journeys, six real synthetic AI cases and an additional full provider browser journey. Source-valid AI summaries, independent prefix replay, distinct desktop/mobile reports, source-message navigation, graph chapters and counterfactuals were verified. All six routes and 20 assets load. Current evidence and limitations are in [FINAL_BUILD.md](FINAL_BUILD.md); older observations below are retained as the earlier rebuild record.

## Earlier rebuild checks

- TypeScript and production build pass.
- ESLint and Prettier checks pass.
- 15 engine, replay, selection and real HTTP-boundary tests pass. Coverage includes legitimate and suspicious inputs, progression, malformed/excess input, Unicode input at the character limit, rate limits, consent, URL parsing, redaction, rejected evidence references and nonmutating scenarios. New checks verify source resolution, protective actions, contradictions citing both messages, and withholding future evidence during replay.
- Thirteen Playwright journeys pass against the public production deployment. Coverage includes the complete local journey, selecting evidence, zoom/focus/reset, hypothetical changes, `.txt` upload, JSON download, message-level analysis, redaction, provider-error recovery, loading skeletons, cancellation without restoring cleared content, keyboard report tabs, cinematic completion/replay/skip and deliberate WebGL failure. New checks cover hosting-level HTML rate-limit recovery, exact source highlighting from a connection, evidence-specific actions, automatic pause at computed escalation, replay withholding future findings, mobile controls, and unchanged desktop panel dimensions during provider loading and completion.
- Responsive checks cover 1920×1080, 1440×900, 1366×768, tablet, 390-pixel mobile and 320-pixel reflow widths.
- Axe checks found no violations in the tested WCAG A/AA rule sets on the homepage, workstation, report results, methodology, privacy and terms pages. These are automated checks, not an assertion of complete conformance or real screen-reader testing.
- Four real OpenAI Responses API calls passed with `gpt-5.6-luna`: fictional cases A, B and C, plus unfamiliar courier text. All accepted evidence references were valid. Case A returned insufficient evidence; B, C and the unfamiliar case returned elevated concern. These are functional smoke tests, not a detection-accuracy study.
- Production `npm audit --omit=dev` reported zero known vulnerabilities at delivery time. This is not proof that the application or its dependencies are vulnerability-free.
- Actual production pages and screenshots were inspected. Development-only inline refresh scripts are absent from the production security policy. Conversation responses use `Cache-Control: no-store`; public hashed assets use immutable caching and compression.

Commands and browser evidence are reproducible through the scripts in the README. `npm run test:live` makes real paid provider requests with only synthetic input. Screenshots are in ignored `test-results/`.

## Constrained mobile lab profile

A rebuild baseline and optimized run used Chromium, a 390×844 viewport, reduced motion, disabled cache, 150 ms latency, 1.6 Mbps download and 4× CPU slowdown. A browser import of input limits was pulling in server validation code. Moving those limits into a dependency-free shared module removed about 80 KB of minified JavaScript (23 KB compressed), preserving server validation. Public static responses are compressed; API responses remain outside that middleware.

| Route      | LCP before | LCP after | Transfer before | Transfer after | CLS after |
| ---------- | ---------: | --------: | --------------: | -------------: | --------: |
| `/`        |    2.792 s |   2.560 s |   262,607 bytes |  239,338 bytes |         0 |
| `/analyze` |    2.324 s |   1.988 s |   262,607 bytes |  239,680 bytes |   0.00064 |

The optional WebGL chunk was not loaded on either profiled route. These numbers are single local lab observations, not field percentiles. The homepage remains 60 ms above the default 2.5-second LCP target in this run. INP, field Core Web Vitals, low-end physical devices, screen-reader usability and a human usability study were not measured. The product statement and actions remain visible during the approximately seven-second desktop opening, which can be skipped or replayed.

The lazy WebGL chunk is approximately 919 KB minified and 244 KB compressed. Vite reports an advisory size warning. It is excluded on mobile/reduced-motion views and the workstation. A 256×128 procedural studio texture supplies reflections without synchronously rendering a separate environment scene. Production cinematic readiness, completion, replay and forced WebGL failure passed browser checks. Three.js emits a nonblocking Clock deprecation warning from its React Three Fiber integration.

## Thirty-point visual constraint review

Visual inspection covered two implementation passes and the final production build. See `CREATIVE_REBUILD.md` and `artifacts/final` for the review and screenshots. The original five-second canvas-readiness assertion remains in the cinematic test.

The review covers the homepage, workstation, privacy, terms and methodology surfaces. The missing-route screen uses the same type and material system.

| #   | Constraint                        | Implementation evidence                                                                                                      |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | No harsh gradients                | Flat graphite surfaces and physical scene lighting; no CSS gradients.                                                        |
| 2   | No generic icon-library identity  | Typography, simple custom identity mark and purposeful graph shapes.                                                         |
| 3   | No unconsidered white backgrounds | Consistent dark material hierarchy on every route.                                                                           |
| 4   | No rainbow coloring               | Restricted supplied palette.                                                                                                 |
| 5   | No blanket shadows                | Hairlines and surface contrast define boundaries.                                                                            |
| 6   | No three-feature-card row         | Editorial conversation/graph composition and a four-state evidence ledger.                                                   |
| 7   | No emoji                          | Product copy has no emoji.                                                                                                   |
| 8   | No glass overload                 | No backdrop blur or translucent floating cards.                                                                              |
| 9   | No authored em dashes             | Rendered page copy checked; model titles and explanations normalize them. User-supplied quotations are preserved faithfully. |
| 10  | No banned default fonts           | Self-hosted Archivo, Bodoni Moda, Manrope and Plex Mono with shipped licenses.                                               |
| 11  | No decorative colored stripes     | Borders are structural; red is used for consequential evidence and errors.                                                   |
| 12  | No fake social proof              | No testimonials, awards, customer claims or partner logos.                                                                   |
| 13  | No bento grids                    | Contiguous research workstation and editorial sections.                                                                      |
| 14  | No fake terminals                 | None.                                                                                                                        |
| 15  | No formulaic contrast copy        | Authored headlines and reports describe the observed task and limitations.                                                   |
| 16  | No checkmark marketing lists      | None. Protective steps are a meaningful numbered sequence.                                                                   |
| 17  | No fabricated pricing             | No pricing surface.                                                                                                          |
| 18  | Working product required          | Primary actions open the real workstation. All four live API smoke cases passed.                                             |
| 19  | Restrained geometry               | Square panels and controls. Hexagonal, document and diamond geometry encodes node semantics.                                 |
| 20  | No purple/black default           | Supplied graphite and pale-metal palette, with signal red.                                                                   |
| 21  | Designed skeletons required       | Stable graph and report skeleton regions tested under delayed provider response.                                             |
| 22  | No glowing orbs                   | Machined physical network and its matching static render.                                                                    |
| 23  | No dot-grid background            | None. The graph's restrained spatial guide lines distinguish source, pattern and request.                                    |
| 24  | No sparkle motifs                 | None.                                                                                                                        |
| 25  | No animated arrows                | Directional glyphs remain static.                                                                                            |
| 26  | Terms required                    | `/terms` describes demo availability, responsibility and limitations.                                                        |
| 27  | Privacy required                  | `/privacy` describes actual local, provider, export, redaction and retention behavior.                                       |
| 28  | No universal hover animation      | Controls mostly change only color; the workstation remains calm.                                                             |
| 29  | No universal neon/glow            | No bloom or neon outlines; red denotes actual indicators and errors.                                                         |
| 30  | No generic pastel branding        | Restrained graphite and metal throughout.                                                                                    |

## Remaining limitations

The public Vercel demo uses HTTPS, server-only secrets and a published edge rate limit of 10 analysis requests per minute per IP. It has no authentication or global spending cap. Operator contact details, hosting-specific policy review and budget monitoring remain operator responsibilities. Local English rules and model interpretations can both be wrong. Exact references establish what was written, not whether it is true. Identity, URL ownership, reputation and intent remain unverified. Automatic redaction is incomplete. Cancellation does not guarantee cancellation of provider-side work. No detection efficacy, security guarantee or cryptographic access-pattern privacy is claimed.
