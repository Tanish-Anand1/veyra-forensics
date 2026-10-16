# VEYRA

**SEE THROUGH DECEPTION.**

Investigate suspicious conversations. Trace manipulation. Inspect the evidence.

[Live application](https://veyra-forensics.vercel.app) · [Authentication setup](docs/AUTHENTICATION.md) · [Import pipeline](docs/CONVERSATION_IMPORT.md)

VEYRA reconstructs conversations from WhatsApp exports, screenshots and pasted text. Its TrustGraph connects findings to the exact messages that support them. Local checks work without an API key; optional OpenAI analysis requires explicit consent. Google and GitHub sign-in protect private investigation history.

## Quick start

Use Node.js 24 LTS and npm. Vite requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The public demonstration and local analysis work without credentials. To configure optional services, copy `.env.example` to `.env` and fill in the required values locally. Restart the server after configuration changes.

```sh
npm run build
npm start
```

The production command serves the frontend and API from the same Express host. Vercel uses the separate adapter in `api/index.ts`.

## Investigation workflow

1. **Upload:** choose a WhatsApp `.txt` export, ZIP archive, screenshots or pasted transcript.
2. **Reconstruct:** inspect and edit extracted messages, senders and timestamps. Screenshot transcription requires a configured vision model.
3. **Investigate:** use local rules or review the exact message selection before consenting to model processing.
4. **Visualize:** select a TrustGraph node or connection to inspect its originating message, reasoning and protective action.
5. **Understand:** compare Summary, Evidence and Timeline; replay the conversation and explore hypothetical assumptions.
6. **Keep or export:** download PDF/JSON locally, or sign in and explicitly save to private history. Saved investigations can be reopened, renamed and deleted.

The cinematic opening is public and immediately skippable. Capable mobile devices render the original sculpture with portrait framing; reduced-motion, data-saving and unavailable-graphics paths use a matching poster. The login interface stays mounted beneath the animation.

Internal views retain the root address, as required by the product brief. Back, Forward and refresh restore the current view. Direct entry paths such as `/login`, `/signup`, `/analyze` and `/investigate/import` remain supported and normalize to `/`. OAuth uses the required external authorization and server callback URLs.

## Configuration

All values below are server-side except the optional public contact address. Keep credentials out of `VITE_` variables, source control, logs and browser code.

| Variable                               | Purpose                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `OPENAI_API_KEY`                       | Enables optional server-side OpenAI processing                          |
| `OPENAI_MODEL`                         | Compact analyzer model; default `gpt-5.6-luna`                          |
| `OPENAI_FORENSICS_MODEL`               | Imported-conversation model; default `gpt-6-luna`                       |
| `OPENAI_VISION_MODEL`                  | Screenshot transcription; defaults to the forensics model               |
| `AUTH_URL`                             | Exact application origin, including scheme and port                     |
| `AUTH_SECRET`                          | Cryptographically random session secret, at least 32 characters         |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth web application credentials                                |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | GitHub OAuth App credentials                                            |
| `DATABASE_URL`                         | PostgreSQL connection URL; verified TLS for remote databases            |
| `PORT`                                 | Local server port; default `3000`                                       |
| `TRUST_PROXY`                          | `0` for direct local serving; `1` only behind one trusted reverse proxy |
| `VITE_CONTACT_EMAIL`                   | Optional public operator contact, included at build time                |

Authentication and saved history require PostgreSQL and valid provider credentials. Use a migration-capable connection to apply the schema, then a restricted runtime connection for the app:

```sh
npm run db:migrate
```

Register exact callback URLs:

| Provider | Local                                            | Production                                                    |
| -------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Google   | `http://localhost:3000/api/auth/callback/google` | `https://veyra-forensics.vercel.app/api/auth/callback/google` |
| GitHub   | `http://localhost:3000/api/auth/callback/github` | `https://veyra-forensics.vercel.app/api/auth/callback/github` |

A separate installation needs its own credentials and callbacks. Missing configuration fails closed; provider login is never simulated in the application. See [authentication and database setup](docs/AUTHENTICATION.md) for session policy, database permissions and error handling.

## Architecture

| Directory                       | Responsibility                                                             |
| ------------------------------- | -------------------------------------------------------------------------- |
| `src/`                          | React interface, application navigation, import review and report views    |
| `src/components/TrustGraph.tsx` | Evidence graph, source selection, keyboard controls and pan/zoom           |
| `src/components/MetalScene.tsx` | Original Three.js sculpture and coordinated opening sequence               |
| `shared/`                       | Schemas, local analysis, import parsing, selection and evidence validation |
| `server/`                       | Express API, Auth.js, OpenAI integration and owner-authorized persistence  |
| `api/`                          | Vercel serverless entry point                                              |
| `migrations/`                   | PostgreSQL schema for users, accounts, sessions and investigations         |
| `tests/`                        | Engine, HTTP, authentication, import and browser regression coverage       |
| `scripts/`                      | Migration, release verification, profiling and source packaging            |
| `docs/`                         | Setup guides, implementation boundaries and dated verification records     |

The graph, report and timeline derive from one canonical analysis object. Selecting evidence does not make another model request. Replay uses prefix analyses; hypothetical scenarios leave the original evidence unchanged. Auth.js handles the server-side authorization-code flow. Every saved-investigation operation checks ownership on the server.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm run source:check
node scripts/check-serverless.mjs
```

`source:check` scans the Git index, rejecting private/generated files and common credential patterns. Run it after staging changes. `npm run source:package` creates a checked source ZIP in the ignored `artifacts/delivery` directory.

Browser tests require a running application:

```sh
npx playwright install chromium
npm start
```

In another terminal:

```sh
npm run test:e2e
```

Set `TEST_BASE_URL` to test another host or port. Provider automation uses test-only mocks with real Auth.js and database routes; it does not require production credentials. Live OAuth verification is recorded separately in [the acceptance record](docs/LIVE_AUTH_ACCEPTANCE.md). `npm run test:live` makes real, billable OpenAI requests with fictional conversations. It is optional and excluded from routine checks.

## Privacy and limitations

Unsaved conversations remain in page memory. Explicit saving uploads the reviewed conversation and report to PostgreSQL under the signed-in account. An optional, time-limited tab recovery copy can preserve a guest report during sign-in. Google and GitHub identities remain separate; accounts are not automatically linked by email.

OpenAI processing requires consent, sends only the disclosed selection and uses `store: false`. This does not guarantee zero provider retention. No analytics, advertising trackers, remote fonts or raw-conversation logging are included. Local redaction is incomplete and must be reviewed.

Findings are investigative indicators, not proof of fraud or calibrated probabilities. Local rules target explicit English phrases and can misread negation, quotations or speaker perspective. Model interpretations can also be wrong. Exact quotation checks establish provenance, not correctness. Destination checks inspect URL structure without fetching websites, checking ownership or consulting reputation databases.

Text/ZIP reconstruction, screenshot processing and analysis have bounded limits documented in [the import guide](docs/CONVERSATION_IMPORT.md). API limits reduce abuse but do not provide a global spending cap. PDF rasterization for complex scripts preserves appearance and attached Unicode evidence, but is not fully accessible searchable text.

## Design and documentation

Archivo Black defines the wordmark; Barlow Condensed carries cinematic headings; IBM Plex Sans handles interface text; IBM Plex Mono identifies technical evidence. Fonts are self-hosted. The sculpture and fallback imagery are original renders. Dependency/font notices are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

- [Deployment and rollback](docs/DEPLOYMENT.md)
- [Mobile cinematic behavior and verification](docs/MOBILE_CINEMATIC.md)
- [Conversation import limits and data flow](docs/CONVERSATION_IMPORT.md)
- [Authentication and private history](docs/AUTHENTICATION.md)
- [Research and evidence boundaries](docs/RESEARCH.md)

Dated release records describe checks performed at that point; they are not guarantees of current field performance or detection accuracy. Physical-phone and human screen-reader acceptance remain separate from browser emulation and automated accessibility checks.

The optional 18-page website guide can be generated after `npm ci` with Python 3 and `reportlab`, `fonttools`, `brotli` and `pypdf` installed:

```sh
python scripts/create-product-guide.py
```

It writes `output/pdf/VEYRA-Complete-Website-Guide.pdf`. Generated documents, screenshots, build output, dependencies and local credentials are excluded from source control.
