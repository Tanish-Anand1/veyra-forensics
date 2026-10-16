import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { expectView } from "./expect-view";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("portrait film renders changing geometry and settles into usable login", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Skip intro", exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({
    timeout: 20000,
  });
  const canvas = page.locator(".auth-sculpture canvas");
  await expect(canvas).toBeVisible();
  const frames: string[] = [];
  for (const [phase, seconds] of [
    ["emerge", 0.5],
    ["fracture", 2.6],
    ["passage", 3.8],
    ["wordmark", 5.3],
  ] as const) {
    await page.waitForFunction(
      (time) =>
        Number(
          document.querySelector<HTMLElement>(".opening-wordmark")?.dataset
            .filmTime,
        ) >= time,
      seconds,
    );
    const frame = await page.screenshot({
      path: `artifacts/mobile-cinematic/${phase}.png`,
    });
    frames.push(createHash("sha256").update(frame).digest("hex"));
  }
  expect(new Set(frames).size).toBe(4);
  await expectView(page, "/login", { timeout: 6000 });
  await expect(page.locator(".auth-entry")).toHaveCSS("opacity", "1");
  expect(
    await canvas.evaluate((element) => (element as HTMLCanvasElement).width),
  ).toBeLessThanOrEqual(391);
  const before = createHash("sha256")
    .update(await canvas.screenshot())
    .digest("hex");
  await page.touchscreen.tap(290, 180);
  await page.waitForTimeout(500);
  const after = createHash("sha256")
    .update(await canvas.screenshot())
    .digest("hex");
  expect(after).not.toBe(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/mobile-cinematic/login.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Replay opening", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Skip intro", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expect(page.locator(".auth-entry")).toHaveCSS("opacity", "1");
  await page
    .getByRole("link", { name: "Try a guest investigation", exact: true })
    .click();
  await expectView(page, "/investigate/import");
  expect(errors).toEqual([]);
});

test("portrait layouts reflow at small, large and landscape phone sizes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [430, 932],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: "Replay opening", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator(".static-mechanism")).toBeVisible();
    await page.screenshot({
      path: `artifacts/mobile-cinematic/fallback-${width}.png`,
      fullPage: true,
    });
  }
});

test("mobile skip, reduced motion changes, data saving and lost graphics recover", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expectView(page, "/login");
  await page.locator('[data-film-ready="true"]').waitFor({ timeout: 20000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".static-mechanism")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await page.locator('[data-scene-ready="true"]').waitFor({ timeout: 20000 });
  await page
    .locator("canvas")
    .evaluate((element) =>
      element.dispatchEvent(new Event("webglcontextlost")),
    );
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".static-mechanism")).toBeVisible();
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
      configurable: true,
    }),
  );
  await page.reload();
  await expect(page.locator(".static-mechanism")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((entry) => entry.name.includes("MetalScene")),
    ),
  ).toBe(false);
});
