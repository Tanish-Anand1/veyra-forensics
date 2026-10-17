from pathlib import Path
from datetime import datetime, timezone, timedelta
from html import escape
from hashlib import sha256
import json
from fontTools.ttLib import TTFont as Font
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output/private/veyra-database-proof.json'
raw = SOURCE.read_bytes()
data = json.loads(raw.decode('utf-8-sig'))
totals = data['totals']
accounts = data['accounts']
assert len(accounts) == min(totals['users'], data['account_limit'])
assert sum(row['active_sessions'] for row in accounts) == totals['active_sessions'] or totals['users'] > data['account_limit']
OUT = ROOT / 'output/pdf/VEYRA-Private-Database-Proof.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
TMP = ROOT / 'tmp/pdfs'
TMP.mkdir(parents=True, exist_ok=True)
for name, family, weight in [('Plex', 'ibm-plex-sans', 400), ('PlexBold', 'ibm-plex-sans', 600), ('Display', 'barlow-condensed', 700), ('Brand', 'archivo-black', 400), ('Mono', 'ibm-plex-mono', 400)]:
    font = Font(ROOT / f'node_modules/@fontsource/{family}/files/{family}-latin-{weight}-normal.woff')
    font.flavor = None
    target = TMP / f'proof-{name}.ttf'
    font.save(target)
    pdfmetrics.registerFont(TTFont(name, str(target)))
pdfmetrics.registerFontFamily('Plex', normal='Plex', bold='PlexBold', italic='Plex', boldItalic='PlexBold')
INK, RED, GRAY, LINE, PAPER = map(colors.HexColor, ['#182023', '#9B302A', '#465158', '#C8CCCA', '#F3F2EB'])
styles = {
    'body': ParagraphStyle('body', fontName='Plex', fontSize=10, leading=14.5, textColor=INK),
    'small': ParagraphStyle('small', fontName='Plex', fontSize=9, leading=13, textColor=GRAY),
    'heading': ParagraphStyle('heading', fontName='Display', fontSize=23, leading=25, textColor=INK, spaceBefore=16, spaceAfter=8, keepWithNext=True),
    'title': ParagraphStyle('title', fontName='Display', fontSize=40, leading=40, textColor=INK, spaceAfter=12),
    'mono': ParagraphStyle('mono', fontName='Mono', fontSize=8.5, leading=13, textColor=INK, wordWrap='CJK'),
}
story = []
def paragraph(text, style='body'):
    return Paragraph(text, styles[style])
def add(text, style='body'):
    story.append(paragraph(text, style))
    if style != 'heading':
        story.append(Spacer(1, 7))
captured = datetime.fromisoformat(totals['captured_at']).astimezone(timezone(timedelta(hours=5, minutes=30)))
add('PRIVATE REVIEW COPY', 'small')
add('The database<br/>behind the sign-in.', 'title')
add(f"Database snapshot captured {captured.strftime('%d %B %Y, %H:%M:%S')} IST. Source: <b>{escape(data['source'])}</b>.")
add(escape(data.get('capture_method', 'Read-only SELECT snapshot')), 'small')
add('These are observed database records. No synthetic accounts or session records were inserted to produce this report.', 'small')
summary = [
    ['Stored users', 'Linked accounts', 'Active sessions'],
    [Paragraph(str(totals[key]), ParagraphStyle('metric', fontName='Display', fontSize=35, leading=40, textColor=INK)) for key in ['users', 'linked_accounts', 'active_sessions']],
    [f"Google: {totals['google_accounts']} / GitHub: {totals['github_accounts']}", f"Provider tokens retained: {totals['retained_provider_tokens']}", f"Stored sessions: {totals['stored_sessions']}"],
]
table = Table(summary, colWidths=[166, 166, 167], rowHeights=[30, 58, 36])
table.setStyle(TableStyle([
    ('FONTNAME', (0,0), (-1,0), 'PlexBold'), ('FONTSIZE', (0,0), (-1,0), 10),
    ('FONTNAME', (0,1), (-1,1), 'Display'), ('FONTSIZE', (0,1), (-1,1), 35),
    ('FONTNAME', (0,2), (-1,2), 'Plex'), ('FONTSIZE', (0,2), (-1,2), 8.5),
    ('TEXTCOLOR', (0,0), (-1,-1), INK), ('BACKGROUND', (0,0), (-1,-1), PAPER),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('TOPPADDING', (0,0), (-1,-1), 9), ('BOTTOMPADDING', (0,0), (-1,-1), 9),
    ('LEFTPADDING', (0,0), (-1,-1), 10), ('LINEABOVE', (0,0), (-1,0), 1, RED),
]))
story.extend([table, Spacer(1, 7)])
add('Stored account records', 'heading')
add('Names are masked before export. Account references are shortened hashes of internal user IDs. Different provider accounts remain separate.', 'small')
rows = [[paragraph('Account reference', 'small'), paragraph('Masked name', 'small'), paragraph('Provider', 'small'), paragraph('Active / stored sessions', 'small')]]
for row in accounts:
    providers = ', '.join(provider for provider, key in [('Google', 'google'), ('GitHub', 'github')] if row[key]) or 'Other'
    rows.append([paragraph(escape(row['account_ref']), 'mono'), paragraph(escape(row['masked_name'])), paragraph(providers), paragraph(f"{row['active_sessions']} / {row['stored_sessions']}")])
table = Table(rows, colWidths=[132, 110, 95, 162], repeatRows=1, hAlign='LEFT')
table.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'TOP'), ('LINEBELOW', (0,0), (-1,0), 1, INK),
    ('LINEBELOW', (0,1), (-1,-1), .4, LINE), ('TOPPADDING', (0,0), (-1,-1), 8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 8), ('LEFTPADDING', (0,0), (-1,-1), 0),
]))
story.append(table)
if totals['users'] > data['account_limit']:
    add(f"Account rows are limited to the first {data['account_limit']}; totals cover the database.", 'small')
add('What this proves', 'heading')
add(f"The hosted database contains {totals['users']} user records, {totals['linked_accounts']} linked OAuth accounts and {totals['stored_sessions']} session records. {totals['hashed_session_records']} stored session values match the application's 64-character hash format. Provider access, refresh and ID token columns contain no retained values. Saved investigations at this snapshot: {totals['investigations']}.")
add('What it does not prove', 'heading')
add('This is a current-state snapshot, not a chronological log of every login. The schema does not record login-event timestamps, IP addresses or device history. A user without an active session may have logged out or had a session expire. Session expiry is not presented as a login time.')
add('How to verify or refresh', 'heading')
add('An authorized operator can open the database Query view in Vercel, leave Read-only enabled and run <b>scripts/database-proof.sql</b>. Copy the returned snapshot into <b>output/private/veyra-database-proof.json</b>, then run <b>python scripts/create-database-proof.py</b>. The alternative <b>npm run db:proof</b> requires a privately configured DATABASE_URL and executes the same SELECT inside a read-only transaction.')
add('Privacy and evidence handling', 'heading')
add('The report excludes full names, emails, original user and provider identifiers, avatar URLs, token values and connection credentials. The snapshot and PDF stay in ignored local output directories, outside the public website and GitHub. Read-only queries did not modify records.')
digest = sha256(raw).hexdigest()
add('Snapshot SHA-256', 'small')
add(digest, 'mono')
add('The checksum identifies this exported snapshot; it is not a third-party attestation. Source: live SELECT result in the hosted database console, with Read-only checked.', 'small')

def frame(c, doc):
    w, h = doc.pagesize
    c.setFillColor(INK)
    c.setFont('Brand', 18)
    c.drawString(48, h - 38, 'VEYRA')
    c.setStrokeColor(RED)
    c.setLineWidth(1)
    c.line(48, h - 51, w - 48, h - 51)
    c.setFillColor(GRAY)
    c.setFont('Plex', 8)
    c.drawString(48, 27, 'Private database evidence / Masked account snapshot')
    c.drawRightString(w - 48, 27, str(doc.page))

doc = SimpleDocTemplate(str(OUT), pagesize=(595.28,841.89), leftMargin=48, rightMargin=48, topMargin=72, bottomMargin=48, title='VEYRA | Private database proof', author='VEYRA')
doc.build(story, onFirstPage=frame, onLaterPages=frame)
reader = PdfReader(str(OUT))
text = '\n'.join(page.extract_text() or '' for page in reader.pages)
assert len(reader.pages) >= 1 and 'Stored account records' in text
assert '@' not in text and 'sk-proj-' not in text and 'postgresql://' not in text
print(json.dumps({'pdf':str(OUT), 'pages':len(reader.pages), 'bytes':OUT.stat().st_size, 'snapshotSha256':digest, 'maskedAccounts':len(accounts)}))
