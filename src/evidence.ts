import type { Analysis, GraphEdge } from "../shared/schema";
import { protectiveActions } from "../shared/actions";
import { buildAnalysis } from "../shared/engine";

export const edgeId = (edge: GraphEdge) => `edge:${edge.from}:${edge.to}`;

export function inspectSelection(analysis: Analysis, selected: string | null) {
  if (!selected) return null;
  const edge = analysis.edges.find((e) => edgeId(e) === selected);
  const node = analysis.nodes.find((n) => n.id === (edge?.to ?? selected));
  if (!node) return null;
  const finding = analysis.findings.find((f) => f.id === node.findingId);
  const messageIds =
    edge && !finding
      ? [edge.from, edge.to].filter((id) =>
          analysis.messages.some((m) => m.id === id),
        )
      : node.messageIds;
  return {
    node,
    edge,
    finding,
    messageIds,
    quotes:
      finding?.evidence ??
      analysis.messages
        .filter((m) => messageIds.includes(m.id))
        .map((m) => ({ messageId: m.id, quote: m.text })),
    action:
      protectiveActions[
        finding?.kind ??
          (node.type === "destination" ? "destination" : "identity")
      ],
  };
}

const replayCache = new WeakMap<Analysis, Map<number, Analysis>>();

export function throughMessage(analysis: Analysis, step: number): Analysis {
  const end = Math.max(1, Math.min(step, analysis.messages.length));
  if (end === analysis.messages.length) return analysis;
  let cache = replayCache.get(analysis);
  if (!cache) replayCache.set(analysis, (cache = new Map()));
  if (cache.has(end)) return cache.get(end)!;
  const prefix = buildAnalysis(analysis.messages.slice(0, end));
  const ids = new Map(
    prefix.findings.map((finding) => [
      finding.id,
      analysis.findings.find(
        (original) =>
          original.source === "rule" &&
          original.kind === finding.kind &&
          JSON.stringify(original.evidence) ===
            JSON.stringify(finding.evidence),
      )?.id ?? finding.id,
    ]),
  );
  const id = (value: string) => ids.get(value) ?? value;
  const result: Analysis = {
    ...prefix,
    findings: prefix.findings.map((finding) => ({
      ...finding,
      id: id(finding.id),
    })),
    nodes: prefix.nodes.map((node) => ({
      ...node,
      id: id(node.id),
      ...(node.findingId ? { findingId: id(node.findingId) } : {}),
    })),
    edges: prefix.edges.map((edge) => ({
      ...edge,
      from: id(edge.from),
      to: id(edge.to),
    })),
    protectiveActions: prefix.protectiveActions.map((action) => ({
      ...action,
      findingId: id(action.findingId),
    })),
    timeline: prefix.timeline.map((point) => ({
      ...point,
      findings: point.findings.map(id),
    })),
  };
  cache.set(end, result);
  return result;
}

export function isAnalysis(value: unknown): value is Analysis {
  if (!value || typeof value !== "object") return false;
  const record = value as Analysis;
  try {
    if (
      !Array.isArray(record.messages) ||
      !record.messages.length ||
      !Array.isArray(record.findings) ||
      !Array.isArray(record.nodes) ||
      !Array.isArray(record.edges) ||
      !Array.isArray(record.timeline) ||
      !Array.isArray(record.destinations) ||
      !Array.isArray(record.protectiveActions) ||
      !["local", "openai"].includes(record.provenance.mode) ||
      !["insufficient", "review", "elevated"].includes(record.assessment.level)
    )
      return false;
    const messages = new Map(record.messages.map((m) => [m.id, m.text]));
    const nodes = new Set(record.nodes.map((n) => n.id));
    return (
      record.messages.every(
        (m) => typeof m.text === "string" && typeof m.sender === "string",
      ) &&
      record.findings.every(
        (f) =>
          typeof f.title === "string" &&
          typeof f.explanation === "string" &&
          f.evidence.length > 0 &&
          f.evidence.every(
            (e) =>
              Boolean(e.quote) && messages.get(e.messageId)?.includes(e.quote),
          ),
      ) &&
      record.nodes.every(
        (n) =>
          typeof n.label === "string" &&
          n.messageIds.every((m) => messages.has(m)),
      ) &&
      record.edges.every((e) => nodes.has(e.from) && nodes.has(e.to))
    );
  } catch {
    return false;
  }
}
