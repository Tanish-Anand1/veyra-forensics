import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.REVIEW_URL || "http://localhost:3002";
const dir = process.env.REVIEW_DIR || "artifacts/final-directive/pass-2";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("requestfailed", (request) => {
  if (request.failure()?.errorText !== "net::ERR_ABORTED")
    errors.push(`${request.url()}: ${request.failure()?.errorText}`);
});
await page.addInitScript(() =>
  window.sessionStorage.setItem("cb-intro", "seen"),
);
const observations = [];
for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [390, 844],
]) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({
    reducedMotion: width > 700 ? "no-preference" : "reduce",
  });
  await page.goto(base + "/");
  await page.evaluate(() => document.fonts.ready);
  if (width > 700) {
    await page.locator("canvas, .static-mechanism").first().waitFor();
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${dir}/${width}-home.png` });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/analyze");
  await page.getByText(/gpt-5\.6-luna · server key/).waitFor();
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await page.locator(".assessment-block h3").waitFor();
  if (width < 700) await page.locator(".graph-region").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/${width}-graph.png` });
  if (width < 700)
    await page.getByRole("button", { name: "Previous graph chapter" }).click();
  await page
    .getByRole("button", {
      name: "Inspect connection: Message 5 to Payment request. Quoted evidence.",
      exact: true,
    })
    .press("Enter");
  await page.locator(".protective-action").waitFor();
  await page.screenshot({ path: `${dir}/${width}-connection.png` });
  const reports = {};
  for (const name of ["summary", "evidence", "timeline"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    reports[name] = await page.getByRole("tabpanel").innerText();
    await page.screenshot({ path: `${dir}/${width}-${name}.png` });
  }
  observations.push({
    width,
    height,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    distinctReports: new Set(Object.values(reports)).size === 3,
  });
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(base + "/analyze");
await page.getByText(/gpt-5\.6-luna · server key/).waitFor();
await page
  .locator("textarea")
  .fill(
    Array.from(
      { length: 60 },
      (_, i) =>
        `Dispatch: Shipment ${i + 1}. Transfer money to release the parcel. Act immediately.`,
    ).join("\n"),
  );
await page
  .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
  .click();
await page.locator(".graph-chapters").waitFor();
await page.screenshot({ path: `${dir}/60-message-chapter.png` });
for (let i = 0; i < 9; i++)
  await page.getByRole("button", { name: "Next graph chapter" }).click();
await page
  .getByRole("button", {
    name: "Message 60, observed. Inspect evidence.",
    exact: true,
  })
  .press("Enter");
await page.screenshot({ path: `${dir}/60-message-source.png` });
const result = { url: base, observations, errors };
await writeFile(`${dir}/review.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
await browser.close();
