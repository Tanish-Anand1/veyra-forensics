import { readFile, writeFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
const task = getDocument({
  data: new Uint8Array(
    await readFile("artifacts/forensics/generated-report.pdf"),
  ),
  useSystemFonts: true,
});
const pdf = await task.promise;
const sheets = [];
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i),
    viewport = page.getViewport({ scale: 1.3 });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  await page.render({
    canvasContext: canvas.getContext("2d"),
    canvas,
    viewport,
  }).promise;
  const output = `artifacts/forensics/report-page-${i}.png`;
  await writeFile(output, canvas.toBuffer("image/png"));
  sheets.push(output);
}
console.log(JSON.stringify({ pages: pdf.numPages, rendered: sheets }));
await task.destroy();
