import { test, expect } from "@playwright/test";
import { expectView } from "./expect-view";
import AxeBuilder from "@axe-core/playwright";
import { samples } from "../../shared/samples";

test("complete local journey, evidence, graph, scenario, upload and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const conversationRequests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/analyze")) conversationRequests.push(r.url());
  });
  await page.goto("/analyze");
  await page.getByRole("button", { name: "ANALYZE CONVERSATION" }).click();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
  await expect(page.getByRole("status")).toContainText(
    "No conversation content was transmitted",
  );
  expect(conversationRequests).toHaveLength(0);
  await page
    .getByRole("button", { name: "Time pressure", exact: true })
    .click();
  await expect(page.locator(".node-inspector")).toContainText(
    "expires in 30 minutes",
  );
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".graph-controls")).toContainText("120%");
  await page.getByRole("button", { name: "Focus selection" }).click();
  await expect(page.locator(".graph-controls")).toContainText("135%");
  await page.getByRole("button", { name: "Reset view" }).click();
  await page
    .getByLabel("Apply a transparent assumption")
    .selectOption("no-payment");
  await expect(page.locator(".assessment-block")).toContainText("HYPOTHETICAL");
  await expect(page.locator(".scenario-notice")).toContainText(
    "payment requests",
  );
  await page
    .getByLabel("Apply a transparent assumption")
    .selectOption("original");
  await page.getByRole("tab", { name: "evidence", exact: true }).click();
  await expect(page.locator(".evidence-finding")).not.toHaveCount(0);
  await page.getByRole("tab", { name: "timeline", exact: true }).click();
  await expect(page.locator(".timeline-report>button")).toHaveCount(6);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export evidence" }).click();
  expect((await download).suggestedFilename()).toBe("veyra-evidence.json");
  await page.locator(".composer > summary").click();
  await page.getByLabel("Explore a simulated case").selectOption("a");
  await page.getByRole("button", { name: "ANALYZE CONVERSATION" }).click();
  await page.getByRole("tab", { name: "summary", exact: true }).click();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Insufficient evidence",
  );
  await page
    .getByLabel("Upload a text conversation", { exact: true })
    .setInputFiles({
      name: "new-case.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(
        "Courier: Transfer money for delivery. Act immediately.\nCustomer: Who are you?",
      ),
    });
  await page.getByRole("button", { name: "ANALYZE CONVERSATION" }).click();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(page.locator("textarea")).toBeEmpty();
  expect(errors).toEqual([]);
});

test("OpenAI failure, loading skeleton, cancellation and privacy consent", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page.getByRole("radio", { name: "OpenAI + local checks" }).check();
  await expect(
    page.getByRole("button", { name: "ANALYZE CONVERSATION" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.route("**/api/analyze", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Test provider unavailable. Use local checks.",
      }),
    });
  });
  await page.getByRole("button", { name: "ANALYZE CONVERSATION" }).click();
  await expect(page.locator(".analysis-skeleton")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Test provider unavailable",
  );
  await expect(page.locator("textarea")).toHaveValue(samples[1].text);
  await page
    .getByRole("radio", { name: "Local checks", exact: false })
    .first()
    .check();
  await page.getByRole("button", { name: "ANALYZE CONVERSATION" }).click();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
});

test("keyboard path, tab semantics, redaction and message-level analysis", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page
    .locator("textarea")
    .fill("Advisor: Contact alex@example.com or 555-123-4567.");
  await page
    .getByRole("button", { name: "Redact common sensitive data" })
    .click();
  await expect(page.locator("textarea")).toHaveValue(/\[REDACTED\]/);
  await page.getByText("Message history", { exact: false }).click();
  await page.getByRole("button", { name: "Analyze this message" }).click();
  await expect(page.getByRole("status")).toContainText("1 messages");
  await page.getByRole("tab", { name: "summary" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "evidence" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "evidence" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("responsive pages, route navigation, text reflow and accessibility", async ({
  page,
}) => {
  for (const width of [1920, 1440, 1366, 768, 390, 320]) {
    await page.setViewportSize({
      width,
      height:
        width <= 390 ? 844 : width === 1920 ? 1080 : width === 1366 ? 768 : 900,
    });
    for (const route of ["/login", "/about", "/analyze"]) {
      await page.goto(route);
      await page.locator("h1").waitFor();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
      if (width === 390)
        await page.screenshot({
          path: `test-results/${route === "/login" ? "login" : route === "/about" ? "product" : "workstation"}-mobile.png`,
          fullPage: true,
        });
    }
  }
  for (const route of [
    "/",
    "/about",
    "/privacy",
    "/terms",
    "/methodology",
    "/analyze",
    "/contact",
  ]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      axe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(await page.locator("body").innerText()).not.toContain("—");
  }
  await page.goto("/analyze");
  await page.getByRole("button", { name: "ANALYZE CONVERSATION" }).click();
  const resultsAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    resultsAxe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.locator("h1").click();
  await page.screenshot({
    path: "test-results/workstation-desktop.png",
    fullPage: true,
  });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
});

test("seven-second opening reveals the wordmark, reaches login and preserves its sculpture", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const log = document.documentElement.dataset;
      if (
        document.querySelector('.is-opening[data-film-ready="true"]') &&
        !log.filmStart
      )
        log.filmStart = String(performance.now());
      const title = document.querySelector(".opening-wordmark");
      if (
        title &&
        getComputedStyle(title).visibility === "visible" &&
        !log.filmWordmark
      )
        log.filmWordmark = String(performance.now());
      if (
        log.filmStart &&
        !document.querySelector(".is-opening") &&
        !log.filmEnd
      )
        log.filmEnd = String(performance.now());
    });
    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-film-ready"],
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Skip intro", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".auth-entry")).toHaveCSS("opacity", "0");
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".opening-wordmark")).toBeVisible({
    timeout: 7000,
  });
  await expect(page.locator(".opening-tagline")).toHaveText(
    "SEE THROUGH DECEPTION.",
  );
  await page.screenshot({ path: "artifacts/veyra/film-wordmark.png" });
  await expectView(page, "/login", { timeout: 5000 });
  const timing = await page.evaluate(() => ({
    start: Number(document.documentElement.dataset.filmStart),
    wordmark: Number(document.documentElement.dataset.filmWordmark),
    end: Number(document.documentElement.dataset.filmEnd),
  }));
  expect(timing.wordmark - timing.start).toBeGreaterThanOrEqual(4000);
  expect(timing.wordmark - timing.start).toBeLessThan(6000);
  expect(timing.end - timing.start).toBeGreaterThanOrEqual(6500);
  expect(timing.end - timing.start).toBeLessThan(9500);
  await expect(page.locator(".auth-entry")).toHaveCSS("opacity", "1");
  await expect(page.locator(".auth-sculpture .artwork")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Try a guest investigation" }).click();
  await expectView(page, "/investigate/import");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "VEYRA home" })
    .click();
  await expectView(page, "/login");
  await expect(
    page.getByRole("button", { name: "Skip intro", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("intro skips instantly and reduced motion bypasses the film", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expectView(page, "/login");
  await expect(page.locator(".auth-entry")).toHaveCSS("opacity", "1");
  await page.getByRole("link", { name: "Explore VEYRA" }).click();
  await expectView(page, "/about");
  await expect(
    page.getByRole("link", { name: "Upload a conversation" }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    sessionStorage.removeItem("veyra-intro");
    sessionStorage.removeItem("veyra-view");
    history.replaceState(null, "", "/");
  });
  await page.reload();
  await expectView(page, "/login");
  await expect(
    page.getByRole("button", { name: "Skip intro", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".static-mechanism")).toBeVisible();
});

test("canceled provider work cannot restore cleared private content", async ({
  page,
}) => {
  await page.goto("/analyze");
  await page.getByRole("radio", { name: "OpenAI + local checks" }).check();
  await page.getByRole("checkbox").check();
  await page.route("**/api/analyze", async (route) => {
    await new Promise((r) => setTimeout(r, 1000));
    await route
      .fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Late provider error." }),
      })
      .catch(() => {});
  });
  await page.getByRole("button", { name: "ANALYZE CONVERSATION" }).click();
  await expect(page.locator(".analysis-skeleton")).toBeVisible();
  await page.getByRole("button", { name: "Cancel analysis" }).click();
  await page.getByRole("button", { name: "Clear session" }).click();
  await page.waitForTimeout(1200);
  await expect(page.locator("textarea")).toBeEmpty();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".graph-empty")).toBeVisible();
});

test("WebGL initialization failure preserves the product and rendered fallback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (kind: string, ...args: unknown[]) {
        if (kind.startsWith("webgl") || kind === "experimental-webgl")
          return null;
        return Reflect.apply(getContext, this, [kind, ...args]);
      },
    });
  });
  await page.goto("/");
  await expect(page.locator(".static-mechanism")).toBeVisible();
  await page.getByRole("button", { name: "SKIP INTRO" }).click();
  await expect(page.locator(".auth-entry")).toHaveCSS("opacity", "1");
  await page.getByRole("link", { name: "Try a guest investigation" }).click();
  await page.goto("/analyze");
  await page.getByRole("button", { name: "ANALYZE CONVERSATION" }).click();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
});
