from pathlib import Path
from html import escape
import json
from fontTools.ttLib import TTFont as Font
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf'
TMP = ROOT / 'tmp/pdfs'
OUT.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
for name, family, weight in [('Plex', 'ibm-plex-sans', 400), ('PlexMedium', 'ibm-plex-sans', 500), ('PlexBold', 'ibm-plex-sans', 600), ('Display', 'barlow-condensed', 700), ('Brand', 'archivo-black', 400), ('Mono', 'ibm-plex-mono', 400)]:
    source = ROOT / f'node_modules/@fontsource/{family}/files/{family}-latin-{weight}-normal.woff'
    font = Font(source)
    font.flavor = None
    target = TMP / f'{name}.ttf'
    font.save(target)
    pdfmetrics.registerFont(TTFont(name, str(target)))
pdfmetrics.registerFontFamily('Plex', normal='Plex', bold='PlexBold', italic='Plex', boldItalic='PlexBold')

W, H = 595.28, 841.89
L, R, CW = 48, 547.28, 499.28
INK, PAPER, RED, GRAY, LINE = map(HexColor, ['#182023', '#F2F0E8', '#A5322A', '#505C61', '#C7CCC7'])
PDF = OUT / 'VEYRA-Complete-Website-Guide.pdf'
c = canvas.Canvas(str(PDF), pagesize=(W, H), pageCompression=1)
c.setTitle('VEYRA | The complete website guide')
c.setAuthor('VEYRA')
c.setSubject('Product workflow, evidence interpretation, authentication, data handling and developer architecture')
page_number = 0
checks = []

def text(value, x, top, size=11, font='Plex', color=INK):
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawString(x, H-top-size, value)

def para(value, top, width=CW, x=L, size=11, color=INK, leading=None):
    style = ParagraphStyle('body', fontName='Plex', fontSize=size, leading=leading or size*1.47, textColor=color, spaceAfter=0)
    p = Paragraph(value, style)
    _, height = p.wrap(width, H)
    if top + height > 776:
        raise ValueError(f'Page {page_number}: paragraph exceeds safe area at {top + height}')
    p.drawOn(c, x, H-top-height)
    checks.append({'page': page_number, 'bottom': round(top+height, 1)})
    return top + height

def line(top, x=L, width=CW, color=LINE):
    c.setStrokeColor(color)
    c.setLineWidth(.6)
    c.line(x, H-top, x+width, H-top)

def page(section, title, intro=None):
    global page_number
    if page_number:
        c.showPage()
    page_number += 1
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    text('VEYRA', L, 25, 15, 'Brand')
    text(section, 305, 30, 9, 'PlexMedium', GRAY)
    line(62)
    text(title, L, 89, 35, 'Display')
    y = 145
    if intro:
        y = para(intro, y, size=12.5, color=GRAY) + 26
    line(792)
    text('VEYRA / Product and technical guide / 17 October 2026', L, 805, 8, 'Plex', GRAY)
    text(f'{page_number:02}', 528, 803, 10, 'Mono', GRAY)
    c.bookmarkPage(f'page-{page_number}')
    c.addOutlineEntry(title, f'page-{page_number}', level=0)
    return y

def block(heading, body, y):
    text(heading, L, y, 16, 'Display')
    y = para(body, y+27) + 22
    return y

def rows(items, y, left_width=142):
    for label, body in items:
        line(y)
        text(label, L, y+13, 10.5, 'PlexBold')
        end = para(body, y+12, width=CW-left_width-16, x=L+left_width+16, size=10.5)
        y = max(end+15, y+49)
    return y + 18

def note(heading, body, y):
    c.setStrokeColor(RED)
    c.setLineWidth(2)
    c.line(L, H-y, L, H-y-70)
    text(heading, L+15, y, 13, 'PlexBold', RED)
    return para(body, y+25, width=CW-20, x=L+15, size=10.5) + 24

def image(path, x, top, width, height):
    c.drawImage(ImageReader(str(path)), x, H-top-height, width=width, height=height, preserveAspectRatio=True, anchor='c', mask='auto')

y = page('The complete website guide', 'See through deception.')
text('VEYRA', L-2, 175, 86, 'Brand')
image(ROOT/'public/mechanism.webp', L, 290, CW, 265)
para('Investigate suspicious conversations.<br/>Trace manipulation. Inspect the evidence.', 590, size=17, leading=24)
para('A practical guide for visitors, investigators and developers. It explains what the website does, how each feature works, where data goes and what its results cannot prove.', 665, size=11.5)
text('https://veyra-forensics.vercel.app', L, 752, 11, 'PlexMedium', RED)
c.linkURL('https://veyra-forensics.vercel.app', (L, H-768, R, H-745), relative=0)

y = page('01 / Product overview', 'What VEYRA does.', 'VEYRA turns a conversation into an inspectable record of messages, relationships, possible manipulation indicators and protective next steps.')
y = rows([
    ('The input', 'Authorized WhatsApp text/ZIP exports, screenshots or pasted conversations. You review reconstructed messages before investigation.'),
    ('The process', 'Local rules inspect the actual text. Optional OpenAI processing extracts structured interpretations. Exact quotations and message IDs are validated before findings enter the report.'),
    ('The output', 'An interactive TrustGraph, Summary, Evidence and Timeline views, chronological replay and transparent hypothetical scenarios.'),
    ('Your workspace', 'Google or GitHub sign-in gives access to private saved investigations. Saving is explicit. You can reopen, rename and delete your own records.'),
    ('The boundary', 'A finding is an interpretation of submitted content. VEYRA does not establish identity, prove fraud, browse suspicious links or contact the sender.')
], y)
y = note('The central rule', 'Every analytical connection must come from submitted messages or validated findings. The cinematic sculpture is a brand metaphor, not an analytical graph.', y)
para('Reading path: visitor journey (pages 3-10), privacy and technology (11-14), worked example and limitations (15-16), export and sharing (17), and navigation/reference index (18).', y, size=10.5)

y = page('02 / First visit', 'From opening to workspace.', 'The opening creates the atmosphere. Authentication and guest access remain direct, understandable choices.')
y = block('The cinematic entrance', 'The seven-second sequence brings machined metallic forms out of darkness, separates them around a red fracture, passes the camera through the geometry and reveals the VEYRA wordmark. The final sculpture settles into the login composition. Skip intro is available immediately.', y)
y = block('On a phone', 'Capable mobile browsers use the same real-time sculpture with portrait framing and a lower pixel budget. A short, restrained camera settling motion preserves the material depth. Reduced-motion preferences, data saving and unavailable graphics use a portrait still. Controls remain usable when graphics fail.', y)
y = block('Choose an entry', 'Use Google or GitHub for a private workspace. Use Explore VEYRA for a public product explanation, or Try a guest investigation to inspect your own material without logging in. First-time registration and returning login share the same real OAuth flow.', y)
y = block('One public address', 'Internal navigation keeps the address bar at the root origin. Back, Forward and refresh restore the current view using history state and tab-scoped storage. Existing direct paths still open the right view, then normalize to the root. A shared root link does not encode a specific page.', y)
note('OAuth is an intentional exception', 'Sign-in temporarily visits Google or GitHub and the required server callback URL, then returns to VEYRA. Credentials are never entered into an imitation provider form.', y)

y = page('03 / Import', 'Bring the conversation.', 'The import flow is public. Use material you are entitled to access and process, and remove unrelated personal information.')
y = rows([
    ('WhatsApp .txt', 'The browser reads the chosen export in a worker. Common Android/iOS numeric date formats, 12/24-hour times, seconds, Unicode digits and several localized month names are supported. Not every regional format is guaranteed.'),
    ('WhatsApp ZIP', 'Only text entries are decompressed. Included media is ignored. If an archive contains multiple chats, choose which text export to reconstruct. Unsafe paths, suspicious expansion, corrupt checksums and unsupported archive structures are rejected.'),
    ('Pasted text', 'Paste a conversation or a transcript. The compact workstation treats each nonempty line as a chronological message. Sender: message improves attribution. The import workflow offers richer transcript review.'),
    ('Screenshots', 'Choose up to eight static images. The browser checks dimensions, resizes images, strips metadata and makes prepared WebP previews. Reorder images and mask sensitive regions before consenting to upload.'),
    ('Screenshot reading', 'After image consent, a real vision request transcribes visible messages, apparent speakers, timestamps, source regions and uncertainty notes. Overlapping screenshots can be merged with provenance retained. Unreadable images may return no messages.')
], y)
note('Nothing is fetched from WhatsApp', 'VEYRA reads only the files or text you choose. It does not connect to WhatsApp, retrieve private chats or visit message links.', y)

y = page('04 / Reconstruction and review', 'Correct before interpreting.', 'The review step makes extraction inspectable. A transcription error should be corrected before it becomes evidence.')
y = block('Inspect the reconstructed record', 'Check sender labels, text, dates, chronology and missing lines. Resolve ambiguous date order when asked. No timezone is invented. Screenshot uncertainty and overlapping-message decisions remain visible. A sender label is input attribution, not verified identity.', y)
y = block('Edit the transcript', 'Correct message text, sender or timestamp; reorder or remove messages; resolve uncertainty; and check the original source references. Source references identify text lines or screenshot regions. Edits invalidate previous analysis consent so the changed record is reviewed again.', y)
y = block('Redact locally', 'Preview and apply local removal of common sensitive patterns. Use screenshot masks before upload, or remove names and other identifying terms in transcript review. Automated redaction is incomplete: manually inspect what remains.', y)
y = block('Choose coverage', 'Large histories are bounded. Select all within limits, a relevant selection or a chronological range. The interface discloses the analyzed selection and omissions. Deterministic packet preparation includes nearby context and anchor messages, rather than silently claiming to analyze every message.', y)
note('Selection can change the story', 'Omitted context, sarcasm, language, quoted speech or mistaken attribution can change an interpretation. Review coverage and retain an authorized original when it is needed.', y)

y = page('05 / Analysis', 'Two methods. One evidence record.', 'The interface distinguishes local checks from optional model processing. A missing or failed provider is reported as a failure, not a successful analysis.')
y = rows([
    ('Local checks', 'Deterministic rules run in the browser using the submitted messages. They look for explicit patterns such as payment, credentials, sensitive documents, urgency, secrecy, conflicting statements and suspicious destination structure. No model call is needed.'),
    ('OpenAI + local', 'After explicit consent, the server uses the OpenAI SDK and structured output. Untrusted conversation text is treated as data. The model has no tools for browsing links or taking actions. The server requests store: false, but that does not promise zero provider retention.'),
    ('Quote validation', 'A model finding must refer to an existing message ID and contain an exact, nonempty quotation. Unsupported citations are discarded. Exact quotation matching checks provenance, not whether the interpretation is correct.'),
    ('Imported histories', 'The reviewed selection becomes chronological bounded segments. Completed segments can be retained while a failed segment is retried. The canonical report merges supported findings, relationships, source references and actions.'),
    ('Costs and models', 'Quick analysis uses the server-configured OPENAI_MODEL. Imports and vision use their own configured model names. The deployment uses the low-cost models documented in setup; model choices are configuration, not a user-visible accuracy guarantee.')
], y)
note('No silent substitution', 'The application does not quietly switch to an expensive provider or invent results when a request fails. Local checks remain a separate available method.', y)

y = page('06 / Assessment', 'Concern is not a probability.', 'The assessment is a transparent rule over supported findings. It is not a calibrated risk score or a verdict about a person.')
y = rows([
    ('Elevated concern', 'A consequential request occurs alongside pressure, conflicting statements or an assumed unrelated destination. For example, a payment request plus a short deadline warrants pausing and verifying independently.'),
    ('Review before acting', 'A consequential request or pressure appears without the stronger combination above. An assumed unrelated destination can also require review. Inspect the supporting quotation and context.'),
    ('Insufficient evidence', 'The submitted record does not meet the rule thresholds above. This does not mean the conversation or sender is safe. Missing messages, indirect wording or unsupported language can hide important context.')
], y)
y = block('Observed versus inferred', 'An observed request means the submitted text contains a matching pattern or quoted content. It does not establish whether the request is legitimate. Model interpretations remain inferred. Sender identities, institutional claims, recipient ownership and motives remain unverified unless independently checked outside the tool.', y)
y = block('Destination inspection is structural', 'The URL parser can expose the actual hostname, user-info components, punycode, an IP address, institution-like subdomains, a reserved example domain or plain HTTP. VEYRA does not fetch the destination, resolve ownership or query a reputation service. HTTPS is not proof of legitimacy.', y)
note('Use the source, then the next step', 'Read the full exchange around a quotation. Consider innocent explanations, verify through a separate official channel and avoid making an irreversible decision solely from the automated assessment.', y)

y = page('07 / TrustGraph', 'Read relationships, then evidence.', 'The TrustGraph is a view of the canonical analysis object. Its geometry does not represent a probability or an independently verified identity.')
nodes = [('Sender', 80, 268), ('Message 3', 242, 268), ('Payment request', 414, 268), ('Destination', 242, 382)]
c.setStrokeColor(GRAY)
c.setLineWidth(1)
for a,b in [(0,1),(1,2),(1,3)]:
    x1,t1=nodes[a][1:]; x2,t2=nodes[b][1:]
    c.line(x1+33,H-t1-16,x2+33,H-t2-16)
for index,(label,x,top) in enumerate(nodes):
    c.setFillColor(INK if index!=2 else RED)
    c.rect(x-17,H-top-34,122 if index==2 else 100,34,fill=1,stroke=0)
    text(label,x-8,top+8,9,'PlexMedium',PAPER)
text('Illustrative relationship map using a fictional message.', L, 439, 9, 'Plex', GRAY)
y = 480
y = block('What nodes and edges mean', 'Nodes represent sender labels, messages, claims, observations, destinations and requested actions. Edges represent supported relationships such as attribution, quoted evidence or a URL contained in a message. No decorative analytical nodes are added for visual density.', y)
y = block('Select a connection', 'Selecting a node or edge opens its originating message, exact quotation, explanation and protective action. Selecting an evidence reference focuses the related message or graph relationship. The graph and the report do not make separate model requests.', y)
y = block('Navigate the graph', 'Pan, zoom, focus a selection, reset or use the controlled orbit. Keyboard selection is available. Long records use readable chapters or an optional whole graph. On narrow screens, the view concentrates on a message and its related evidence.', y)

y = page('08 / Reports and replay', 'Three views of the same record.', 'Summary, Evidence and Timeline answer different questions. They are not three independent analyses.')
y = rows([
    ('Summary', 'What needs attention? Review the overall assessment, observed warning signs, protective steps, potential next-stage risks and uncertainty. Expand the method and limitations before relying on a result.'),
    ('Evidence', 'What supports the finding? Inspect message IDs and exact quoted excerpts. Follow source references back to the transcript or originating imported source. Keep observation and inferred motive distinct.'),
    ('Timeline', 'How does the exchange develop? Review cumulative changes in the conversation, with evidence linked to message order and supplied timestamps where available.'),
    ('Conversation replay', 'Move through messages chronologically. The browser recomputes local prefix analyses so future evidence does not leak backward. Full-context model interpretations return with the complete conversation; earlier steps do not pretend that the model knew only that prefix.'),
    ('Counterfactuals', 'Apply transparent assumptions, such as excluding payment or urgency evidence or assuming identity/destination confirmation. This creates a derived view. It does not edit the original messages, establish the assumed fact or call the model again.')
], y)
note('Read the protective action as a next step', 'Pause payment, withhold documents, involve a trusted person or verify through an independently found official channel. VEYRA does not submit a report or contact a sender for you.', y)

y = page('09 / Accounts and saved history', 'Your evidence, by your choice.', 'Public exploration does not require an account. Saving or revisiting a private investigation does.')
y = block('Real OAuth, shared registration', 'Continue with Google or GitHub starts a server-handled authorization-code flow through Auth.js. Google requests OpenID/profile/email; GitHub requests public data only, without repository or private-email permissions. A first authorization creates an account; a returning authorization opens the existing workspace.', y)
y = block('Secure sessions', 'The server stores opaque, hashed session tokens in PostgreSQL. HTTPS cookies are Secure, HttpOnly and SameSite=Lax. Sessions last up to seven days, with library-managed renewal. Logout revokes the current browser session. Provider access, refresh and ID tokens are not retained.', y)
y = block('Save, revisit, rename, delete', 'Choose Save investigation, supply a title and explicitly consent to storing the conversation and report. Private history lists your records. Reopen an investigation, rename its title or permanently delete it after confirmation. The account limit is 100 saved investigations.', y)
y = block('Ownership is checked on the server', 'The session supplies the owner identity. Every record read, rename and delete includes both record ID and owner ID. Another user gets the same not-found response as a nonexistent ID. Knowing an investigation ID is not authorization.', y)
note('Return with the same provider', 'Accounts are not automatically linked by matching email. Google and GitHub workspaces remain separate. Missing or unverified email is handled safely rather than trusted for account merging.', y)

y = page('10 / Privacy and data flow', 'Know what leaves your device.', 'Local processing, provider processing and saving are distinct decisions. Exports and hosting backups have their own retention boundaries.')
y = rows([
    ('Browser only', 'Unsaved text, files, edits and local analysis stay in page memory. Text/ZIP parsing and screenshot preparation run locally. Original files and unselected history are released when an imported report opens.'),
    ('Screenshot consent', 'Prepared previews are uploaded through the server to OpenAI for transcription only after image consent. Server-side image validation and metadata removal run again. Masking must be checked before sending.'),
    ('Text consent', 'Optional analysis sends only prepared packet fields such as message IDs, speaker labels, text and source indices. Original archives, filenames and screenshot pixels are not included in the text-analysis packets.'),
    ('Save consent', 'Saving sends the reviewed conversation/selection, canonical report, source references, uncertainty and title to private PostgreSQL storage. Live-record deletion is immediate; backups follow the host configuration.'),
    ('Browser recovery', 'A guest may opt into a tab-scoped recovery copy for up to 30 minutes during sign-in. It is never automatically saved to the database. Clear, successful save and logout remove it. Current view state is also stored for navigation.'),
    ('Other state', 'Session cookies identify authenticated requests. A local-storage timestamp informs other tabs about sign-out. Conversation content is not put into URLs, local storage or cookies. Application diagnostics avoid raw conversations, tokens and profiles.')
], y)
note('Practical privacy choice', 'If material must remain on your device, choose local checks, do not upload screenshots for transcription and do not save it to an account.', y)

y = page('11 / Technical architecture', 'How the software fits together.', 'VEYRA uses React and Vite for the interface, Express for the same-origin API, Auth.js for authentication, and PostgreSQL for private state. It is not a Next.js application.')
y = rows([
    ('Presentation', 'React 19 + TypeScript. The application view router keeps the root address, handles Back/Forward and restores tab state. Self-hosted Archivo Black, Barlow Condensed, IBM Plex Sans and IBM Plex Mono define the type system.'),
    ('Cinematic layer', 'Three.js through React Three Fiber creates original bevelled titanium geometry, brushed textures and studio reflections. GSAP coordinates the scene and wordmark timeline. Demand rendering, mobile pixel caps and fallbacks bound graphics work.'),
    ('Domain layer', 'Shared schemas define messages, findings, graph relationships and import records. Shared parsing, rules, evidence validation, assessment and selection functions construct a canonical analysis object.'),
    ('API boundary', 'Express validates input, applies consent and rate controls, calls OpenAI, handles provider failures and serves Auth.js routes. Production /api requests run through the Vercel serverless adapter on the same origin.'),
    ('Private persistence', 'The official PostgreSQL adapter stores users, linked accounts and sessions. Investigations and shared abuse counters are additional application tables. A restricted runtime database role has table CRUD and sequence access, without schema or role management.'),
    ('Exports', 'PDF and evidence JSON are generated locally on demand. The source archive command packages an explicit file allowlist and scans credential patterns, excluding environment secrets, deployment state, dependencies and generated output.')
], y)

y = page('12 / Boundaries and recovery', 'Limits are part of the product.', 'Bounded input protects responsiveness and provider cost. If part of a history is omitted, the report must disclose that coverage.')
y = rows([
    ('Quick workstation', '8-18,000 text characters; up to 60 messages, one per nonempty line.'),
    ('Text import', '10 MB; up to 3 million decoded characters and 20,000 reconstructed messages.'),
    ('ZIP import', '12 MB compressed; 50 MB declared expansion; 2,000 entries; 10 MB per text entry. Actual streaming decompression also enforces an independent output budget.'),
    ('Screenshots', 'Up to 8 originals; each up to 12 MB and 16 megapixels. Prepared images use a maximum 1,800-pixel edge. Vision output is bounded to 60 visible messages per image.'),
    ('Investigation', 'Up to 180 selected messages, 72,000 unique text characters and 6 chronological segments. Each segment is bounded to 36 messages and 14,000 text characters including context.'),
    ('Provider request', '35-second provider timeout; no SDK automatic retries. Application and edge rate controls apply. The deployment edge shares a 10-request/minute/IP limit across analysis and screenshot endpoints.'),
    ('Failure recovery', 'Input stays available after a failed quick analysis. Import processing can retain completed chunks and retry a failed segment while mounted. Cancellation discards client results but cannot guarantee a running provider request or its charge has stopped.')
], y, left_width=128)
note('Rate limits are not a budget', 'There is no global model-spending cap. Import deduplication is bounded and per instance; it does not guarantee exactly-once billing across reloads or server instances.', y)

y = page('13 / Deployment and maintenance', 'A guide for the next developer.', 'Run, configure and verify the existing project. Keep credentials outside browser code, logs and shared archives.')
y = block('Run locally', 'Install dependencies with <b>npm ci</b>, then start with <b>npm run dev</b>. The normal local address is http://localhost:3000. <b>npm run build</b> performs TypeScript checking, builds the frontend and bundles the local Express host. <b>npm start</b> serves the built application.', y)
y = block('Configure server-only values', 'Auth requires AUTH_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET and DATABASE_URL. OpenAI uses OPENAI_API_KEY, OPENAI_MODEL and optional OPENAI_FORENSICS_MODEL / OPENAI_VISION_MODEL. Never prefix secrets with VITE_. Local installations need their own provider credentials.', y)
y = block('Register exact callbacks', 'Local: http://localhost:3000/api/auth/callback/google and /api/auth/callback/github. Production uses the equivalent HTTPS paths under veyra-forensics.vercel.app. Production sign-in is pinned to the canonical origin; arbitrary preview domains are not valid substitutes.', y)
y = block('Migrate and grant narrowly', 'Apply migrations/001_auth.sql with an owner migration connection via npm run db:migrate. Deploy a separate restricted runtime connection. Do not run DDL during web requests. Schedule expired-session/rate-counter cleanup and set appropriate backup retention and operational contacts.', y)
y = block('Release checks', 'Use npm run lint, npm run typecheck, npm test, npm run build, npm run test:e2e and the separate-file serverless startup check. Deploy through the linked Vercel project, then run the HTTP and authentication release scripts against the canonical origin. Test real OAuth only with configured credentials and controlled accounts.', y)

y = page('14 / A worked example', 'From a message to a decision.', 'This fictional workshop conversation illustrates the workflow. It is a teaching example, not evidence about a real person or organization.')
example = [
    ('M1 / Organizer', 'Your place in the fictional Harbor workshop is confirmed. There is no registration fee.'),
    ('M2 / Participant', 'How can I confirm this with the venue?'),
    ('M3 / Organizer', 'Your place expires in 15 minutes. Pay a registration fee of $85 at harbor-workshop-payments.example.'),
    ('M4 / Organizer', 'Keep this confidential. Do not contact the venue. Send your passport scan today.')
]
y = rows([(label, escape(body)) for label,body in example], y, left_width=124)
y = block('Investigate', 'Paste the four messages and select local checks. The report can identify the actual payment request, stated deadline, isolation language, requested document and unverified destination. Select the payment connection to read the exact originating message and its protective step.', y)
y = block('Replay and compare', 'Replay through M2 first: the later payment and secrecy evidence is absent. Advance to M3 and M4 to inspect escalation. A counterfactual excluding payment shows how the derived assessment changes, while the original evidence stays intact.', y)
note('A careful conclusion', 'Pause payment and document sharing. Verify the workshop and any fee through an independently found official contact. The result raises concern; it does not prove that the sender committed fraud.', y)

y = page('15 / Verification and limitations', 'What has actually been checked.', 'Verification is evidence about specific behavior. It is not a claim of forensic accuracy, perfect security or universal device compatibility.')
y = block('Real integrations', 'Live Google and GitHub first authorization and returning login were verified on the production site. Profile images, refresh persistence, logout, saving, rename, reopen and deletion worked with a synthetic record. A separate provider account could not list or open that record. Aggregate SQL confirmed distinct users, hashed sessions and no retained provider tokens.', y)
y = block('Automated journeys', 'The current release passed 41 local browser scenarios across the main run and a focused rerun, plus 11 mobile/product tests on the live domain. The earlier unit/API suite passed 28 checks. Failure cases such as cancellation, provider outage, expiry and cross-user mutation use mocked providers. Mobile checks inspect changing rendered frames, portrait layouts, skip/replay, reduced motion, data saving and graphics-loss recovery.', y)
y = block('Interpretation limits', 'English phrase rules can misread negation, quotations, sarcasm, context and speaker perspective. Language support and subtle deception are incomplete. A model can also be wrong even when its quotation is exact. No detection accuracy, calibrated probability, safety guarantee or verified identity is claimed.', y)
y = block('Operational limits', 'Shared durable request deduplication and a global spending cap remain hardening work. Exports and database backups survive outside live-record deletion. Legal review, operator identity/contact, monitoring and retention choices remain deployment responsibilities. There is no automatic account-linking feature.', y)
note('Testing that still matters', 'Emulated mobile browsers do not replace real iPhone/Android testing. Automated accessibility checks do not establish screen-reader compatibility. Lab observations are not field Core Web Vitals or human usability research.', y)

y = page('16 / Export and sharing', 'Keep the evidence usable.', 'Saving to an account and downloading an export are different actions. An export becomes a file on your device, outside VEYRA\'s live-record deletion controls.')
y = block('Download the evidence JSON', 'Use Export evidence in the compact workstation, or the JSON export in an imported report. The structured record preserves the canonical messages, supported findings, graph relationships, source references and protective actions. Counterfactual assumptions do not overwrite the original evidence export.', y)
y = block('Create a PDF from an imported report', 'The imported investigation workspace offers local PDF generation on demand. The report includes the coverage, source IDs, quotations, protective actions and uncertainty notes. It does not need a new model call. Review the report before sharing it and confirm that it contains only material the recipient is entitled to see.', y)
y = block('Understand the PDF format', 'The investigation exporter uses browser-shaped/rasterized excerpts for complex scripts. Those excerpts are not fully searchable or fully accessible PDF text. The exact Unicode evidence record is attached as JSON, and the separate JSON export remains available for inspection. This product guide is a separate document with embedded text fonts.', y)
y = block('Share a conclusion carefully', 'Include the relevant quotation, its context, the source message ID, uncertainty and the protective next step. Do not describe an inferred motive as a fact. Avoid publishing names, private documents, account details or an entire conversation when a small authorized excerpt is enough.', y)
note('Deletion has a defined scope', 'Deleting a saved investigation removes the live database record. It does not erase a downloaded PDF or JSON file, another person\'s copy, a provider record or the host\'s backups.', y)

y = page('17 / Navigation and reference', 'Find the right surface.', 'The footer groups the main journeys and the product standards. Internal links open application views at the same public root address.')
y = rows([
    ('Explore VEYRA', 'Public product explanation and the interactive fictional demonstration.'),
    ('Import conversation', 'WhatsApp exports, ZIPs, screenshots and pasted text, followed by reconstruction and review.'),
    ('Analysis workstation', 'Compact local or optional OpenAI analysis with evidence-linked graph, reports, replay and scenarios.'),
    ('Your investigations', 'Authenticated private history. Reopen, rename or delete saved investigations.'),
    ('Methodology', 'How assessment, evidence and uncertainty work. Read it before interpreting the report.'),
    ('Sources', 'Research, public safety guidance and implementation references. Each has a stated role and limit. References do not certify VEYRA or validate its detection performance.'),
    ('Cyber ethics', 'Permission, data minimization, uncertainty, context, respectful handling and independent verification.'),
    ('Privacy / Terms', 'Data practices, retention boundaries, experimental status and responsible use. Contact shows only an operator address actually configured for the deployment.')
], y, left_width=133)
para('Implementation sources: README.md; docs/AUTHENTICATION.md; docs/CONVERSATION_IMPORT.md; docs/LIVE_AUTH_ACCEPTANCE.md; shared/engine.ts; shared/selection.ts; src/evidence.ts; server/auth.ts; server/database.ts; src/components/MetalScene.tsx. Configuration and limits can change; check the current source when maintaining the product.', y, size=9.5, color=GRAY)
c.save()
reader = PdfReader(str(PDF))
all_text = '\n'.join(p.extract_text() or '' for p in reader.pages)
assert len(reader.pages) == 18
assert all(len(p.extract_text() or '') > 300 for p in reader.pages)
assert 'sk-proj-' not in all_text and 'GOCSPX-' not in all_text
manifest = {'path': str(PDF), 'pages':len(reader.pages), 'bytes':PDF.stat().st_size, 'textCharacters':len(all_text), 'maxBodyBottom':max(x['bottom'] for x in checks), 'embeddedFonts': ['Archivo Black', 'Barlow Condensed', 'IBM Plex Sans', 'IBM Plex Mono'], 'credentialValuesIncluded':False}
(TMP/'guide-validation.json').write_text(json.dumps(manifest,indent=2), encoding='utf8')
print(json.dumps(manifest))
