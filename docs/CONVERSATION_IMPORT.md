# Conversation import and investigation

The public route is `/investigate/import`. The homepage and demonstration remain public. Saving and revisiting reports require an authenticated account, using the existing Auth.js Google/GitHub infrastructure.

## Data flow and consent

1. Text or ZIP is read in a dedicated browser worker. Only text entries are decompressed. Multiple text files require a choice. Included media is ignored.
2. Screenshot files are dimension-checked before decoding, resized to a maximum 1,800-pixel edge, stripped of metadata and prepared as WebP. Users can mask rectangles with pointer or keyboard coordinates and reorder images. The exact prepared previews require separate image-upload consent. Server-side image validation and metadata stripping run again before the vision request.
3. The genuine vision model transcribes visible content into structured messages, apparent speakers, timestamps, regions and uncertainties. Probable suffix/prefix overlaps can be merged with both source references retained or rebuilt without merging. Transcription does not establish identity.
4. Every source passes through editable transcript review. Users can correct sender/text/timestamp, reorder/remove messages, resolve uncertainties and preview/apply local redaction. Edits invalidate prior analysis consent.
5. Deterministic selection creates chronological bounded packets with nearby context and anchor messages. Exact message IDs, sender labels, text and source indices are visible before consent. Only these fields reach text analysis. Original archives, filenames and screenshot pixels are excluded from text packets.
6. Sequential requests use the existing `/api/analyze` endpoint with `kind: import-segment`. A canonical report validates quoted evidence and constructs actual graph nodes/edges/actions. Segment summaries retain citations; multiple summaries are not presented as an invented global narrative.
7. Original files and unselected history are released from page state when the report opens. Explicit saving retains only the reviewed selection, source references, uncertainty notes, title and canonical report. Server-side reads, renames and deletions require record ownership. The PostgreSQL adapter/session implementation remains unchanged.
8. PDF generation runs locally on demand, including source IDs, coverage, quotations, actions and uncertainty notes. Complex scripts are shaped with browser canvas; exact Unicode is attached as `chainbreak-evidence.json`. Rasterized excerpts are not searchable or fully accessible PDF text. A separate evidence JSON export is available.

## Limits

| Boundary             | Limit                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text                 | 10 MB; 3 million decoded characters; 20,000 reconstructed messages                                                                                                                                      |
| ZIP                  | 12 MB compressed; 50 MB declared expansion; 2,000 entries; 10 MB per text entry                                                                                                                         |
| ZIP defense          | Reject traversal, absolute/drive paths, duplicates, symlinks, encryption, unsupported methods, malformed layouts, overlapping entries, inconsistent headers/checksums and suspicious compression ratios |
| Actual decompression | Stream deflate text with an enforced output budget independent of declared metadata; validate length and CRC                                                                                            |
| Screenshots          | Eight originals, each up to 12 MB and 16 MP; static images only; prepared upload approximately 1 MB maximum                                                                                             |
| Vision result        | 60 visible messages per image; bounded text/warnings; unreadable images may return zero messages                                                                                                        |
| Investigation        | 180 selected messages, 72,000 unique text characters, six chronological segments                                                                                                                        |
| Segment              | 36 messages and 14,000 text characters including context; 35-second provider timeout; no SDK retries                                                                                                    |
| Expensive endpoints  | 10 analysis or screenshot requests/minute/IP in the application; edge controls in deployment record                                                                                                     |
| Saved history        | 100 reports/account; serialized writes preserve the cap                                                                                                                                                 |

Selection can miss relevant messages, especially unsupported languages. Omissions are disclosed. Source file order is retained; ambiguous dates are left unnormalized until reviewed. No timezone is invented. The parser supports common Android/iOS numeric conventions, 12/24-hour times, seconds, Unicode digits and several localized month names; it does not promise every regional format. Unrecognized possible headers produce warnings.

## Configuration

Server-only values:

```dotenv
OPENAI_API_KEY=
OPENAI_FORENSICS_MODEL=gpt-6-luna
OPENAI_VISION_MODEL=gpt-6-luna
```

The quick analyzer continues using `OPENAI_MODEL`. No fallback provider or expensive model is silently selected. The supplied key was verified against `gpt-6-luna` for structured text and image transcription. [Official model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna), [image inputs](https://developers.openai.com/api/docs/guides/images-vision) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) informed the implementation. Capability checks do not establish forensic accuracy.

OAuth/database configuration and callbacks are in [AUTHENTICATION.md](AUTHENTICATION.md). Apply `migrations/001_auth.sql`. Imported reports use the existing JSONB record, without an additional migration. Never put credentials in `VITE_` variables or committed files.

## Retention and retry boundaries

No conversation/image logs are added. Original files remain in browser memory during review. A random 15-minute HttpOnly SameSite=Strict cookie scopes import requests. A bounded server-memory map coalesces simultaneous/recent requests with the same identifier and payload for five minutes. Conflicting reuse returns 409. The page caches completed chunks/images while mounted, reuses request IDs and resumes unfinished work. Failures are not cached as successes. Cancellation may not stop a running provider request.

This cache is per instance and resets on cold starts/redeploys. It does **not** guarantee exactly-once billing across instances, page reloads or expired cache windows. A shared durable idempotency store and global spending cap remain deployment hardening work. Rate limiting is not a global budget. `store: false` does not promise zero provider retention. Saved records follow account/database retention; exports and backups are outside live-record deletion.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
node scripts/check-serverless.mjs
npx playwright test tests/browser/forensics.spec.ts
# Two paid calls using generated, nonpersonal content:
$env:TEST_BASE_URL='http://localhost:3005'
npx tsx scripts/verify-forensics-live.ts
```

Fixtures are generated programmatically. Browser tests inject mock AI responses and exercise actual Auth.js code/PKCE flows against mock providers and an embedded PostgreSQL engine. They verify contracts/ownership, not real provider credentials. The live script sends a fresh generated exchange/screenshot, validates quotation IDs, and checks a random screenshot reference survives transcription.

Final manual acceptance requires a genuinely unfamiliar conversation supplied by an authorized tester. None has been supplied in this session. Generated tests and generated live calls do not substitute for that acceptance. Do not describe it or live Google/GitHub OAuth as verified without corresponding evidence.
