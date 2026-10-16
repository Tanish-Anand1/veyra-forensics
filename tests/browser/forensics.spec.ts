import { test, expect } from "@playwright/test";
import { expectView } from "./expect-view";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { authFixture } from "../auth-fixture";
import {
  androidExport,
  iosExport,
  chatZip,
  screenshotReading,
} from "../forensics-fixtures";
import { buildAnalysis } from "../../shared/engine";
import type { SegmentInput, VisionInput } from "../../server/import-ai";
import { ImportError } from "../../server/import-ai";

let fixture: Awaited<ReturnType<typeof authFixture>>;
let calls: SegmentInput[],
  visionCalls: VisionInput[],
  fail: boolean,
  unreadable: boolean;
test.beforeEach(async ({ page }) => {
  calls = [];
  visionCalls = [];
  fail = false;
  unreadable = false;
  fixture = await authFixture({
    async analyze(input) {
      calls.push(input);
      if (fail) {
        fail = false;
        throw new ImportError(502, "Generated provider failure; retry safely.");
      }
      return buildAnalysis(input.messages.map((m, index) => ({ ...m, index })));
    },
    async readScreenshot(input) {
      visionCalls.push(input);
      const reading = screenshotReading(
        visionCalls.length,
        unreadable
          ? []
          : visionCalls.length === 1
            ? [
                "Hello",
                "Send a processing fee today",
                "Please keep this secret",
              ]
            : [
                "Send a processing fee today",
                "Please keep this secret",
                "I will verify independently",
              ],
        null,
      );
      reading.extraction.messages.forEach((m) => {
        m.timestamp = null;
      });
      if (unreadable)
        reading.extraction.unreadableRegions = ["Generated blurred image"];
      return reading.extraction;
    },
  });
  await page.route("**/api/import/status", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), configured: true },
    });
  });
});
test.afterEach(async () => {
  await fixture?.close();
});

test("generated Android ZIP: review, correct, redact, investigate and trace graph evidence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(fixture.origin + "/investigate/import");
  await page.getByLabel("Choose conversation source files").setInputFiles({
    name: "generated-export.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(chatZip()),
  });
  await expect(page.locator(".message-review > li")).toHaveCount(8);
  expect(calls).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: /Investigate selected conversation/ }),
  ).toBeDisabled();
  await expect(page.getByLabel("Message text").nth(3)).toHaveValue(
    /verify this independently/,
  );
  await page
    .getByLabel("Speaker", { exact: true })
    .first()
    .fill("Reviewed participant");
  await page
    .getByLabel("Message text")
    .first()
    .fill("Reviewed greeting: नमस्ते 🌿.");
  await page
    .getByRole("button", { name: "Move later ↓: message 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove message 8", exact: true })
    .click();
  await page.getByRole("button", { name: /Preview local redaction/ }).click();
  await expect(page.locator(".redaction-preview")).toContainText("[REDACTED]");
  await page.getByRole("button", { name: /Apply.*redaction/i }).click();
  await page.getByText(/Inspect the exact message packets/).click();
  await page.getByText(/Segment 1 ·/).click();
  await expect(page.locator(".submission-preview pre")).not.toContainText(
    "accounts@example.test",
  );
  await page
    .getByRole("checkbox", { name: /I reviewed the message text/ })
    .check();
  await page
    .getByRole("checkbox", {
      name: /authorized to share the selected messages/,
    })
    .check();
  await page
    .getByRole("button", { name: /Investigate selected conversation/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Follow the evidence." }),
  ).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(calls[0].messages).toHaveLength(7);
  expect(calls[0].messages[1].sender).toBe("Reviewed participant");
  expect(JSON.stringify(calls)).not.toContain("accounts@example.test");
  await page
    .getByRole("button", { name: /Credential request OBSERVED/ })
    .click();
  await expect(page.locator(".node-inspector")).toContainText(
    "Send your OTP immediately",
  );
  await page.getByText("Counterfactual explorer", { exact: true }).click();
  await page
    .getByLabel("Apply a transparent assumption")
    .selectOption("urgency-excluded");
  await expect(page.locator(".forensic-assumptions")).toContainText(
    "Hypothetical assessment",
  );
  await expect(page.locator(".forensic-report")).toContainText(
    "No independent verification has occurred",
  );
  await page
    .getByLabel("Apply a transparent assumption")
    .selectOption("original");
  await page.getByText("Counterfactual explorer", { exact: true }).click();
  await expect(page.locator(".node-inspector")).toContainText(
    /Protective action|RECOMMENDED ACTION/i,
  );
  const panel = await page.locator(".forensic-report").boundingBox();
  const tabs = await page.locator(".forensic-tabs").boundingBox();
  expect(tabs!.y).toBeLessThanOrEqual(panel!.y + 2);
  expect(
    (await page.locator(".forensic-layout").boundingBox())!.y,
  ).toBeLessThan(460);
  await page.getByRole("tab", { name: "timeline", exact: true }).click();
  await page.locator(".forensic-timeline button").nth(4).click();
  await expect(
    page.getByRole("tab", { name: "evidence", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".node-inspector")).toContainText(
    "Send your OTP immediately",
  );
  await expect(page.locator('[data-edge][aria-pressed="true"]')).toHaveCount(1);
  await page.getByLabel("Previous imported message").click();
  await expect(
    page.getByText(/Replay applies local prefix rules/),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/forensics/workspace-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("generated iOS upload, date correction, local-only mode and empty/malformed inputs", async ({
  page,
}) => {
  await page.goto(fixture.origin + "/investigate/import");
  await page.getByLabel("Choose conversation source files").setInputFiles({
    name: "empty.txt",
    mimeType: "text/plain",
    buffer: Buffer.alloc(0),
  });
  await expect(page.getByRole("alert")).toContainText("nonempty");
  await page.getByLabel("Choose conversation source files").setInputFiles({
    name: "bad.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("malformed"),
  });
  await expect(page.getByRole("alert")).toContainText("malformed");
  await page.getByLabel("Choose conversation source files").setInputFiles({
    name: "ios.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(iosExport().replaceAll("10/16/26", "01/02/26")),
  });
  await expect(page.locator(".message-review > li")).toHaveCount(3);
  await expect(page.locator(".parse-warnings")).toContainText("ambiguous");
  await page.getByLabel("Date order").selectOption("MDY");
  await page.getByRole("radio", { name: /Local rules only/ }).check();
  await page
    .getByRole("checkbox", { name: /I reviewed the message text/ })
    .check();
  await page.getByRole("button", { name: /Run local checks/ }).click();
  await expect(page.locator(".forensic-method")).toContainText("LOCAL RULES");
  expect(calls).toHaveLength(0);
});

test("5,000-message generated history discloses coverage and retries only the failed segment", async ({
  page,
}) => {
  await page.goto(fixture.origin + "/investigate/import");
  await page.getByLabel("Choose conversation source files").setInputFiles({
    name: "long.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(androidExport(5000)),
  });
  await expect(page.locator(".review-pagination")).toContainText("5,000");
  await expect(page.locator(".coverage-readout")).toContainText(
    "Partial coverage",
  );
  await page
    .getByRole("checkbox", { name: /I reviewed the message text/ })
    .check();
  await page
    .getByRole("checkbox", {
      name: /authorized to share the selected messages/,
    })
    .check();
  fail = true;
  await page
    .getByRole("button", { name: /Investigate selected conversation/ })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Generated provider failure",
  );
  await page
    .getByRole("button", { name: /Investigate selected conversation/ })
    .click();
  await expect(page.locator(".forensic-coverage")).toContainText(
    "5,000 messages analyzed",
  );
  expect(calls[0].requestId).toBe(calls[1].requestId);
  expect(calls.length).toBeLessThanOrEqual(7);
  for (const call of calls) {
    expect(call.messages.length).toBeLessThanOrEqual(36);
    expect(
      call.messages.reduce((n, m) => n + m.text.length, 0),
    ).toBeLessThanOrEqual(14_000);
  }
});

test("generated screenshots: duplicate prevention, local masking, overlap review and unreadable recovery", async ({
  page,
}) => {
  const image = async (color: string) =>
    sharp({
      create: { width: 300, height: 500, channels: 3, background: color },
    })
      .png()
      .toBuffer();
  await page.goto(fixture.origin + "/investigate/import");
  await page.getByRole("button", { name: "Screenshots", exact: true }).click();
  const one = await image("white"),
    two = await image("#eeeeee");
  await page.getByLabel("Choose conversation source files").setInputFiles([
    { name: "one.png", mimeType: "image/png", buffer: one },
    { name: "duplicate.png", mimeType: "image/png", buffer: one },
    { name: "two.png", mimeType: "image/png", buffer: two },
  ]);
  await expect(page.locator(".screenshot-editor")).toHaveCount(2);
  expect(visionCalls).toHaveLength(0);
  await page.getByText("Redact using coordinates").first().click();
  await page.getByRole("button", { name: "Cover rectangle" }).first().click();
  await expect(page.locator(".screenshot-filename").first()).toContainText(
    "redacted locally",
  );
  await page
    .getByRole("checkbox", {
      name: /authorized to share these .*prepared screenshots/,
    })
    .check();
  await page.getByRole("button", { name: /Reconstruct 2 screenshots/ }).click();
  await expect(page.locator(".message-review > li")).toHaveCount(4);
  expect(visionCalls).toHaveLength(2);
  expect(calls).toHaveLength(0);
  await expect(page.locator(".parse-warnings")).toContainText("overlap");
  await page
    .getByLabel("Message text")
    .first()
    .fill("Corrected screenshot greeting");
  await page.getByRole("button", { name: "Mark resolved" }).first().click();
  await page.getByRole("button", { name: /Start another import/ }).click();
  unreadable = true;
  await page.getByRole("button", { name: "Screenshots", exact: true }).click();
  await page.getByLabel("Choose conversation source files").setInputFiles({
    name: "unreadable.png",
    mimeType: "image/png",
    buffer: await image("black"),
  });
  await page
    .getByRole("checkbox", {
      name: /authorized to share these .*prepared screenshots/,
    })
    .check();
  await page.getByRole("button", { name: /Reconstruct 1 screenshot/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No readable conversation",
  );
  await expect(page.locator(".parse-warnings")).toContainText(
    "Generated blurred image",
  );
});

test("imported report: real Auth.js mock-provider journey, persistence, rename, PDF and deletion", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto(fixture.origin + "/login?next=%2Finvestigate%2Fimport");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expectView(page, "/investigate/import");
  await page.getByLabel("Choose conversation source files").setInputFiles({
    name: "private-generated.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(androidExport()),
  });
  await expect(page.locator(".message-review > li")).toHaveCount(8);
  await page.getByRole("radio", { name: /Local rules only/ }).check();
  await page
    .getByRole("checkbox", { name: /I reviewed the message text/ })
    .check();
  await page.getByRole("button", { name: /Run local checks/ }).click();
  await page
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await page
    .getByLabel("Investigation title", { exact: true })
    .fill("Generated private report");
  await page.getByRole("checkbox", { name: /Save this conversation/ }).check();
  await page.getByRole("button", { name: "Save to my account" }).click();
  await page.getByRole("link", { name: "Open saved report" }).click();
  await expect(page.locator(".forensic-coverage")).toContainText("8 of 8");
  await page.reload();
  await expect(page.locator(".forensic-coverage")).toContainText("8 of 8");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export PDF/ }).click();
  const download = await downloaded;
  await mkdir("artifacts/forensics", { recursive: true });
  await download.saveAs("artifacts/forensics/generated-report.pdf");
  const bytes = await readFile("artifacts/forensics/generated-report.pdf");
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  const pdfTask = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  const pdf = await pdfTask.promise;
  expect(pdf.numPages).toBeGreaterThan(1);
  const attachments = await pdf.getAttachments();
  expect(attachments!.has("veyra-evidence.json")).toBe(true);
  const evidence = JSON.parse(
    new TextDecoder().decode(
      (await pdf.getAttachmentContent("veyra-evidence.json"))!,
    ),
  );
  expect(evidence.messages[0].text).toContain("नमस्ते 🌿");
  expect(evidence.messages).toHaveLength(8);
  const content = await (await pdf.getPage(1)).getTextContent();
  expect(
    content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
  ).toContain("INDICATORS ARE NOT PROOF OF FRAUD");
  await pdfTask.destroy();
  await page.locator(".account-link").click();
  await page
    .getByRole("button", { name: "Rename Generated private report" })
    .click();
  await page
    .getByLabel("New investigation title")
    .fill("Renamed imported report");
  await page.getByRole("button", { name: "Save title", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Renamed imported report" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Renamed imported report" })
    .click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("NO THREADS SAVED YET")).toBeVisible();
});

test("intake and review reflow, keyboard operation, accessibility and mobile composition", async ({
  page,
}) => {
  await page.goto(fixture.origin + "/investigate/import");
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        { message: `Import reflows at ${width}px after the resize settles` },
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/forensics/intake-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Paste text", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByLabel(/Paste the exported conversation/)
    .fill(androidExport(4));
  await page.getByRole("button", { name: /Reconstruct conversation/ }).click();
  await expect(page.locator(".message-review > li")).toHaveCount(4);
  await expect
    .poll(
      () =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      {
        message:
          "Reviewed messages and progress feedback stay within the mobile rail",
      },
    )
    .toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: "artifacts/forensics/review-mobile.png",
    fullPage: true,
  });
});
