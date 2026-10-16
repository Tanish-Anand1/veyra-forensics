import { z } from "zod";
import { fingerprint, type ImportedMessage } from "./import.js";

export const screenshotExtractionSchema = z.object({
  messages: z.array(
    z.object({
      text: z.string(),
      speaker: z.string().nullable(),
      timestamp: z.string().nullable(),
      uncertainties: z.array(z.string()),
      region: z.array(z.number()),
    }),
  ),
  unreadableRegions: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type ScreenshotExtraction = z.infer<typeof screenshotExtractionSchema>;
export type ScreenshotReading = {
  id: string;
  name: string;
  extraction: ScreenshotExtraction;
};
const normalized = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
export function reconstructScreenshots(
  readings: ScreenshotReading[],
  merge = true,
) {
  const messages: ImportedMessage[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const reading of readings) {
    if (seen.has(reading.id)) {
      warnings.push(`Duplicate screenshot ${reading.name} was skipped.`);
      continue;
    }
    seen.add(reading.id);
    const extracted = reading.extraction.messages
      .filter((m) => m.text.trim())
      .map((message, index): ImportedMessage => ({
        id: `m-${fingerprint(`${reading.id}:${index}`)}`,
        sender: message.speaker?.trim().slice(0, 120) || "Unknown speaker",
        text: message.text,
        index: 0,
        timestamp: null,
        timestampLabel: message.timestamp,
        kind: "message",
        sources: [
          {
            sourceId: reading.id,
            name: reading.name,
            kind: "screenshot",
            imageId: reading.id,
            region: message.region as [number, number, number, number],
          },
        ],
        uncertainties: [
          ...message.uncertainties,
          ...(!message.speaker
            ? [
                "Apparent speaker is unknown; bubble color alone does not establish identity.",
              ]
            : []),
        ],
        reviewed: false,
      }));
    let overlap = 0;
    for (
      let count = Math.min(30, messages.length, extracted.length);
      count >= 1;
      count--
    ) {
      const previous = messages.slice(-count),
        incoming = extracted.slice(0, count);
      const match = previous.every(
        (m, i) =>
          normalized(m.text) === normalized(incoming[i].text) &&
          normalized(m.sender) === normalized(incoming[i].sender) &&
          (!m.timestampLabel ||
            !incoming[i].timestampLabel ||
            normalized(m.timestampLabel) ===
              normalized(incoming[i].timestampLabel)),
      );
      if (
        match &&
        (count >= 2 ||
          (previous[0].text.length >= 35 &&
            previous[0].timestampLabel &&
            incoming[0].timestampLabel))
      ) {
        overlap = count;
        break;
      }
    }
    if (overlap) {
      warnings.push(
        `Probable ${overlap}-message overlap in ${reading.name}: ${merge ? "merged with both image references preserved" : "kept separate for review"}. Verify the reconstruction.`,
      );
      if (merge)
        for (let i = 0; i < overlap; i++)
          messages[messages.length - overlap + i].sources.push(
            ...extracted[i].sources,
          );
    }
    messages.push(...extracted.slice(merge ? overlap : 0));
    warnings.push(
      ...reading.extraction.warnings.map((w) => `${reading.name}: ${w}`),
      ...reading.extraction.unreadableRegions.map(
        (w) => `${reading.name}: unreadable region: ${w}`,
      ),
    );
  }
  messages.forEach((m, i) => (m.index = i));
  return {
    messages,
    warnings: warnings.slice(0, 60),
    dateOrder: "auto" as const,
    sourceNames: readings.map((r) => r.name),
  };
}
