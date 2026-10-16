import {
  IMPORT_LIMITS,
  type ImportedMessage,
  type ImportMetadata,
  type ForensicReport,
  type SegmentSummary,
} from "./import.js";
import { buildAnalysis } from "./engine.js";
import type { Extraction, Analysis, Message } from "./schema.js";

export type AnalysisSegment = {
  index: number;
  messages: Message[];
  newIds: string[];
};
const cues =
  /(?:\b(?:pay|payment|fee|deposit|transfer|bank|wallet|crypto|password|passcode|otp|credential|verify|urgent|immediately|deadline|secret|confidential|refund|investment|guaranteed|scholarship|official)\b|[₹$€£]|भुगतान|पैसे|पासवर्ड|तुरंत|गुप्त|pago|contraseña|urgente|virement|mot de passe|senha|pix|付款|密码|立即|轉帳|دفع|كلمة المرور)/iu;
export function selectMessages(
  all: ImportedMessage[],
  mode: "relevant" | "range" | "all",
  range: [number, number] = [1, 180],
) {
  const candidates = new Set<number>();
  if (mode === "range")
    for (
      let i = Math.max(0, range[0] - 1);
      i < Math.min(all.length, range[1]);
      i++
    )
      candidates.add(i);
  else if (mode === "all" || all.length <= IMPORT_LIMITS.selectedMessages)
    all.forEach((_, i) => candidates.add(i));
  else {
    for (let i = 0; i < Math.min(4, all.length); i++) candidates.add(i);
    for (let i = 0; i < all.length; i++)
      if (cues.test(all[i].text))
        for (
          let j = Math.max(0, i - 2);
          j <= Math.min(all.length - 1, i + 2);
          j++
        )
          candidates.add(j);
    for (let i = Math.max(0, all.length - 4); i < all.length; i++)
      candidates.add(i);
    if (candidates.size <= 8)
      for (
        let i = 0;
        i < all.length;
        i += Math.max(1, Math.floor(all.length / 32))
      )
        for (let j = i; j < Math.min(i + 3, all.length); j++) candidates.add(j);
  }
  let indices = [...candidates].sort((a, b) => a - b);

  if (indices.length > 180) {
    const groups: number[][] = [];
    for (let i = 0; i < indices.length; i += 5)
      groups.push(indices.slice(i, i + 5));
    const chosen = new Set<number>();
    for (let i = 0; i < Math.min(36, groups.length); i++)
      for (const at of groups[
        Math.floor(
          (i * (groups.length - 1)) /
            Math.max(1, Math.min(36, groups.length) - 1),
        )
      ])
        chosen.add(at);
    indices = [...chosen].sort((a, b) => a - b);
  }
  let characters = 0;
  const messages = indices
    .map((i) => all[i])
    .filter((m) => {
      if (
        !m.text.trim() ||
        !m.sender.trim() ||
        m.text.length > 8000 ||
        m.sender.length > 120 ||
        characters + m.text.length > IMPORT_LIMITS.selectedCharacters
      )
        return false;
      characters += m.text.length;
      return true;
    });
  const segments: AnalysisSegment[] = [];
  let cursor = 0;
  while (cursor < messages.length && segments.length < IMPORT_LIMITS.segments) {
    const context = [
      ...messages.slice(0, Math.min(2, cursor)),
      ...messages.slice(Math.max(2, cursor - 2), cursor),
    ];
    const unique = [...new Map(context.map((m) => [m.id, m])).values()];
    let size = unique.reduce((s, m) => s + m.text.length, 0);
    const next: ImportedMessage[] = [];
    while (
      cursor < messages.length &&
      unique.length + next.length < IMPORT_LIMITS.segmentMessages &&
      size + messages[cursor].text.length <= IMPORT_LIMITS.segmentCharacters
    ) {
      const m = messages[cursor++];
      next.push(m);
      size += m.text.length;
    }
    if (!next.length) {
      unique.length = 0;
      next.push(messages[cursor++]);
    }
    segments.push({
      index: segments.length,
      messages: [...unique, ...next].map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        index: m.index,
      })),
      newIds: next.map((m) => m.id),
    });
  }
  const used = new Set(segments.flatMap((s) => s.newIds));
  const selected = messages.filter((m) => used.has(m.id));
  const partial = selected.length < all.length;
  const description =
    mode === "relevant" && all.length > 180
      ? "Deterministic keyword windows with nearby context and distributed coverage; this can miss relevant messages, particularly unsupported languages."
      : mode === "range"
        ? `User-selected source messages ${range[0]}–${range[1]}, subject to the disclosed message and character budgets.`
        : "Chronological source messages, subject to the disclosed message and character budgets.";
  return {
    messages: selected,
    segments,
    characters: selected.reduce((s, m) => s + m.text.length, 0),
    partial,
    description,
    excluded: all.length - selected.length,
  };
}

export function aggregateReport(
  selected: ImportedMessage[],
  results: Analysis[],
  totalMessages: number,
  selection: string,
  warnings: string[],
): ForensicReport {
  const summaries: SegmentSummary[] = [];
  const findings: Extraction["findings"] = [];
  const seen = new Set<string>();
  results.forEach((result, index) => {
    if (result.brief)
      summaries.push({ segment: index + 1, summary: result.brief });
    for (const f of result.findings.filter((f) => f.source === "model")) {
      const key = f.kind + JSON.stringify(f.evidence);
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        kind: f.kind,
        title: f.title,
        explanation: f.explanation,
        evidence: f.evidence,
      });
    }
  });
  const normalized = selected.map((m, index) => ({
    id: m.id,
    sender: m.sender,
    text: m.text,
    index,
  }));
  const report = buildAnalysis(
    normalized,
    { summary: results.length === 1 ? results[0].brief : null, findings },
    results[0]?.provenance.model ?? undefined,
  );
  const imported: ImportMetadata = {
    version: 1,
    totalMessages,
    analyzedIds: normalized.map((m) => m.id),
    selection,
    sources: Object.fromEntries(
      selected.map((m) => [
        m.id,
        {
          sources: m.sources,
          timestamp: m.timestamp,
          timestampLabel: m.timestampLabel,
          uncertainties: m.uncertainties,
          kind: m.kind,
        },
      ]),
    ),
    warnings: warnings.slice(0, 60),
    summaries,
    segments: Math.max(1, results.length),
  };
  return { ...report, imported };
}
