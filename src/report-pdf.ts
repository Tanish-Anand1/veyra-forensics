import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import regularURL from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url";
import boldURL from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url";
import wordmarkURL from "@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff?url";
import type { Analysis } from "../shared/schema";

export async function createReportPDF(
  report: Analysis,
  title = "Conversation investigation",
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(title);
  pdf.setAuthor("VEYRA");
  pdf.setSubject(
    "User-reviewed conversation evidence; indicators are not proof of fraud.",
  );
  const fonts = await Promise.all(
    [regularURL, boldURL, wordmarkURL].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          "Report fonts could not load. Please retry the export.",
        );
      return pdf.embedFont(await response.arrayBuffer(), { subset: true });
    }),
  );
  const [regular, bold, wordmark] = fonts;
  const width = 595.28,
    height = 841.89,
    margin = 46,
    content = width - margin * 2;
  let page = pdf.addPage([width, height]),
    y = height - 70,
    pageNumber = 1;
  const ink = rgb(0.1, 0.13, 0.13),
    muted = rgb(0.37, 0.41, 0.4),
    red = rgb(0.65, 0.18, 0.15);
  function decorate() {
    page.drawText("VEYRA", {
      x: margin,
      y: height - 34,
      size: 12,
      font: wordmark,
      color: ink,
    });
    page.drawText("Conversation forensics", {
      x: margin + 68,
      y: height - 34,
      size: 8,
      font: regular,
      color: muted,
    });
    page.drawLine({
      start: { x: margin, y: height - 44 },
      end: { x: width - margin, y: height - 44 },
      thickness: 0.6,
      color: muted,
    });
    page.drawText(`Evidence report / ${pageNumber}`, {
      x: margin,
      y: 28,
      size: 8,
      font: regular,
      color: muted,
    });
  }
  decorate();
  function ensure(lines = 1) {
    if (y - lines * 15 < 54) {
      page = pdf.addPage([width, height]);
      pageNumber++;
      y = height - 70;
      decorate();
    }
  }
  const canvas = document.createElement("canvas"),
    context = document.createElement("canvas").getContext("2d")!;
  async function paragraph(
    value: string,
    size = 10,
    strong = false,
    color = ink,
  ) {
    const font = strong ? bold : regular;
    context.font = `${strong ? "600" : "400"} ${size * 2}px "IBM Plex Sans", sans-serif`;
    const measure = (text: string) =>
      /[^\x20-\x7e]/.test(text)
        ? context.measureText(text).width / 2
        : font.widthOfTextAtSize(text, size);
    for (const raw of value.replace(/\t/g, "    ").split("\n")) {
      const words = [
        ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          raw,
        ),
      ].map((s) => s.segment);
      let line = "";
      const lines: string[] = [];
      for (const char of words) {
        if (line && measure(line + char) > content) {
          const split = line.lastIndexOf(" ");
          if (split > line.length * 0.5) {
            lines.push(line.slice(0, split));
            line = line.slice(split + 1) + char;
          } else {
            lines.push(line);
            line = char;
          }
        } else line += char;
      }
      lines.push(line);
      for (const text of lines) {
        ensure();
        if (/[^\x20-\x7e]/.test(text)) {
          canvas.width = Math.ceil(content * 3);
          canvas.height = Math.ceil(size * 5);
          const drawing = canvas.getContext("2d")!;
          drawing.fillStyle = "#ffffff";
          drawing.fillRect(0, 0, canvas.width, canvas.height);
          drawing.fillStyle = "#1a2121";
          drawing.font = `${strong ? "600" : "400"} ${size * 3}px "IBM Plex Sans", sans-serif`;
          drawing.textBaseline = "top";
          drawing.fillText(text, 0, size * 0.2);
          const image = await pdf.embedPng(canvas.toDataURL("image/png"));
          page.drawImage(image, {
            x: margin,
            y: y - size * 1.25,
            width: content,
            height: (size * 5) / 3,
          });
        } else page.drawText(text, { x: margin, y, size, font, color });
        y -= Math.max(15, size * 1.4);
      }
    }
    y -= 7;
  }
  await paragraph(title, 25, true);
  await paragraph("INDICATORS ARE NOT PROOF OF FRAUD", 9, true, red);
  await paragraph(
    `Analysis method: ${report.provenance.mode === "openai" ? report.provenance.model : "Local textual rules"}. Generated: ${report.provenance.analyzedAt}`,
  );
  if (report.imported) {
    await paragraph(
      `Coverage: ${report.messages.length} of ${report.imported.totalMessages} reconstructed messages. ${report.imported.segments} chronological segments.`,
      11,
      true,
    );
    await paragraph(report.imported.selection);
    if (report.messages.length < report.imported.totalMessages)
      await paragraph(
        "PARTIAL HISTORY: Conclusions apply only to the analyzed selection. Omitted messages may change interpretation.",
        10,
        true,
        red,
      );
  }
  await paragraph("Assessment", 15, true);
  await paragraph(report.assessment.label, 12, true);
  await paragraph(report.assessment.summary);
  const summaries =
    report.imported?.summaries.map((s) => ({
      label: `Segment ${s.segment}`,
      summary: s.summary,
    })) ?? (report.brief ? [{ label: "Summary", summary: report.brief }] : []);
  for (const { label, summary } of summaries) {
    await paragraph(label, 14, true);
    await paragraph(summary.text);
    await paragraph(
      "Sources: " + summary.evidence.map((e) => e.messageId).join(", "),
      8,
    );
  }
  ensure(5);
  await paragraph("Grounded indicators and protective actions", 15, true);
  if (!report.findings.length)
    await paragraph(
      "No grounded indicators were returned. This does not establish that a conversation is safe.",
    );
  for (const finding of report.findings) {
    ensure(4);
    await paragraph(`${finding.title} / ${finding.classification}`, 12, true);
    await paragraph(finding.explanation);
    for (const evidence of finding.evidence) {
      await paragraph(`Source ${evidence.messageId}`, 8, true);
      await paragraph('"' + evidence.quote + '"');
    }
    await paragraph(
      "Protective action: " +
        (report.protectiveActions.find((a) => a.findingId === finding.id)
          ?.text ||
          "Verify consequential claims through an independent trusted channel."),
    );
  }
  ensure(4);
  await paragraph("Uncertainties and interpretation limits", 15, true);
  await paragraph(
    "Speaker labels, timestamps, OCR text and user edits may be incorrect. No independent identity or website-reputation check was performed. Model interpretations are inferred, not verified facts. Review original sources before consequential decisions. Complex-script excerpts are visually rendered using browser fonts; the exact UTF-8 text is preserved in the attached evidence JSON.",
  );
  if (report.imported)
    for (const warning of report.imported.warnings) await paragraph(warning);
  ensure(6);
  await paragraph("Analyzed source messages", 15, true);
  for (const message of report.messages) {
    const source = report.imported?.sources[message.id];

    ensure(
      4 +
        (source?.sources.length ?? 0) * 2 +
        (source?.uncertainties.length ?? 0) * 2,
    );
    await paragraph(`${message.id} / ${message.sender}`, 10, true);
    if (source) {
      await paragraph(source.timestampLabel || "Timestamp not supplied", 8);
      for (const ref of source.sources)
        await paragraph(
          `${ref.name} / ${ref.kind === "text" ? `lines ${ref.firstLine}-${ref.lastLine}` : `image ${ref.imageId}; normalized region ${ref.region?.join(", ")}`}`,
          8,
        );
      for (const uncertainty of source.uncertainties)
        await paragraph("Uncertainty: " + uncertainty, 8);
    }
    await paragraph(message.text);
  }
  await pdf.attach(
    new TextEncoder().encode(JSON.stringify(report, null, 2)),
    "veyra-evidence.json",
    {
      mimeType: "application/json",
      description:
        "Exact UTF-8 reviewed messages, source references and evidence report. Original files are not retained.",
    },
  );
  return pdf.save();
}
export async function downloadReportPDF(report: Analysis, title?: string) {
  const bytes = await createReportPDF(report, title);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "veyra-investigation.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
