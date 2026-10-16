import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const dir = process.env.REVIEW_DIR || "artifacts/rebuild-pass-1";
const base = process.env.REVIEW_URL || "http://localhost:3001";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
});
await page.addInitScript(() =>
  window.sessionStorage.setItem("cb-intro", "seen"),
);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("requestfailed", (request) =>
  errors.push(`${request.url()}: ${request.failure()?.errorText}`),
);
await page.goto(base + "/");
await page.locator("canvas").waitFor();
await page.waitForTimeout(1800);
await page.screenshot({ path: `${dir}/hero.png` });
if (process.env.RENDER_ASSET === "true")
  await page
    .locator("canvas")
    .screenshot({ path: "public/mechanism.png", omitBackground: true });
await page.goto(base + "/analyze");
await page.getByText(/gpt-5\.6-luna · server key/).waitFor();
await page
  .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
  .click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${dir}/workspace.png` });
const edge = page.getByRole("button", {
  name: "Inspect connection: Message 5 to Payment request. Quoted evidence.",
  exact: true,
});
await edge.press("Enter");
await page.waitForTimeout(500);
await page.screenshot({ path: `${dir}/connection.png` });
await page.goto(base + "/#system");
await page.getByRole("slider").fill("6");
await page.waitForTimeout(1200);
await page.locator("#system").scrollIntoViewIfNeeded();
await page.screenshot({ path: `${dir}/demo.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(base + "/");
await page.screenshot({ path: `${dir}/mobile-hero.png` });
await page.screenshot({ path: `${dir}/mobile.png`, fullPage: true });
console.log(JSON.stringify({ errors, dir }));
await browser.close();
