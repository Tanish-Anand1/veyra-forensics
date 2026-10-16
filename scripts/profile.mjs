import { chromium } from "@playwright/test";

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.bringToFront();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__lab = { lcpMs: 0, cls: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        window.__lab.lcpMs = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!entry.hadRecentInput) window.__lab.cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  const base = process.env.TEST_BASE_URL || "http://localhost:3000";
  for (const route of process.env.PROFILE_ROUTES?.split(",") || [
    "/",
    "/analyze",
  ]) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const paintCaptured = await page
      .waitForFunction(() => window.__lab.lcpMs > 0, undefined, {
        timeout: 5000,
      })
      .then(() => true)
      .catch(() => false);
    const result = await page.evaluate(
      (paintCaptured) => ({
        ...window.__lab,
        lcpMs: window.__lab.lcpMs || null,
        paintCaptured,
        transferredBytes: performance
          .getEntriesByType("resource")
          .reduce((sum, item) => sum + item.transferSize, 0),
        webglLoaded: performance
          .getEntriesByType("resource")
          .some((r) => r.name.includes("MetalScene")),
      }),
      paintCaptured,
    );
    console.log(
      JSON.stringify({
        route,
        viewport: "390x844",
        latencyMs: 150,
        downMbps: 1.6,
        cpuSlowdown: 4,
        cache: "disabled",
        motion: "reduced",
        ...result,
      }),
    );
  }
  await context.close();
} finally {
  await browser.close();
}
