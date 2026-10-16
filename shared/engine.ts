import { protectiveActions } from "./actions.js";
import { MAX_MESSAGES } from "./constants.js";
import type {
  Analysis,
  Assessment,
  Destination,
  Extraction,
  Finding,
  Message,
  Scenario,
  SignalKind,
} from "./schema";

export const kindLabels: Record<SignalKind, string> = {
  identity: "Claimed authority",
  trust: "Trust building",
  urgency: "Time pressure",
  secrecy: "Isolation & secrecy",
  payment: "Payment request",
  credentials: "Credential request",
  documents: "Sensitive information",
  destination: "Destination structure",
  inconsistency: "Conflicting statements",
  claim: "Unverified claim",
};

export function parseMessages(text: string): Message[] {
  const lines = text
    .trim()
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length > MAX_MESSAGES)
    throw new Error(
      `Use no more than ${MAX_MESSAGES} messages. Put each message on a new line.`,
    );
  return lines.map((line, index) => {
    const match = line.match(
      /^(?:\[([^\]]{1,40})\]\s*|([^:\n]{1,40}):\s+)([\s\S]+)$/,
    );
    return {
      id: `m${index + 1}`,
      sender: match ? (match[1] || match[2]).trim() : "Unattributed",
      text: match ? match[3] : line,
      index,
    };
  });
}

type Rule = { kind: SignalKind; pattern: RegExp; explanation: string };
const rules: Rule[] = [
  {
    kind: "identity",
    pattern:
      /\b(?:I (?:am|represent)|we (?:are|represent)|from (?:the )?(?:bank|university|government|registry)|(?:scholarship|admissions|security) (?:office|officer|department))\b/i,
    explanation:
      "The sender asserts an institutional identity. The assertion is visible; the identity has not been independently confirmed.",
  },
  {
    kind: "trust",
    pattern:
      /\b(?:congratulations|shortlisted|selected for|guaranteed (?:a |an )?(?:scholarship|award|return))\b/i,
    explanation:
      "Recognition or a promised benefit may establish trust. This language alone is not evidence of deception.",
  },
  {
    kind: "urgency",
    pattern:
      /\b(?:expires? (?:in|today)|\d+ minutes?|act (?:now|immediately)|final warning|suspended today|urgent(?:ly)?|deadline|within (?:an? hour|\d+ hours?))\b/i,
    explanation:
      "A deadline or time constraint is stated. Its legitimacy and official source have not been verified.",
  },
  {
    kind: "secrecy",
    pattern:
      /\b(?:keep (?:this|it) (?:confidential|secret)|do not (?:contact|tell)|don't (?:contact|tell)|between (?:us|you and me))\b/i,
    explanation:
      "The sender discourages disclosure or independent contact. This can limit opportunities to verify the request.",
  },
  {
    kind: "payment",
    pattern:
      /\b(?:pay\s+(?:a |the |an |me |us |\$|₹|£|€|\d)|(?:send|transfer|wire)\s+(?:money|funds|\$|₹|£|€|\d)|buy\s+(?:a |the )?gift cards?)\b/i,
    explanation:
      "A payment or transfer is requested. The purpose and recipient remain unverified.",
  },
  {
    kind: "credentials",
    pattern:
      /\b(?:send|share|give|enter|provide|confirm)\b[^.!?\n]{0,65}\b(?:password|one.time code|otp|verification code|login details|seed phrase)\b/i,
    explanation:
      "The message requests authentication material. Sharing it can enable account access.",
  },
  {
    kind: "documents",
    pattern:
      /\b(?:send|upload|provide|share|submit)\b[^.!?\n]{0,85}\b(?:passport|bank account|identity document|social security|credit card|national id|driving licen[cs]e)\b/i,
    explanation:
      "The message requests sensitive documents or financial information. The recipient and need require independent verification.",
  },
  {
    kind: "claim",
    pattern:
      /\b(?:guaranteed|you (?:have (?:won|been selected)|are (?:eligible|approved))|worth\s+[$₹£€]?\d+)\b/i,
    explanation:
      "The message makes a consequential claim that cannot be established from the conversation alone.",
  },
];

export function inspectDestinations(messages: Message[]): Destination[] {
  return messages.flatMap((message) => {
    const matches = message.text.match(/https?:\/\/[^\s<>"']+/gi) || [];
    return matches
      .map((raw, index) => {
        raw = raw.replace(/[),.;!?]+$/, "");
        try {
          const url = new URL(raw);
          const host = url.hostname;
          const flags: string[] = [];
          if (url.username || url.password)
            flags.push("Contains user information before the real hostname");
          if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":"))
            flags.push("IP address used as destination");
          if (host.includes("xn--"))
            flags.push(
              "Internationalized hostname: inspect the ASCII representation carefully",
            );
          if (/(?:^|\.)(?:edu|gov|ac|org|com)\.[^.]+\.[^.]+$/.test(host))
            flags.push(
              "Institution-like text appears in a subdomain; it does not establish ownership",
            );
          if (host.endsWith(".example") || host.endsWith(".invalid"))
            flags.push("Reserved example domain; not a live institution");
          if (url.protocol === "http:")
            flags.push("Unencrypted HTTP destination");
          return {
            id: `d-${message.id}-${index}`,
            raw,
            hostname: host,
            unicode: new URL(raw).hostname,
            messageId: message.id,
            flags,
          };
        } catch {
          return null;
        }
      })
      .filter((d): d is Destination => d !== null);
  });
}

export function localFindings(
  messages: Message[],
  destinations = inspectDestinations(messages),
): Finding[] {
  const findings: Finding[] = [];
  messages.forEach((message) =>
    rules.forEach((rule) => {
      const match = rule.pattern.exec(message.text);
      if (!match) return;

      const preceding = message.text.slice(
        Math.max(0, match.index - 22),
        match.index,
      );
      if (
        ["payment", "credentials", "documents"].includes(rule.kind) &&
        /\b(?:never|not|don't|do not|no need to)\s*$/i.test(preceding)
      )
        return;
      findings.push({
        id: `f${findings.length + 1}`,
        kind: rule.kind,
        title: kindLabels[rule.kind],
        explanation: rule.explanation,
        evidence: [{ messageId: message.id, quote: match[0] }],
        source: "rule",
        classification: "OBSERVED",
      });
    }),
  );
  destinations
    .filter((d) => d.flags.length)
    .forEach((d) =>
      findings.push({
        id: `f${findings.length + 1}`,
        kind: "destination",
        title: "Destination needs inspection",
        explanation: `Actual hostname: ${d.hostname}. ${d.flags.join(". ")}. No reputation lookup or website visit was performed.`,
        evidence: [{ messageId: d.messageId, quote: d.raw }],
        source: "rule",
        classification: "OBSERVED",
      }),
    );
  const noFee = messages.find((m) =>
    /\bno (?:processing )?fee\b/i.test(m.text),
  );
  const payment = findings.find((f) => {
    const m = messages.find((m) => m.id === f.evidence[0].messageId)!;
    return (
      f.kind === "payment" &&
      noFee &&
      m.index > noFee.index &&
      m.sender === noFee.sender
    );
  });
  if (noFee && payment)
    findings.push({
      id: `f${findings.length + 1}`,
      kind: "inconsistency",
      title: "The terms have changed",
      explanation:
        "An earlier no-fee statement is followed by a payment request. They may concern different services; clarify the apparent conflict independently.",
      evidence: [
        { messageId: noFee.id, quote: noFee.text },
        ...payment.evidence,
      ],
      source: "rule",
      classification: "INFERRED",
    });
  return findings;
}

export function assess(
  findings: Finding[],
  scenario: Scenario = "original",
): Assessment {
  const active = scenarioFindings(findings, scenario);
  const kinds = new Set(active.map((f) => f.kind));
  const sensitive = ["payment", "credentials", "documents"].some((k) =>
    kinds.has(k as SignalKind),
  );
  const pressure = ["urgency", "secrecy", "inconsistency"].some((k) =>
    kinds.has(k as SignalKind),
  );
  if ((sensitive && pressure) || (sensitive && scenario === "domain-unrelated"))
    return {
      level: "elevated",
      label: "Elevated concern",
      summary:
        "A consequential request occurs alongside pressure, conflicting statements, or an assumed unrelated destination. Pause and verify through an independent channel.",
    };
  if (sensitive || pressure || scenario === "domain-unrelated")
    return {
      level: "review",
      label: "Review before acting",
      summary:
        "Observable indicators need context and independent verification. These observations do not establish whether the sender is legitimate.",
    };
  return {
    level: "insufficient",
    label: "Insufficient evidence",
    summary:
      "No combination of high-consequence requests and pressure was found by the available checks. This is not a safety clearance; identity and intent remain unverified.",
  };
}

export function scenarioFindings(
  findings: Finding[],
  scenario: Scenario,
): Finding[] {
  if (scenario === "no-payment") {
    const paymentMessages = new Set(
      findings
        .filter((f) => f.kind === "payment")
        .flatMap((f) => f.evidence.map((e) => e.messageId)),
    );
    return findings.filter(
      (f) =>
        f.kind !== "payment" &&
        !(
          f.kind === "inconsistency" &&
          f.evidence.some((e) => paymentMessages.has(e.messageId))
        ),
    );
  }
  if (scenario === "identity-confirmed")
    return findings.filter((f) => f.kind !== "identity");
  if (scenario === "destination-confirmed")
    return findings.filter((f) => f.kind !== "destination");
  if (scenario === "urgency-excluded")
    return findings.filter((f) => f.kind !== "urgency");
  return findings;
}

export function validateExtraction(
  extraction: Extraction,
  messages: Message[],
) {
  let rejected = 0;
  const findings = extraction.findings
    .slice(0, 120)
    .filter((f) => {
      const valid =
        f.title.length <= 120 &&
        f.explanation.length <= 900 &&
        f.evidence.length > 0 &&
        f.evidence.length <= 5 &&
        f.evidence.every(
          (e) =>
            e.quote.trim().length >= 3 &&
            messages.some(
              (m) => m.id === e.messageId && m.text.includes(e.quote),
            ),
        );
      if (!valid) rejected++;
      return valid;
    })
    .map((f, i): Finding => ({
      ...f,
      title: f.title.replace(/\u2014/g, ":"),
      explanation: f.explanation.replace(/\u2014/g, ";"),
      id: `ai${i + 1}`,
      source: "model",
      classification: "INFERRED",
    }));
  return { findings, rejected };
}

export function buildAnalysis(
  messages: Message[],
  extra?: Extraction,
  model?: string,
): Analysis {
  const destinations = inspectDestinations(messages);
  const checked = extra
    ? validateExtraction(extra, messages)
    : { findings: [], rejected: 0 };
  const deterministic = localFindings(messages, destinations);
  const findings = [
    ...deterministic,
    ...checked.findings.filter(
      (f) =>
        !deterministic.some(
          (d) =>
            d.kind === f.kind &&
            d.evidence[0].messageId === f.evidence[0].messageId,
        ),
    ),
  ];
  const nodes: Analysis["nodes"] = messages.map((m) => ({
    id: m.id,
    type: "message",
    label: `Message ${m.index + 1}`,
    classification: "OBSERVED",
    messageIds: [m.id],
    detail: m.text,
  }));
  const edges: Analysis["edges"] = [];
  const senders = [...new Set(messages.map((m) => m.sender))];
  senders.forEach((sender, i) => {
    nodes.push({
      id: `sender${i}`,
      type: "identity",
      label: sender,
      classification: "UNKNOWN",
      messageIds: messages.filter((m) => m.sender === sender).map((m) => m.id),
      detail:
        "Sender label supplied in the input. Identity and institutional affiliation are not independently verified.",
    });
    messages
      .filter((m) => m.sender === sender)
      .forEach((m) =>
        edges.push({
          from: `sender${i}`,
          to: m.id,
          label: "Attributed in input",
        }),
      );
  });
  findings.forEach((f) => {
    nodes.push({
      id: f.id,
      type: ["payment", "credentials", "documents"].includes(f.kind)
        ? "action"
        : f.kind === "identity"
          ? "identity"
          : f.kind === "claim"
            ? "claim"
            : "tactic",
      label: f.title,
      classification: f.classification,
      messageIds: f.evidence.map((e) => e.messageId),
      findingId: f.id,
      detail: f.explanation,
    });
    f.evidence.forEach((e) =>
      edges.push({ from: e.messageId, to: f.id, label: "Quoted evidence" }),
    );
  });
  destinations.forEach((d) => {
    nodes.push({
      id: d.id,
      type: "destination",
      label: d.hostname,
      classification: "OBSERVED",
      messageIds: [d.messageId],
      detail: `Parsed destination. ${d.flags.join(". ")}. Not visited; ownership and reputation unknown.`,
    });
    edges.push({ from: d.messageId, to: d.id, label: "Contains URL" });
  });
  return {
    brief:
      extra?.summary &&
      extra.summary.text.length <= 900 &&
      extra.summary.evidence.length > 0 &&
      extra.summary.evidence.length <= 5 &&
      extra.summary.evidence.every(
        (e) =>
          e.quote.trim().length >= 3 &&
          messages.some(
            (m) => m.id === e.messageId && m.text.includes(e.quote),
          ),
      )
        ? { ...extra.summary, text: extra.summary.text.replace(/\u2014/g, ";") }
        : null,
    messages,
    findings,
    destinations,
    nodes,
    edges,
    assessment: assess(findings),
    protectiveActions: findings.map((f) => ({
      findingId: f.id,
      text: protectiveActions[f.kind],
    })),
    timeline: messages.map((m) => {
      const cumulative =
        m.index === messages.length - 1
          ? findings
          : localFindings(messages.slice(0, m.index + 1));
      return {
        messageId: m.id,
        findings: findings
          .filter(
            (f) =>
              (m.index === messages.length - 1 || f.source === "rule") &&
              f.evidence.every(
                (e) =>
                  messages.find((x) => x.id === e.messageId)!.index <= m.index,
              ) &&
              f.evidence.some((e) => e.messageId === m.id),
          )
          .map((f) => f.id),
        level: assess(cumulative).level,
      };
    }),
    provenance: {
      mode: model ? "openai" : "local",
      model: model || null,
      rejectedFindings: checked.rejected,
      analyzedAt: new Date().toISOString(),
    },
  };
}

export function redact(text: string) {
  let count = 0;
  const replace = () => {
    count++;
    return "[REDACTED]";
  };
  const value = text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replace)
    .replace(/\b(?:\d[ -]?){13,19}\b/g, replace)
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, replace)
    .replace(
      /(?:\+\d{1,3}[ .-]?)?(?:\(\d{3}\)|\b\d{3})[ .-]\d{3}[ .-]\d{4}\b/g,
      replace,
    );
  return { text: value, count };
}
