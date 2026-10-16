import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.TEST_BASE_URL;
assert.ok(
  base?.startsWith("https://"),
  "Set TEST_BASE_URL to the production HTTPS origin.",
);
const accountResponse = await fetch(base + "/api/account");
assert.equal(accountResponse.status, 200);
assert.equal(accountResponse.headers.get("cache-control"), "no-store");
const account = await accountResponse.json();
assert.equal(account.user, null);
if (!account.configured) {
  assert.equal((await fetch(base + "/api/auth/csrf")).status, 503);
  assert.equal((await fetch(base + "/api/investigations")).status, 503);
} else {
  assert.equal((await fetch(base + "/api/auth/csrf")).status, 200);
  assert.equal((await fetch(base + "/api/investigations")).status, 401);
}
const browser = await chromium.launch({
  args: process.platform === "win32" ? ["--use-angle=d3d11"] : [],
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/login");
  await page.getByRole("button", { name: "Continue with Google" }).waitFor();
  await page
    .locator(".auth-status")
    .filter({
      hasText: account.configured
        ? "provider"
        : "awaiting server configuration",
    })
    .waitFor();
  if (!account.configured)
    assert.equal(
      await page
        .getByRole("button", { name: "Continue with Google" })
        .isEnabled(),
      false,
    );
  else {
    for (const [provider, enabled] of Object.entries(account.providers))
      assert.equal(
        await page
          .getByRole("button", {
            name: `Continue with ${provider === "google" ? "Google" : "GitHub"}`,
            exact: true,
          })
          .isEnabled(),
        enabled,
      );
  }
  await page.locator(".auth-sculpture canvas").waitFor({ state: "visible" });
  await mkdir("artifacts/auth", { recursive: true });
  await page.screenshot({
    path: "artifacts/auth/production-login-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/signup");
  await page
    .getByRole("heading", { name: "START WITH THE EVIDENCE." })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "artifacts/auth/production-signup-mobile.png",
    fullPage: true,
  });
  await page.goto(base + "/history");
  await page.waitForFunction(() => document.title === "Log in | VEYRA");
  assert.equal(page.url(), base + "/");
  await page.goto(base + "/analyze");
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await page
    .locator(".assessment-block h3")
    .filter({ hasText: "Elevated concern" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Save investigation", exact: true })
      .isEnabled(),
    true,
  );
  assert.deepEqual(errors, []);
  const report = {
    base,
    authConfigured: account.configured,
    providers: account.providers,
    checks: [
      "public login/signup",
      "mobile reflow",
      "protected history redirect",
      "guest analysis",
      account.configured
        ? "configured providers and guest authorization boundary"
        : "safe missing-credential state",
    ],
    pageErrors: errors,
    realOAuthTestedByThisScript: false,
  };
  await writeFile(
    "artifacts/auth/production-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
