import { zipSync, strToU8 } from "fflate";
import type { ScreenshotReading } from "../shared/screenshots";
export function androidExport(count = 8) {
  return Array.from({ length: count }, (_, i) => {
    const text =
      i === 2
        ? "Please transfer a processing fee of ₹850 today. Email accounts@example.test."
        : i === 3
          ? "Why is a fee necessary?\nCan I verify this independently?"
          : i === 4
            ? "Keep this confidential. Send your OTP immediately."
            : `Generated conversation message ${i + 1}: café, नमस्ते 🌿.`;
    return `16/10/2026, 10:${String(i % 60).padStart(2, "0")} - ${i % 2 ? "Mira (you)" : "Alex, Operations"}: ${text}`;
  }).join("\n");
}
export const iosExport = () =>
  [
    "[10/16/26, 9:04:10 PM] N. Rao: Hello 👋",
    "This stays in the same message.",
    "[10/16/26, 9:05:12 PM] The group name was changed",
    "[10/16/26, 9:06:12 PM] N. Rao: <Media omitted>",
  ].join("\n");
export function chatZip(text = androidExport()) {
  return zipSync({
    "WhatsApp/_chat.txt": strToU8(text),
    "WhatsApp/photo.jpg": new Uint8Array([1, 2, 3]),
  });
}
export function screenshotReading(
  id: number,
  texts: string[],
  speaker: string | null = "Visible participant",
): ScreenshotReading {
  return {
    id: `img-${String(id).padStart(16, "0")}`,
    name: `generated-${id}.png`,
    extraction: {
      messages: texts.map((text, i) => ({
        text,
        speaker,
        timestamp: `10:${String(i).padStart(2, "0")}`,
        uncertainties: speaker ? [] : ["Speaker not visible."],
        region: [0.1, i / 10, 0.8, 0.08],
      })),
      unreadableRegions: [],
      warnings: [],
    },
  };
}
