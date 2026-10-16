import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnalysis, parseMessages, assess } from "../shared/engine";
import { samples } from "../shared/samples";
import {
  edgeId,
  inspectSelection,
  throughMessage,
  isAnalysis,
} from "../src/evidence";

test("a full-context model inference quoting an early message cannot leak into replay", () => {
  const messages = parseMessages(
    "Advisor: We can discuss the offer.\nAdvisor: Transfer money now. Act immediately.",
  );
  const full = buildAnalysis(
    messages,
    {
      findings: [
        {
          kind: "claim",
          title: "Full-context inference",
          explanation:
            "A later demand changes the interpretation of the opening.",
          evidence: [{ messageId: "m1", quote: "discuss the offer" }],
        },
      ],
    },
    "test-model",
  );
  assert.ok(full.findings.some((f) => f.source === "model"));
  const first = throughMessage(full, 1);
  assert.deepEqual(
    first.findings,
    buildAnalysis(messages.slice(0, 1)).findings,
  );
  assert.equal(first.provenance.mode, "local");
  assert.equal(first.brief, null);
  assert.equal(throughMessage(full, 1), first);
  assert.equal(throughMessage(full, 2), full);
});

test("summary quotations are validated and malformed results fail closed", () => {
  const messages = parseMessages("Sender: Let us meet at noon.");
  const full = buildAnalysis(
    messages,
    {
      findings: [],
      summary: {
        text: "A meeting is proposed.",
        evidence: [{ messageId: "m1", quote: "meet at noon" }],
      },
    },
    "test-model",
  );
  assert.ok(isAnalysis(full));
  assert.equal(full.brief?.text, "A meeting is proposed.");
  assert.equal(
    buildAnalysis(messages, {
      findings: [],
      summary: {
        text: "Invented",
        evidence: [{ messageId: "m1", quote: "pay a fee" }],
      },
    }).brief,
    null,
  );
  assert.equal(
    isAnalysis({ ...full, edges: [{ from: "missing", to: "m1" }] }),
    false,
  );
  assert.equal(isAnalysis({ messages: [], findings: [] }), false);
});

test("excluding urgency changes an unfamiliar financial request without mutating evidence", () => {
  const full = buildAnalysis(
    parseMessages("Seller: Pay the deposit. Act immediately."),
  );
  const before = JSON.stringify(full);
  assert.equal(assess(full.findings, "urgency-excluded").level, "review");
  assert.equal(assess(full.findings).level, "elevated");
  assert.equal(JSON.stringify(full), before);
});

test("replay never exposes findings or actions supported by future messages", () => {
  const full = buildAnalysis(parseMessages(samples[1].text));
  const original = JSON.stringify(full);
  for (let step = 1; step <= full.messages.length; step++) {
    const partial = throughMessage(full, step);
    const ids = new Set(partial.messages.map((m) => m.id));
    const nodes = new Set(partial.nodes.map((n) => n.id));
    assert.ok(
      partial.findings.every((f) =>
        f.evidence.every((e) => ids.has(e.messageId)),
      ),
    );
    assert.ok(partial.edges.every((e) => nodes.has(e.from) && nodes.has(e.to)));
    assert.ok(
      partial.protectiveActions.every((a) =>
        partial.findings.some((f) => f.id === a.findingId),
      ),
    );
    if (step < 5)
      assert.ok(!partial.findings.some((f) => f.kind === "inconsistency"));
  }
  assert.equal(JSON.stringify(full), original);
});

test("selecting an unfamiliar payment edge resolves its source and protective action", () => {
  const full = buildAnalysis(
    parseMessages(
      "Dispatcher: Transfer money to release the parcel. Act immediately.\nRecipient: Please confirm the tracking number.",
    ),
  );
  const finding = full.findings.find((f) => f.kind === "payment")!;
  const edge = full.edges.find((e) => e.to === finding.id)!;
  const detail = inspectSelection(full, edgeId(edge))!;
  assert.deepEqual(detail.messageIds, ["m1"]);
  assert.equal(detail.node.id, finding.id);
  assert.ok(full.messages[0].text.includes(detail.quotes[0].quote));
  assert.match(detail.action, /Do not pay/);
  assert.equal(
    full.protectiveActions.find((a) => a.findingId === finding.id)?.text,
    detail.action,
  );
  assert.equal(inspectSelection(full, "edge:missing:unknown"), null);
});

test("a contradictory connection retains both exact source messages", () => {
  const full = buildAnalysis(parseMessages(samples[1].text));
  const finding = full.findings.find((f) => f.kind === "inconsistency")!;
  const detail = inspectSelection(
    full,
    edgeId(full.edges.find((e) => e.to === finding.id)!),
  )!;
  assert.deepEqual(new Set(detail.messageIds), new Set(["m3", "m5"]));
  assert.equal(detail.quotes.length, 2);
  assert.match(detail.action, /reconcile both statements/);
});
