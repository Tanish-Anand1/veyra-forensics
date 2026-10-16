import assert from "node:assert/strict";
import { samples } from "../shared/samples";
import type { Analysis } from "../shared/schema";

const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const status = await (await fetch(base + "/api/status")).json();
assert.ok(status.configured, "Configure a server-side OPENAI_API_KEY first.");
const cases = [
  ...samples.map((s) => ({ id: s.id, text: s.text })),
  {
    id: "financial",
    text: "Seller: Pay the deposit. Act immediately.\nBuyer: Please send the written agreement first.",
  },
  {
    id: "ambiguous",
    text: "Advisor: There may be a fee. Please check the published schedule.\nStudent: I will check with the office.",
  },
  {
    id: "unfamiliar",
    text: "Recruiter: To activate your badge, remit the enrollment deposit before the intake window closes at dusk. Please keep this off the group chat.\nCandidate: May I verify this with the company switchboard?",
  },
];
for (const sample of cases) {
  const response = await fetch(base + "/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: sample.text, mode: "openai", consent: true }),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    200,
    `Case ${sample.id}: ${data.error || "request failed"}`,
  );
  const analysis = data as Analysis;
  assert.equal(analysis.provenance.mode, "openai");
  assert.equal(analysis.provenance.model, status.model);
  assert.ok(
    analysis.brief?.text,
    "A real conversation-specific AI summary is required.",
  );
  assert.ok(
    analysis.brief.evidence.length > 0 &&
      analysis.brief.evidence.every((e) =>
        analysis.messages
          .find((m) => m.id === e.messageId)
          ?.text.includes(e.quote),
      ),
    "Summary evidence must match input.",
  );
  for (const finding of analysis.findings)
    for (const evidence of finding.evidence) {
      assert.ok(
        analysis.messages
          .find((m) => m.id === evidence.messageId)
          ?.text.includes(evidence.quote),
        "Unsupported quotation escaped validation.",
      );
    }
  assert.equal(
    analysis.assessment.level,
    ["a", "ambiguous"].includes(sample.id) ? "insufficient" : "elevated",
  );
  if (sample.id === "unfamiliar")
    assert.ok(
      analysis.findings.some((f) => f.source === "model"),
      "Unfamiliar wording must produce contextual model extraction.",
    );
  console.log(
    JSON.stringify({
      case: sample.id,
      status: response.status,
      model: analysis.provenance.model,
      level: analysis.assessment.level,
      findings: analysis.findings.length,
      modelFindings: analysis.findings.filter((f) => f.source === "model")
        .length,
      rejected: analysis.provenance.rejectedFindings,
      evidenceReferencesValid: true,
      summaryCitationsValid: true,
    }),
  );
}
