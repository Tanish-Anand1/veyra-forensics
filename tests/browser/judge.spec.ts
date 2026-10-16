import { test, expect } from "@playwright/test";
import { samples } from "../../shared/samples";

const cases = [
  {
    name: "legitimate",
    text: "Mira: Can we meet at the library at noon?\nDev: Yes, I will bring the notes.",
    level: "Insufficient evidence",
  },
  {
    name: "scholarship escalation",
    text: samples[1].text,
    level: "Elevated concern",
  },
  {
    name: "financial request",
    text: "Seller: Pay the deposit. Act immediately.\nBuyer: Please send the written agreement first.",
    level: "Elevated concern",
  },
  {
    name: "ambiguous",
    text: "Advisor: There may be a fee. Please check the published schedule.\nStudent: I will check with the office.",
    level: "Insufficient evidence",
  },
  {
    name: "unseen",
    text: "Dispatch: Transfer money to release the parcel. Act immediately.\nRecipient: Which parcel and tracking number?",
    level: "Elevated concern",
  },
];
for (const item of cases)
  test(`judge case: ${item.name} computes arbitrary input and distinct reports`, async ({
    page,
  }) => {
    await page.goto("/analyze");
    await page
      .getByRole("button", { name: "Start with your own text" })
      .click();
    await expect(page.locator("textarea")).toBeFocused();
    await page.locator("textarea").fill(item.text);
    await page
      .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
      .click();
    await expect(page.locator(".assessment-block h3")).toHaveText(item.level);
    const summary = await page.getByRole("tabpanel").innerText();
    await page.getByRole("tab", { name: "evidence", exact: true }).click();
    await expect(page.getByRole("tabpanel")).toContainText(
      "TRACEABLE OBSERVATIONS",
    );
    const evidence = await page.getByRole("tabpanel").innerText();
    await page.getByRole("tab", { name: "timeline", exact: true }).click();
    await expect(page.locator(".timeline-report > button")).toHaveCount(
      item.text.split("\n").length,
    );
    const timeline = await page.getByRole("tabpanel").innerText();
    expect(new Set([summary, evidence, timeline]).size).toBe(3);
  });

test("empty and invalid uploads preserve input and cannot produce fake success", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page.getByRole("button", { name: "Start with your own text" }).click();
  await expect(
    page.getByRole("button", { name: "ANALYZE CONVERSATION", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Upload a text conversation", { exact: true })
    .setInputFiles({
      name: "invalid.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("invalid"),
    });
  await expect(page.getByRole("alert")).toContainText("Choose a .txt file");
  await expect(page.locator("textarea")).toBeEmpty();
  await expect(page.locator(".graph-empty")).toBeVisible();
});

test("malformed provider success is rejected and retry recovers with actual input", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page.getByRole("radio", { name: "OpenAI + local checks" }).check();
  await page.getByRole("checkbox").check();
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages: [], findings: [] }),
    }),
  );
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("unexpected response");
  await expect(page.locator(".assessment-block")).toHaveCount(0);
  await expect(page.locator("textarea")).toHaveValue(samples[1].text);
  await page.getByRole("radio", { name: /^Local checks/ }).check();
  await page.getByRole("button", { name: "Retry analysis" }).click();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
});

test("source references focus the exact original message; counterfactuals update the report", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page.locator("textarea").fill(cases[2].text);
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await page.getByRole("tab", { name: "evidence", exact: true }).click();
  const finding = page.locator(".evidence-finding").filter({
    has: page.getByRole("button", { name: "Payment request", exact: false }),
  });
  await finding.getByRole("button", { name: "Show source message M1" }).click();
  await expect(page.locator('.trace-message[data-message="m1"]')).toBeFocused();
  await expect(
    page.locator('.source-selected[data-message="m1"]'),
  ).toContainText("Pay the deposit");
  await page
    .getByLabel("Apply a transparent assumption")
    .selectOption("urgency-excluded");
  await page.getByRole("tab", { name: "summary", exact: true }).click();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Review before acting",
  );
  await page
    .getByLabel("Apply a transparent assumption")
    .selectOption("original");
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
});

test("the hero live demo action launches the real chronological demonstration", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/about");
  await page.getByRole("link", { name: "Explore the TrustGraph" }).click();
  await expect(
    page.getByRole("button", { name: "PAUSE REPLAY", exact: false }),
  ).toBeVisible();
  await page.clock.runFor(8800);
  await expect(page.locator(".case-assessment h3")).toHaveText(
    "Elevated concern",
  );
  await expect(page.locator(".protective-action")).toContainText("Do not pay");
});

test("mobile report tabs remain distinct and source links return to the transcript", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/analyze");
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  const reports = [];
  for (const name of ["summary", "evidence", "timeline"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    reports.push(await page.getByRole("tabpanel").innerText());
  }
  expect(new Set(reports).size).toBe(3);
  await page.getByRole("tab", { name: "evidence", exact: true }).click();
  await page
    .getByRole("button", { name: "Show source message M5", exact: true })
    .first()
    .click();
  await expect(page.locator('.trace-message[data-message="m5"]')).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
