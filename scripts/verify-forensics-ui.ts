import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import type { Analysis } from "../shared/schema";
const origin = process.env.TEST_BASE_URL || "http://localhost:3005";
const text = [
  `17/10/2026, 11:10 - Archive coordinator: Residency application ${randomUUID().slice(0, 8)} has been accepted. Transfer a verification deposit to my personal wallet immediately to activate archive access.`,
  "17/10/2026, 11:11 - Applicant: I will call the public archive office using its published number.",
  "17/10/2026, 11:12 - Archive coordinator: Do not contact the office. Keep this shortlist secret. Send your account password and OTP here to validate your identity.",
  "17/10/2026, 11:13 - Applicant: A residency should not need my password or a personal transfer. I am stopping.",
].join("\n");
const browser = await chromium.launch();
const errors: string[] = [];
await mkdir("artifacts/forensics/release", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/investigate/import");
  await page.getByRole("button", { name: "Paste text", exact: true }).click();
  await page.getByLabel(/Paste the exported conversation/).fill(text);
  await page.getByRole("button", { name: /Reconstruct conversation/ }).click();
  await expect(page.locator(".message-review > li")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: /Investigate selected conversation/ }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /I reviewed the message text/ })
    .check();
  await page
    .getByRole("checkbox", {
      name: /authorized to share the selected messages/,
    })
    .check();
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/analyze"),
    { timeout: 45000 },
  );
  await page
    .getByRole("button", { name: /Investigate selected conversation/ })
    .click();
  const response = await pending;
  const report = (await response.json()) as Analysis;
  assert.equal(response.status(), 200);
  assert.equal(report.provenance.mode, "openai");
  assert.equal(report.provenance.model, "gpt-6-luna");
  for (const finding of report.findings)
    for (const evidence of finding.evidence)
      assert.ok(
        report.messages
          .find((m) => m.id === evidence.messageId)
          ?.text.includes(evidence.quote),
      );
  await expect(page.locator(".forensic-method")).toContainText("gpt-6-luna");
  const finding =
    report.findings.find(
      (f) => f.source === "model" && f.kind === "credentials",
    ) || report.findings.find((f) => f.source === "model");
  assert.ok(finding);
  await page.locator(`[data-node="${finding.id}"]`).press("Enter");
  await expect(page.locator(".node-inspector")).toContainText("EXACT SOURCE");
  await expect(page.locator(".node-inspector")).toContainText(
    finding.evidence[0].quote,
  );
  await expect(page.locator(".protective-action")).not.toBeEmpty();
  const geometry = await page.evaluate(() => ({
    graphTop: document
      .querySelector(".forensic-layout")!
      .getBoundingClientRect().top,
    panelTop: document
      .querySelector(".forensic-report")!
      .getBoundingClientRect().top,
    tabsTop: document.querySelector(".forensic-tabs")!.getBoundingClientRect()
      .top,
  }));
  assert.ok(geometry.graphTop < 460);
  assert.ok(Math.abs(geometry.tabsTop - geometry.panelTop) <= 2);
  await page.screenshot({
    path: "artifacts/forensics/release/evidence-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "timeline", exact: true }).click();
  await page.locator(".forensic-timeline button").nth(2).click();
  await expect(
    page.getByRole("tab", { name: "evidence", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-edge].is-selected")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "artifacts/forensics/release/evidence-mobile.png",
    fullPage: true,
  });
  await page.goto(origin + "/investigate/import");
  await page.screenshot({
    path: "artifacts/forensics/release/intake-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "artifacts/forensics/release/intake-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  const result = {
    origin,
    synthetic: true,
    model: report.provenance.model,
    quotedEvidenceValidated: true,
    graphSourceSelection: true,
    timelineSelectsRelationship: true,
    desktopMobile: true,
    geometry,
    pageErrors: errors,
    passed: true,
  };
  await writeFile(
    "artifacts/forensics/release/ui-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
