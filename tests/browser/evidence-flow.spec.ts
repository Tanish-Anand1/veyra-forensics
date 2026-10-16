import { test, expect } from "@playwright/test";
import { buildAnalysis, parseMessages } from "../../shared/engine";
import { samples } from "../../shared/samples";

test("a non-JSON hosting rate limit preserves input and offers local recovery", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page.getByRole("radio", { name: "OpenAI + local checks" }).check();
  await page.getByRole("checkbox").check();
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      status: 429,
      contentType: "text/html",
      body: "<html>Too many requests</html>",
    }),
  );
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Wait one minute");
  await expect(page.locator("textarea")).toHaveValue(samples[1].text);
  await page
    .getByRole("radio", { name: "Local checks", exact: false })
    .first()
    .check();
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
});

test("a larger unfamiliar record fits initially and remains inspectable", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page
    .locator("textarea")
    .fill(
      Array.from(
        { length: 12 },
        (_, i) =>
          `Dispatch: Shipment ${i + 1}. Transfer money to release the parcel. Act immediately.`,
      ).join("\n"),
    );
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  const initialZoom = Number(
    (await page.locator(".graph-controls .mono").innerText()).replace("%", ""),
  );
  expect(initialZoom).toBeLessThanOrEqual(100);
  await expect(page.locator(".graph-chapters")).toContainText(
    "MESSAGES 1–6 / 12",
  );
  await page.getByRole("button", { name: "Next graph chapter" }).click();
  await expect(page.locator(".graph-chapters")).toContainText(
    "MESSAGES 7–12 / 12",
  );
  const message = page.getByRole("button", {
    name: /Message 12 M12.*Inspect evidence/,
    exact: true,
  });
  await message.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator('.source-selected[data-message="m12"]'),
  ).toContainText("Shipment 12");
  await page
    .getByRole("button", { name: "Focus selection", exact: true })
    .click();
  await expect(page.locator(".graph-controls")).toContainText("135%");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect(page.locator(".graph-controls")).toContainText(
    `${initialZoom}%`,
  );
});

test("playing the demo pauses at computed escalation with linked evidence", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/about");
  await page
    .getByRole("button", { name: "PLAY CONVERSATION", exact: false })
    .click();
  await page.clock.runFor(8800);
  await expect(page.locator(".replay-note")).toContainText(
    "Replay paused at the triggering evidence",
  );
  await expect(page.locator(".case-assessment h3")).toHaveText(
    "Elevated concern",
  );
  await expect(
    page.locator('.source-selected[data-message="m5"]'),
  ).toBeVisible();
  await expect(page.locator(".protective-action")).toContainText("Do not pay");
});

test("connection selection links exact message, reasoning and action; replay hides future evidence", async ({
  page,
}) => {
  await page.goto("/analyze");
  const before = await page.locator(".workspace-grid").boundingBox();
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  const after = await page.locator(".workspace-grid").boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  const edge = page.getByRole("button", {
    name: "Inspect connection: Message 5 to Payment request. Quoted evidence.",
    exact: true,
  });
  await edge.focus();
  await page.keyboard.press("Enter");
  await expect(edge).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('.source-selected[data-message="m5"]'),
  ).toContainText("processing fee of $180");
  await expect(page.locator(".node-inspector blockquote")).toContainText(
    "Your place expires in 30 minutes.",
  );
  await expect(page.locator(".inspection-reason")).toContainText(
    "recipient remain unverified",
  );
  await expect(page.locator(".protective-action")).toContainText(
    "Do not pay through this conversation",
  );
  await expect
    .poll(() =>
      page.locator(".trace-messages").evaluate((panel) => {
        const source = panel
          .querySelector(".source-selected")!
          .getBoundingClientRect();
        const bounds = panel.getBoundingClientRect();
        return source.top >= bounds.top && source.top < bounds.bottom - 80;
      }),
    )
    .toBe(true);
  await page.getByRole("slider").fill("4");
  await expect(
    page.getByRole("button", {
      name: /Inspect connection: Message 5 to Payment/,
    }),
  ).toHaveCount(0);
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Insufficient evidence",
  );
  await expect(page.locator(".node-inspector")).toHaveCount(0);
  await page.getByRole("slider").fill("6");
  await expect(
    page.getByRole("button", {
      name: /Inspect connection: Message 5 to Payment/,
    }),
  ).toHaveCount(1);
  await page.screenshot({
    path: "test-results/evidence-connection-replay.png",
  });
});

test("provider loading reserves the panel geometry and returns usable evidence", async ({
  page,
}) => {
  const report = buildAnalysis(parseMessages(samples[1].text));
  await page.route("**/api/analyze", async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(report),
    });
  });
  await page.goto("/analyze");
  await page.getByRole("radio", { name: "OpenAI + local checks" }).check();
  await page.getByRole("checkbox").check();
  const box = () =>
    page
      .locator(".workspace-grid")
      .evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight }));
  const before = await box();
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await expect(page.locator(".analysis-skeleton")).toBeVisible();
  expect(await box()).toEqual(before);
  await expect(page.locator(".graph-heading")).toContainText("19 NODES");
  expect(await box()).toEqual(before);
});

test("homepage demo uses the same progressive evidence and mobile graph remains controllable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");
  await expect(page.locator(".static-mechanism")).toHaveJSProperty(
    "currentSrc",
    new URL("/mechanism-mobile.webp", page.url()).href,
  );
  await page
    .getByRole("link", { name: "Explore the TrustGraph", exact: true })
    .click();
  await expect(page.locator(".case-assessment h3")).toHaveText(
    "Insufficient evidence",
  );
  await page.getByRole("slider").fill("5");
  await expect(page.locator(".case-assessment h3")).toHaveText(
    "Elevated concern",
  );
  const link = page.getByRole("button", {
    name: "Inspect connection: Message 5 to Payment request. Quoted evidence.",
    exact: true,
  });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".node-inspector")).toContainText(
    "processing fee of $180",
  );
  await page
    .getByRole("button", { name: "Focus selection", exact: true })
    .click();
  await expect(page.locator(".graph-controls")).toContainText("135%");
  await page.getByRole("button", { name: "Rotate spatial graph" }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-evidence.png",
    fullPage: true,
  });
});
