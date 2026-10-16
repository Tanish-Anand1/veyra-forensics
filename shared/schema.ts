import { z } from "zod";
import { MAX_CHARS } from "./constants.js";
export { MAX_CHARS, MAX_MESSAGES } from "./constants.js";
export const kindSchema = z.enum([
  "identity",
  "trust",
  "urgency",
  "secrecy",
  "payment",
  "credentials",
  "documents",
  "destination",
  "inconsistency",
  "claim",
]);
export type SignalKind = z.infer<typeof kindSchema>;
export type Classification = "OBSERVED" | "INFERRED" | "VERIFIED" | "UNKNOWN";
export type Message = {
  id: string;
  sender: string;
  text: string;
  index: number;
};
export const extractionSchema = z.object({
  summary: z
    .object({
      text: z.string(),
      evidence: z.array(z.object({ messageId: z.string(), quote: z.string() })),
    })
    .nullable(),
  findings: z.array(
    z.object({
      kind: kindSchema,
      title: z.string(),
      explanation: z.string(),
      evidence: z.array(z.object({ messageId: z.string(), quote: z.string() })),
    }),
  ),
});
export type Extraction = Omit<z.infer<typeof extractionSchema>, "summary"> & {
  summary?: z.infer<typeof extractionSchema>["summary"];
};
export type Finding = Extraction["findings"][number] & {
  id: string;
  source: "rule" | "model";
  classification: "OBSERVED" | "INFERRED";
};
export type Destination = {
  id: string;
  raw: string;
  hostname: string;
  unicode: string;
  messageId: string;
  flags: string[];
};
export type GraphNode = {
  id: string;
  label: string;
  type: "message" | "identity" | "tactic" | "action" | "destination" | "claim";
  classification: Classification;
  messageIds: string[];
  findingId?: string;
  detail: string;
};
export type GraphEdge = { from: string; to: string; label: string };
export type Assessment = {
  level: "insufficient" | "review" | "elevated";
  label: string;
  summary: string;
};
export type Analysis = {
  imported?: import("./import.js").ImportMetadata;
  brief: Extraction["summary"];
  messages: Message[];
  findings: Finding[];
  destinations: Destination[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  assessment: Assessment;
  protectiveActions: { findingId: string; text: string }[];
  timeline: {
    messageId: string;
    findings: string[];
    level: Assessment["level"];
  }[];
  provenance: {
    mode: "local" | "openai";
    model: string | null;
    rejectedFindings: number;
    analyzedAt: string;
  };
};
export type Scenario =
  | "original"
  | "no-payment"
  | "identity-confirmed"
  | "domain-unrelated"
  | "destination-confirmed"
  | "urgency-excluded";
export const requestSchema = z
  .object({
    text: z.string().trim().min(8, "Add at least 8 characters.").max(MAX_CHARS),
    mode: z.enum(["local", "openai"]),
    consent: z.boolean().default(false),
  })
  .strict();
