import test from "node:test";
import assert from "node:assert/strict";
import {
  assess,
  buildAnalysis,
  inspectDestinations,
  parseMessages,
  redact,
  validateExtraction,
} from "../shared/engine";
import { requestSchema } from "../shared/schema";
import { samples } from "../shared/samples";

test("ordinary exchange remains insufficient, with no fraud verdict", () => {
  const a = buildAnalysis(parseMessages(samples[0].text));
  assert.equal(a.assessment.level, "insufficient");
  assert.equal(
    a.findings.some((f) => f.kind === "payment"),
    false,
  );
});
test("scholarship progression requires actual consequential evidence", () => {
  const messages = parseMessages(samples[1].text);
  assert.equal(
    buildAnalysis(messages.slice(0, 4)).assessment.level,
    "insufficient",
  );
  const a = buildAnalysis(messages);
  assert.equal(a.assessment.level, "elevated");
  assert.ok(
    a.findings.some(
      (f) => f.kind === "inconsistency" && f.evidence.length === 2,
    ),
  );
  assert.equal(a.timeline[3].level, "insufficient");
  assert.equal(a.timeline[4].level, "elevated");
});
test("institutional case detects credentials, isolation and documents", () => {
  const a = buildAnalysis(parseMessages(samples[2].text));
  for (const kind of ["credentials", "secrecy", "documents", "urgency"])
    assert.ok(a.findings.some((f) => f.kind === kind));
  assert.equal(a.assessment.level, "elevated");
});
test("unfamiliar input computes real findings without samples", () => {
  const a = buildAnalysis(
    parseMessages(
      "Agent: Transfer money to release your package. Act immediately.\nCustomer: Can I verify this?",
    ),
  );
  assert.equal(a.assessment.level, "elevated");
  assert.equal(a.messages.length, 2);
});
test("explicit advice not to share or pay is not an action request", () => {
  const a = buildAnalysis(
    parseMessages(
      "Advisor: Never share your password. Do not pay a processing fee. Do not upload your passport.",
    ),
  );
  assert.equal(
    a.findings.some((f) =>
      ["payment", "credentials", "documents"].includes(f.kind),
    ),
    false,
  );
});
test("all graph edges, evidence and chronology have valid references", () => {
  for (const sample of samples) {
    const a = buildAnalysis(parseMessages(sample.text));
    const ids = new Set(a.nodes.map((n) => n.id));
    for (const edge of a.edges) {
      assert.ok(ids.has(edge.from));
      assert.ok(ids.has(edge.to));
    }
    for (const f of a.findings)
      for (const evidence of f.evidence)
        assert.ok(
          a.messages
            .find((m) => m.id === evidence.messageId)
            ?.text.includes(evidence.quote),
        );
    for (const t of a.timeline)
      for (const id of t.findings)
        assert.ok(a.findings.some((f) => f.id === id));
  }
});
test("model hallucinated quotes and IDs are discarded", () => {
  const messages = parseMessages("Sender: Please send your password.");
  const checked = validateExtraction(
    {
      findings: [
        {
          kind: "credentials",
          title: "Credential request",
          explanation: "A request.",
          evidence: [{ messageId: "m1", quote: "send your password" }],
        },
        {
          kind: "payment",
          title: "Fake quote",
          explanation: "Unsupported.",
          evidence: [{ messageId: "m1", quote: "pay me $50" }],
        },
        {
          kind: "urgency",
          title: "Fake ID",
          explanation: "Unsupported.",
          evidence: [{ messageId: "m99", quote: "send" }],
        },
        {
          kind: "claim",
          title: "Empty",
          explanation: "Unsupported.",
          evidence: [],
        },
      ],
    },
    messages,
  );
  assert.equal(checked.findings.length, 1);
  assert.equal(checked.rejected, 3);
});
test("counterfactual recalculates without mutating original evidence", () => {
  const a = buildAnalysis(
    parseMessages("Sender: Pay a processing fee of $50. Act immediately."),
  );
  const before = JSON.stringify(a);
  assert.equal(assess(a.findings).level, "elevated");
  assert.equal(assess(a.findings, "no-payment").level, "review");
  assert.equal(JSON.stringify(a), before);
  assert.equal(assess([], "domain-unrelated").level, "review");
});
test("standard URL parsing reveals real hostname and userinfo", () => {
  const d = inspectDestinations(
    parseMessages(
      "A: Use https://university.edu@203.0.113.7/path or https://university.edu.award.example/verify and https://аррӏе.example.",
    ),
  );
  assert.equal(d[0].hostname, "203.0.113.7");
  assert.ok(d[0].flags.some((f) => f.includes("user information")));
  assert.ok(d[0].flags.some((f) => f.includes("IP address")));
  assert.equal(d[1].hostname, "university.edu.award.example");
  assert.ok(d[1].flags.some((f) => f.includes("subdomain")));
  assert.ok(d[2].hostname.includes("xn--"));
});
test("redaction happens on the provided string", () => {
  const r = redact(
    "Email alex@example.com, phone 555-123-4567, SSN 123-45-6789, card 4111 1111 1111 1111",
  );
  assert.equal(r.count, 4);
  assert.ok(!r.text.includes("alex@"));
  assert.ok(r.text.includes("[REDACTED]"));
});
test("input boundaries and message cap reject excessive data", () => {
  assert.equal(
    requestSchema.safeParse({ text: "short", mode: "local" }).success,
    false,
  );
  assert.equal(
    requestSchema.safeParse({
      text: "x".repeat(18001),
      mode: "openai",
      consent: true,
    }).success,
    false,
  );
  assert.throws(
    () => parseMessages(Array(61).fill("Hello").join("\n")),
    /60 messages/,
  );
  assert.deepEqual(parseMessages("  \n"), []);
});
