import { z } from "zod";
import type { Analysis, Message, Extraction } from "./schema.js";

export const IMPORT_LIMITS = {
  textBytes: 10_000_000,
  characters: 3_000_000,
  messages: 20_000,
  archiveBytes: 12_000_000,
  archiveExpandedBytes: 50_000_000,
  archiveEntries: 2000,
  screenshots: 8,
  imageBytes: 12_000_000,
  imagePixels: 16_000_000,
  selectedMessages: 180,
  selectedCharacters: 72_000,
  segmentMessages: 36,
  segmentCharacters: 14_000,
  segments: 6,
} as const;
export type DateOrder = "auto" | "DMY" | "MDY" | "YMD";
export type SourceRef = {
  sourceId: string;
  name: string;
  kind: "text" | "screenshot";
  firstLine?: number;
  lastLine?: number;
  imageId?: string;
  region?: [number, number, number, number];
};
export type ImportedMessage = Message & {
  timestamp: string | null;
  timestampLabel: string | null;
  kind: "message" | "system" | "media";
  sources: SourceRef[];
  uncertainties: string[];
  reviewed: boolean;
};
export type ImportDraft = {
  messages: ImportedMessage[];
  warnings: string[];
  dateOrder: DateOrder;
  sourceNames: string[];
};
export type SegmentSummary = {
  segment: number;
  summary: NonNullable<Extraction["summary"]>;
};
export type ImportMetadata = {
  version: 1;
  totalMessages: number;
  analyzedIds: string[];
  selection: string;
  sources: Record<
    string,
    {
      sources: SourceRef[];
      timestamp: string | null;
      timestampLabel: string | null;
      uncertainties: string[];
      kind: ImportedMessage["kind"];
    }
  >;
  warnings: string[];
  summaries: SegmentSummary[];
  segments: number;
};
export type ForensicReport = Analysis & { imported: ImportMetadata };

export function fingerprint(value: string) {
  let hash = 14695981039346656037n;
  for (const char of value) {
    hash ^= BigInt(char.codePointAt(0)!);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash.toString(16).padStart(16, "0");
}
function cleanDirection(value: string) {
  return value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
}
function digits(value: string) {
  return cleanDirection(value)
    .replace(/[٠-٩۰-۹०-९]/g, (c) =>
      String(c.charCodeAt(0) - (c >= "०" ? 0x966 : c >= "۰" ? 0x6f0 : 0x660)),
    )
    .replace(/[\u00a0\u202f]/g, " ");
}
const months = new Map<string, number>();
for (const locale of [
  "en",
  "fr",
  "es",
  "de",
  "pt",
  "it",
  "nl",
  "hi",
  "ar",
  "id",
  "tr",
]) {
  for (let month = 0; month < 12; month++)
    for (const style of ["short", "long"] as const) {
      const name = new Intl.DateTimeFormat(locale, {
        month: style,
        timeZone: "UTC",
      })
        .format(new Date(Date.UTC(2025, month, 10)))
        .toLocaleLowerCase()
        .replace(/\./g, "");
      months.set(name, month + 1);
    }
}
type Stamp = {
  raw: string;
  date: string;
  hour: number;
  minute: number;
  second: number;
};
function stamp(value: string): Stamp | null {
  const normalized = digits(value)
    .trim()
    .replace(
      /(上午|下午|पूर्वाह्न|अपराह्न)\s*(\d{1,2}:\d{2}(?::\d{2})?)/u,
      "$2 $1",
    );
  const match = normalized.match(
    /^(.*?)\s*,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|ص|م|पूर्वाह्न|अपराह्न|上午|下午)?$/iu,
  );
  if (!match || !/[0-9]/.test(match[1])) return null;
  let hour = Number(match[2]);
  const minute = Number(match[3]),
    second = Number(match[4] || 0);
  if (minute > 59 || second > 59 || hour > 23) return null;
  if (match[5]) {
    if (hour < 1 || hour > 12) return null;
    const pm = /^(p|م|अपराह्न|下午)/iu.test(match[5]);
    hour = (hour % 12) + (pm ? 12 : 0);
  }
  return {
    raw: cleanDirection(value).trim(),
    date: match[1].replace(/,\s*$/, "").trim(),
    hour,
    minute,
    second,
  };
}
function header(line: string) {
  const value = cleanDirection(line).replace(/^\ufeff/, "");
  const ios = value.match(/^\s*\[([^\]]{6,90})\]\s*(.*)$/u);
  if (ios) {
    const time = stamp(ios[1]);
    if (time) return { stamp: time, body: ios[2] };
  }
  const android = value.match(/^\s*(.{6,90}?)\s+-\s+(.*)$/u);
  if (android) {
    const time = stamp(android[1]);
    if (time) return { stamp: time, body: android[2] };
  }
  return null;
}
function numericDate(date: string) {
  const m = digits(date).match(/^(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})$/);
  return m
    ? [Number(m[1]), Number(m[2]), Number(m[3]), m[1].length, m[3].length]
    : null;
}
function normalizeDate(time: Stamp, order: DateOrder): string | null {
  const numeric = numericDate(time.date);
  let day: number, month: number, year: number;
  if (numeric) {
    const [a, b, c, lengthA] = numeric;
    if (lengthA === 4) {
      year = a;
      month = b;
      day = c;
    } else {
      if (order === "auto" || order === "YMD") return null;
      year = c;
      month = order === "MDY" ? a : b;
      day = order === "MDY" ? b : a;
    }
    if (year < 100) year += year >= 70 ? 1900 : 2000;
  } else {
    const parts = digits(time.date)
      .toLocaleLowerCase()
      .replace(/[,.]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const at = parts.findIndex((p) => months.has(p));
    if (at < 0 || parts.length !== 3) return null;
    month = months.get(parts[at])!;
    const numbers = parts.filter((_, i) => i !== at).map(Number);
    if (numbers.some((n) => !Number.isFinite(n))) return null;
    [day, year] = numbers;
    if (year < 100) year += year >= 70 ? 1900 : 2000;
  }
  if (
    year < 1970 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCDate() !== day || check.getUTCMonth() !== month - 1)
    return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:${String(time.second).padStart(2, "0")}`;
}
function mediaPlaceholder(text: string) {
  return /(?:<[^>]*(?:omitted|adjunto|multim[eé]dia)[^>]*>|\(file attached\)|image omitted|video omitted|sticker omitted|audio omitted|media omitted|<attached:)/iu.test(
    text,
  );
}

export function parseConversation(
  input: string,
  name = "Pasted conversation",
  requested: DateOrder = "auto",
): ImportDraft {
  if (!input.trim()) throw new Error("This conversation is empty.");
  if (input.includes("\u0000"))
    throw new Error(
      "This file contains binary null bytes. Export a fresh UTF-8 text conversation.",
    );
  if (input.length > IMPORT_LIMITS.characters)
    throw new Error("Use a text export with at most 3 million characters.");
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const headers = lines.map(header);
  const warnings: string[] = [];
  let order = requested;
  if (order === "auto") {
    const votes = new Set<string>();
    for (const entry of headers) {
      if (!entry) continue;
      const n = numericDate(entry.stamp.date);
      if (!n) continue;
      if (n[3] === 4) votes.add("YMD");
      else if (n[0] > 12) votes.add("DMY");
      else if (n[1] > 12) votes.add("MDY");
    }
    if (votes.size === 1) order = [...votes][0] as DateOrder;
    else if (votes.size > 1)
      warnings.push(
        "Mixed date conventions were detected. Verify timestamps and choose the appropriate date order.",
      );
  }
  const sourceId = `src-${fingerprint(input)}`;
  const messages: ImportedMessage[] = [];
  let ambiguousDates = 0,
    unrecognizedDates = 0,
    preamble = 0,
    colonWarnings = 0;
  const hasHeaders = headers.some(Boolean);
  for (let line = 0; line < lines.length; line++) {
    const found = headers[line];
    if (found) {
      const split = found.body.indexOf(": ");
      const sender = split >= 0 ? found.body.slice(0, split) : "System";
      const text = split >= 0 ? found.body.slice(split + 2) : found.body;
      const uncertain: string[] = [];
      if (split >= 0 && text.slice(0, 80).includes(": ")) {
        uncertain.push("Multiple colon separators; verify the sender label.");
        colonWarnings++;
      }
      const timestamp = normalizeDate(found.stamp, order);
      if (!timestamp) {
        const n = numericDate(found.stamp.date);
        if (n && order === "auto") ambiguousDates++;
        else unrecognizedDates++;
        uncertain.push(
          "Date or date order is uncertain; original timestamp preserved.",
        );
      }
      messages.push({
        id: `m-${fingerprint(`${sourceId}:${line}`)}`,
        sender: sender || "Unknown speaker",
        text,
        index: messages.length,
        timestamp,
        timestampLabel: found.stamp.raw,
        kind:
          split < 0 ? "system" : mediaPlaceholder(text) ? "media" : "message",
        sources: [
          {
            sourceId,
            name,
            kind: "text",
            firstLine: line + 1,
            lastLine: line + 1,
          },
        ],
        uncertainties: uncertain,
        reviewed: false,
      });
    } else if (hasHeaders && messages.length) {
      const last = messages[messages.length - 1];
      last.text += "\n" + lines[line];
      last.sources[0].lastLine = line + 1;
      if (
        /^\s*\[?\d{1,4}[/.-]\d/.test(digits(lines[line])) &&
        last.uncertainties.length < 19
      )
        last.uncertainties.push(
          `Possible unrecognized timestamp at source line ${line + 1}; review the message boundary.`,
        );
    } else if (hasHeaders && lines[line].trim()) preamble++;
    else if (!hasHeaders) {
      const m = lines[line].match(/^([^:\n]{1,120}):\s+(.*)$/u);
      if (m || (!messages.length && lines[line].trim())) {
        messages.push({
          id: `m-${fingerprint(`${sourceId}:${line}`)}`,
          sender: m?.[1] || "Unknown speaker",
          text: m?.[2] ?? lines[line],
          index: messages.length,
          timestamp: null,
          timestampLabel: null,
          kind: "message",
          sources: [
            {
              sourceId,
              name,
              kind: "text",
              firstLine: line + 1,
              lastLine: line + 1,
            },
          ],
          uncertainties: m ? [] : ["No explicit speaker label."],
          reviewed: false,
        });
      } else if (messages.length) {
        const last = messages.at(-1)!;
        last.text += "\n" + lines[line];
        last.sources[0].lastLine = line + 1;
      }
    }
    if (messages.length > IMPORT_LIMITS.messages)
      throw new Error(
        "This export exceeds 20,000 messages. Export a shorter date range.",
      );
  }
  for (const message of messages) {
    message.text = message.text.replace(/\n+$/, "");
    if (message.text.length > 8000)
      message.uncertainties.push(
        "Long message: shorten it in review before including it in AI analysis.",
      );
  }
  if (preamble)
    warnings.push(
      `${preamble} non-message line(s) precede the first recognized timestamp. A source-note preview below retains at most 1,000 characters; inspect the original export for the rest.`,
    );
  if (preamble)
    warnings.push(
      `Source preamble: ${lines.slice(0, headers.findIndex(Boolean)).join("\n").slice(0, 1000)}`,
    );
  if (ambiguousDates)
    warnings.push(
      `${ambiguousDates} ambiguous numeric date(s). Choose day/month/year or month/day/year; no timezone is assumed.`,
    );
  if (unrecognizedDates)
    warnings.push(
      `${unrecognizedDates} timestamp(s) could not be normalized. Original timestamps remain visible.`,
    );
  if (colonWarnings)
    warnings.push(
      `${colonWarnings} message(s) need sender-boundary review because they contain multiple colon separators.`,
    );
  if (!hasHeaders)
    warnings.push(
      "No WhatsApp timestamp headers detected. Explicit speaker labels and multiline continuation were used; review all boundaries.",
    );
  for (let i = 1; i < messages.length; i++)
    if (
      messages[i].timestamp &&
      messages[i - 1].timestamp &&
      messages[i].timestamp! < messages[i - 1].timestamp!
    ) {
      warnings.push(
        "Some timestamps move backwards. File order was preserved; check date order and any forwarded or merged exports.",
      );
      break;
    }
  if (!messages.length)
    throw new Error("No conversation messages could be reconstructed.");
  return { messages, warnings, dateOrder: order, sourceNames: [name] };
}

export const baseMessageSchema = z
  .object({
    id: z.string().regex(/^m-[a-f0-9]{16}$/),
    sender: z.string().min(1).max(120),
    text: z.string().min(1).max(8000),
    index: z.number().int().min(0).max(20_000),
  })
  .strict();
export const sourceSchema = z.object({
  sourceId: z.string().max(80),
  name: z.string().max(500),
  kind: z.enum(["text", "screenshot"]),
  firstLine: z.number().int().positive().optional(),
  lastLine: z.number().int().positive().optional(),
  imageId: z.string().max(80).optional(),
  region: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export const importMetadataSchema = z.object({
  version: z.literal(1),
  totalMessages: z.number().int().positive().max(20_000),
  analyzedIds: z.array(z.string()).max(180),
  selection: z.string().max(400),
  sources: z.record(
    z.string(),
    z.object({
      sources: z.array(sourceSchema).max(8),
      timestamp: z.string().max(40).nullable(),
      timestampLabel: z.string().max(100).nullable(),
      uncertainties: z.array(z.string().max(500)).max(20),
      kind: z.enum(["message", "system", "media"]),
    }),
  ),
  warnings: z.array(z.string().max(1500)).max(60),
  summaries: z
    .array(
      z.object({
        segment: z.number().int().positive(),
        summary: z.object({
          text: z.string().max(900),
          evidence: z
            .array(
              z.object({ messageId: z.string(), quote: z.string().max(8000) }),
            )
            .max(5),
        }),
      }),
    )
    .max(6),
  segments: z.number().int().min(1).max(6),
});
