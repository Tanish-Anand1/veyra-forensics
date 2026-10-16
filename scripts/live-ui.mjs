import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const dir = "artifacts/final-directive/live-ui";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await page.goto(base + "/analyze");
  await page.getByRole("radio", { name: "OpenAI + local checks" }).check();
  await page.getByRole("checkbox").check();
  const response = page.waitForResponse(
    (res) => res.url().endsWith("/api/analyze"),
    { timeout: 45000 },
  );
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  const res = await response;
  const analysis = await res.json();
  assert.equal(res.status(), 200, analysis.error);
  assert.equal(analysis.provenance.mode, "openai");
  await expect(page.locator(".conversation-brief")).toBeVisible();
  await page.screenshot({ path: `${dir}/ai-summary.png` });
  await page
    .getByRole("button", {
      name: "Inspect connection: Message 5 to Payment request. Quoted evidence.",
      exact: true,
    })
    .press("Enter");
  await expect(
    page.locator('.source-selected[data-message="m5"]'),
  ).toContainText("processing fee of $180");
  await expect(page.locator(".protective-action")).toContainText("Do not pay");
  await page.screenshot({ path: `${dir}/ai-connection.png` });
  const reports = [];
  for (const name of ["summary", "evidence", "timeline"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    reports.push(await page.getByRole("tabpanel").innerText());
  }
  assert.equal(new Set(reports).size, 3);
  await page.getByRole("slider").fill("4");
  await expect(
    page.getByRole("button", {
      name: /Inspect connection: Message 5 to Payment/,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".report-provenance")).toContainText(
    "PREFIX CHECKS",
  );
  const result = {
    url: base,
    model: analysis.provenance.model,
    mode: analysis.provenance.mode,
    status: res.status(),
    summary: true,
    sourceSelection: true,
    distinctReports: true,
    replayNoFutureEvidence: true,
    passed: true,
  };
  await writeFile(`${dir}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
