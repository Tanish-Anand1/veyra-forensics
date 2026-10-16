# Final build directive: implementation record

16 October 2026. Working outcome: a visitor can understand the product, investigate arbitrary conversation text, trace exact evidence, replay earlier states and compare transparent assumptions.

## Confirmed causes and decisions

The existing tabs already had separate render branches. The shared inspector above them could fill the report column, making tab changes appear ineffective. The report now leads with persistent tabs; inspection appears after selection and clears when changing views. New analysis starts on Summary. Failures explicitly state that no report was generated and preserve the input.

The sample picker disabled its own-input option. That option now clears the composer and focuses the textarea. A separate Start with your own text control makes the path visible. Text uploads and direct editing use the same analysis flow.

Filtering a full-context model response by cited message IDs is insufficient for causal replay: an interpretation can depend on future context while quoting an earlier message. Earlier states now use cached, independently computed local prefix analyses. Their provenance is visible. Full-conversation AI interpretation returns at the final step. Replay makes no extra paid requests. A regression test specifically covers an early quotation interpreted using a later demand.

The extraction now includes a conversation-specific AI summary with source quotations. Summary and finding quotations must match actual input. Invalid summaries are omitted; unsupported findings are rejected. Message annotations, graph nodes/edges, progression and protective actions are derived from the canonical evidence record. No model output claims external verification. Malformed successful HTTP responses fail closed in the client.

## Design and interaction

Direction: the intervention chamber, with original machined metal, editorial Archivo/Bodoni typography and a calm evidence workstation. Anti-references remain neon security dashboards and generic SaaS card grids. The original real-time 3D opening is retained as the allowed alternative to a commissioned film asset. It assembles, detects an anomaly, fractures and passes through to the hero, with skip, session behavior, idle rendering, adaptive pixel ratio and static mobile/reduced-motion/WebGL-failure paths.

The exact hero explanation and BEGIN INVESTIGATION action now match the final brief. WATCH A LIVE DEMO starts the actual chronological demonstration, which pauses at computed escalation.

Long desktop records use six-message graph chapters, with a whole-conversation overview. Mobile uses one message and its connected evidence in a two-column composition instead of cropping the wide map. Cross-message evidence retains all supporting messages. Selecting report evidence selects its graph node; source references focus the exact original message. Mobile graph selection reveals and focuses the inspector. Original export data is preserved.

Counterfactuals now include unsubstantiated urgency and independently confirmed destinations. Assumptions affect derived findings, graph emphasis, assessment and relevant protective steps. They never create verified facts.

## Visual iterations

First review, five worst defects: report changes buried below an inspector; own text presented as a disabled option; full-record AI context leaking into replay; long graphs reduced to unreadable scale; decorative floor lines. All were corrected through behavior and composition changes.

Second rendered review, five remaining priorities: mobile map clipping; weak source-reference targets; long action/sender labels colliding with nearby columns; animation duration growing with graph size; generic protective steps despite different evidence. Corrections: a dedicated mobile graph layout, 44-pixel source targets, tighter two-line labels with full inspector text, bounded graph-construction staggering, and evidence-specific recommendations.

The six reference sites were previously studied in a real browser; observations are recorded in `CREATIVE_REBUILD.md`. The new [Oddysey reference](https://oddysey.build/) failed DNS resolution in the actual browser and was not used as visual evidence.

## Model and privacy

Only the user-supplied project key remains configured on Vercel. No client key, alternate provider or silent model fallback is added. `gpt-5.6-luna` is retained with low reasoning, a 3,000-token output cap, a 35-second provider timeout and no retries. [Official model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna) currently lists Responses and structured outputs, at $0.20 input and $1.20 output per million standard-context tokens. Account support is checked separately through real synthetic requests. Pricing is an observation on this date, not a spending guarantee.

Consent, local processing, redaction, same-origin requests, exact quotations, bounded input, production secrets and the edge rate limit remain enforced. Conversations are not persisted by this application. No arbitrary URLs are fetched. The new Contact page supports a build-time public `VITE_CONTACT_EMAIL`; until an address is supplied, it honestly directs feedback to the person sharing the demo. No contact details or receiving service were invented.

## Reproduce

```powershell
npm ci
npm run lint
npm run format:check
npm test
npm run build
node scripts/check-serverless.mjs
npm start
# Against the running production host:
$env:TEST_BASE_URL='http://localhost:3000'
npm run test:e2e
# Explicit real provider checks, synthetic data and API charges:
npm run test:live
```

Visual review: `node scripts/judge-review.mjs` with `REVIEW_URL` and `REVIEW_DIR`. It captures 1920×1080, 1440×900, 1366×768 and 390×844 compositions, distinct tabs and a 60-message record. Screenshots and machine-readable observations are under ignored `artifacts/final-directive/`. Earlier development checks passed 18 unit/HTTP tests and 23 browser journeys. Public release results are recorded after deployment below.

## Limits

This remains an experimental instrument, without a validated accuracy benchmark, verified identity/reputation data, field performance measurements or a human screen-reader study. The optional 3D chunk retains its size advisory. A public contact address is awaiting the operator. Earlier replay intentionally uses local checks, which can miss contextual indicators that the full model finds. These limits remain visible instead of being disguised as verified capability.

## Public release results

Published at **https://chainbreak-zero.vercel.app**, deployment `dpl_HMtbgSSQa61g1dLC2tMjukR63R4a`. Build, TypeScript, lint and formatting pass. All 18 unit/HTTP tests and 23 browser journeys pass. The browser suite ran on the public URL, including contact-page automated accessibility checks. The four-size production screenshot review recorded no overflow, duplicate report content, page exceptions, console errors or unexpected failed requests.

All six real synthetic AI cases returned HTTP 200 with valid findings and summary citations. Ordinary and ambiguous exchanges remained insufficient. Scholarship, credential, financial and unfamiliar paraphrased requests returned elevated concern. The unfamiliar wording produced four model-only findings. A seventh provider request completed through the actual UI, displaying the generated summary, exact linked source, protective action, distinct tabs and causal replay. This used only the supplied key and configured `gpt-5.6-luna`.

| Judge checks                                             | Reproducible coverage                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A–E legitimate, escalating, financial, ambiguous, unseen | `judge.spec.ts`, six paid cases in `live-smoke.ts`                                      |
| F–G empty input and invalid upload                       | `judge.spec.ts`, input preserved and no generated report                                |
| H–I provider failure and delayed response                | `product.spec.ts`, `evidence-flow.spec.ts`, explicit error and stable skeleton geometry |
| J–L distinct tabs, node selection and source navigation  | All three browser files; actual paid journey in `scripts/live-ui.mjs`                   |
| M–N replay and counterfactuals                           | Independent-prefix unit regression plus browser state assertions                        |
| O opening skip and rendering failure                     | Real-time WebGL cinematic completion, replay, skip and forced renderer failure          |
| P desktop and mobile                                     | 1920, 1440, 1366, 768, 390 and 320 widths; four-size rendered review                    |

The final public constrained-mobile lab profile used 390×844, 150 ms latency, 1.6 Mbps download, cache disabled and 4× CPU slowdown:

| Route      |     LCP |     CLS | Resource transfer | WebGL loaded |
| ---------- | ------: | ------: | ----------------: | ------------ |
| `/`        | 2.428 s |       0 |     245,424 bytes | No           |
| `/analyze` | 2.116 s | 0.00064 |     245,424 bytes | No           |

These are single lab observations, not field percentiles. An initial profile failed to capture the homepage paint; the script now waits for a positive paint observation and reports unavailable data as null, never as a zero-second result. Machine-readable results are in `artifacts/final-directive/production-profile.jsonl`. Actual AI screenshots and the end-to-end receipt are in `artifacts/final-directive/live-ui/`; the final visual set is in `artifacts/final-directive/production/`.

To release again: configure server secrets and optional public `VITE_CONTACT_EMAIL` on Vercel, run the checks, then `vercel deploy --prod --yes --archive=tgz --logs`. Full release/rollback instructions are in [DEPLOYMENT.md](DEPLOYMENT.md). The local production server was also restarted with the supplied key. No old credential is used by this project's running app.
