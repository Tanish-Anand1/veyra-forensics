import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const base = process.env.TEST_BASE_URL || "http://localhost:3006";
const browser = await chromium.launch({
  args: process.platform === "win32" ? ["--use-angle=d3d11"] : [],
});
await mkdir("artifacts/veyra", { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    reducedMotion: "no-preference",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/login");
  await page.locator(".auth-sculpture canvas").waitFor({ state: "visible" });
  await page.locator('[data-film-ready="true"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "artifacts/veyra/login-1920.png",
    fullPage: true,
  });
  await page.addStyleTag({
    content:
      ".auth-entry,.auth-header,.auth-footer,.skip-link{visibility:hidden!important}",
  });
  const render = await page.locator(".auth-sculpture canvas").screenshot();
  await page.reload();
  await sharp(render)
    .webp({ quality: 90 })
    .toFile("public/auth-mechanism.webp");
  await sharp(render).webp({ quality: 90 }).toFile("public/mechanism.webp");
  const fonts = await page
    .locator(".auth-entry h1, .veyra-wordmark, .auth-intro")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        text: element.textContent,
        family: window.getComputedStyle(element).fontFamily,
        weight: window.getComputedStyle(element).fontWeight,
      })),
    );
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `artifacts/veyra/login-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + "/");
  await page.locator('[data-film-ready="true"]').waitFor();
  const start = Date.now();
  for (const time of [500, 2000, 3600, 5100, 6600, 7500]) {
    const remaining = time - (Date.now() - start);
    if (remaining > 0) await page.waitForTimeout(remaining);
    await page.screenshot({ path: `artifacts/veyra/opening-${time}.png` });
  }
  await page.goto(base + "/about");
  await page.screenshot({
    path: "artifacts/veyra/product-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.addStyleTag({
    content:
      ".site-header,.site-footer,.product-workflow,.public-product > section:not(.product-hero),.case-section,.product-actions {display:none!important}.product-hero {min-height:630px;height:630px;padding:45px 60px}.product-introduction h1{font-size:91px}.product-wordmark{font-size:80px}.product-introduction p{font-size:18px}.product-introduction{max-width:620px}",
  });
  await sharp(await page.screenshot())
    .webp({ quality: 90 })
    .toFile("public/veyra-social.webp");
  await writeFile(
    "artifacts/veyra/render.json",
    JSON.stringify({ base, fonts, errors }, null, 2),
  );
  console.log(JSON.stringify({ base, fonts, errors }));
} finally {
  await browser.close();
}
