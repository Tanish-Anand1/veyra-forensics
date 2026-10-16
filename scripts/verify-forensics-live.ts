import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import assert from "node:assert/strict";
import { parseConversation } from "../shared/import";
import { selectMessages } from "../shared/selection";
const origin = process.env.TEST_BASE_URL || "http://localhost:3005";
const statusResponse = await fetch(origin + "/api/import/status");
const status = await statusResponse.json();
assert.equal(status.configured, true);
const cookie = statusResponse.headers
  .getSetCookie()
  .map((s) => s.split(";")[0])
  .join("; ");
const post = async (path: string, body: unknown) => {
  const response = await fetch(origin + path, {
    method: "POST",
    headers: { origin, cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
};
const token = randomUUID().slice(0, 8);
const draft = parseConversation(
  [
    `16/10/2026, 12:01 - Delivery coordinator: Your parcel reference ${token} is held. Transfer a release fee of 740 rupees to my personal wallet in ten minutes.`,
    "16/10/2026, 12:02 - Recipient: I will contact the courier using the number on my original receipt.",
    "16/10/2026, 12:03 - Delivery coordinator: Keep this private. Send your account password so I can authorize the refund.",
    "16/10/2026, 12:04 - Recipient: I will not share a password or make a payment.",
  ].join("\n"),
  "generated-live-check.txt",
);
const report = await post("/api/analyze", {
  kind: "import-segment",
  requestId: randomUUID(),
  consent: true,
  messages: selectMessages(draft.messages, "all").segments[0].messages,
});
assert.ok(
  report.findings.some((f: { source: string }) => f.source === "model"),
);
for (const finding of report.findings)
  for (const evidence of finding.evidence)
    assert.ok(
      draft.messages.some(
        (m) => m.id === evidence.messageId && m.text.includes(evidence.quote),
      ),
    );
const svg = `<svg width="620" height="850" xmlns="http://www.w3.org/2000/svg"><rect width="620" height="850" fill="#ecefe9"/><text x="30" y="60" font-size="30" font-family="Arial">GENERATED TEST CONVERSATION</text><rect x="20" y="100" width="560" height="190" rx="12" fill="white"/><text x="40" y="140" font-size="25" font-family="Arial">Coordinator</text><text x="40" y="185" font-size="25" font-family="Arial">Pay a release fee of 740 rupees.</text><text x="40" y="230" font-size="25" font-family="Arial">Reference ${token}. 12:01</text><rect x="70" y="330" width="520" height="170" rx="12" fill="#c6dfcf"/><text x="90" y="375" font-size="25" font-family="Arial">Recipient</text><text x="90" y="420" font-size="25" font-family="Arial">I will verify independently.</text><text x="90" y="465" font-size="23" font-family="Arial">12:02</text></svg>`;
const image = await sharp(Buffer.from(svg)).webp().toBuffer();
await mkdir("artifacts/forensics", { recursive: true });
await writeFile(
  "artifacts/forensics/live-generated-text.json",
  JSON.stringify(report, null, 2),
);
await writeFile("artifacts/forensics/generated-vision-check.webp", image);
const reading = await post("/api/import/screenshots", {
  requestId: randomUUID(),
  consent: true,
  imageId: "img-0000000000000099",
  image: `data:image/webp;base64,${image.toString("base64")}`,
});
assert.ok(reading.extraction.messages.length >= 2);
assert.ok(JSON.stringify(reading.extraction.messages).includes(token));
assert.ok(JSON.stringify(reading.extraction.messages).includes("740"));
await mkdir("artifacts/forensics", { recursive: true });
await writeFile(
  "artifacts/forensics/live-generated-check.json",
  JSON.stringify(
    {
      synthetic: true,
      origin,
      checkedAt: new Date().toISOString(),
      model: status.model,
      visionModel: status.visionModel,
      findings: report.findings.length,
      report,
      extraction: reading.extraction,
    },
    null,
    2,
  ),
);
await writeFile("artifacts/forensics/generated-vision-check.webp", image);
console.log(
  JSON.stringify({
    synthetic: true,
    origin,
    model: status.model,
    visionModel: status.visionModel,
    groundedFindings: report.findings.length,
    transcribedMessages: reading.extraction.messages.length,
    exactRandomReferencePreserved: true,
  }),
);
