import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const origin =
  process.env.TEST_BASE_URL || "https://chainbreak-zero.vercel.app";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/investigate/import");
  await expect(
    page.getByRole("button", { name: /Choose export/ }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(resolve),
          ),
        ),
    );
    const geometry = await page.evaluate(() => ({
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 8)
        .map((e) => ({
          tag: e.tagName,
          className: e.className,
          right: e.getBoundingClientRect().right,
        })),
    }));
    console.log(JSON.stringify(geometry));
    await page.screenshot({
      path: `artifacts/forensics/release/layout-${width}.png`,
      fullPage: true,
    });
    assert.ok(geometry.documentWidth <= width);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `artifacts/forensics/release/intake-${width === 1440 ? "desktop" : "mobile"}.png`,
        fullPage: true,
      });
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      origin,
      widths: [1440, 768, 390, 320],
      pageErrors: errors,
      passed: true,
    }),
  );
} finally {
  await browser.close();
}
