import { test, expect } from "@playwright/test";
import { expectView } from "./expect-view";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { authFixture } from "../auth-fixture";

let fixture: Awaited<ReturnType<typeof authFixture>>;
test.beforeEach(async () => {
  fixture = await authFixture();
});
test.afterEach(async () => {
  await fixture?.close();
});

test("real Auth.js browser cookies: signup, save, revisit, delete, logout and returning login", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(fixture.origin + "/signup?next=%2Fhistory");
  await expect(
    page.getByRole("heading", { name: "START WITH THE EVIDENCE." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expectView(page, "/about");
  await expect(page.locator(".product-hero")).toBeVisible();
  await page.locator(".account-link").click();
  await expectView(page, "/history");
  await expect(page.locator(".account-link")).toContainText(
    "Google Investigator",
  );
  await expect(page.getByText("NO THREADS SAVED YET")).toBeVisible();
  await expect(page.locator(".account-link")).toContainText(
    "Google Investigator",
  );
  const session = (await page.context().cookies()).find(
    (c) => c.name === "authjs.session-token",
  );
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  await page.reload();
  await expect(page.locator(".account-link")).toContainText(
    "Google Investigator",
  );
  await page.getByRole("link", { name: "New investigation" }).click();
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await page
    .getByLabel("Investigation title", { exact: true })
    .fill("A conversation worth revisiting");
  await page.getByRole("checkbox", { name: /Save this conversation/ }).check();
  await page.getByRole("button", { name: "Save to my account" }).click();
  await expect(
    page.getByRole("button", { name: "Investigation saved" }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("stored on the server");
  await page.getByRole("link", { name: "Open saved report" }).click();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
  await expect(page.locator(".replay-controls label")).toHaveText("MESSAGE 6");
  await expect(page.locator(".trace-heading")).toContainText("6 / 6");
  await page.reload();
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
  await expect(page.locator(".replay-controls label")).toHaveText("MESSAGE 6");
  await page.locator(".account-link").click();
  await expect(
    page.getByRole("heading", { name: "A conversation worth revisiting" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete A conversation worth revisiting" })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A conversation worth revisiting" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete A conversation worth revisiting" })
    .click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("NO THREADS SAVED YET")).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expectView(page, "/login");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await page.goto(fixture.origin + "/history");
  await expectView(page, "/login");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expectView(page, "/about");
  await page.locator(".account-link").click();
  await expectView(page, "/history");
  await expect(page.locator(".account-link")).toContainText(
    "Google Investigator",
  );
  expect(
    (await fixture.database.query("SELECT * FROM users")).rows,
  ).toHaveLength(1);
  await fixture.database.query("UPDATE sessions SET expires=$1", [
    new Date(Date.now() - 1000),
  ]);
  await page.reload({ waitUntil: "commit" });
  await expectView(page, "/login");
  await expect(page.getByRole("alert")).toContainText("Your session has ended");
  expect(errors).toEqual([]);
});

test("GitHub signup, cancellation, provider failure and safe retry", async ({
  page,
}) => {
  await page.goto(fixture.origin + "/login?error=Configuration");
  await expect(page.getByRole("alert")).toContainText(
    "Please retry from this page",
  );
  await page.goto(fixture.origin + "/signup?next=%2Fanalyze");
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await expectView(page, "/about");
  await expect(page.locator(".product-hero")).toBeVisible();
  await expect(page.locator(".account-link")).toContainText(
    "GitHub Investigator",
  );
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expectView(page, "/login");
  fixture.state.cancel = true;
  await page.goto(fixture.origin + "/login");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "could not complete sign-in",
  );
  fixture.state.fail = true;
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByRole("alert")).toContainText("Sign-in");
  fixture.state.fail = false;

  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await expectView(page, "/about");
  expect(
    (await fixture.database.query("SELECT * FROM users")).rows,
  ).toHaveLength(1);
});

test("guest report survives OAuth and still requires explicit save confirmation", async ({
  page,
}) => {
  await page.goto(fixture.origin + "/analyze");
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await page
    .getByLabel("Investigation title", { exact: true })
    .fill("Preserved guest report");
  await page
    .getByRole("checkbox", { name: /Keep this report temporarily/ })
    .check();
  await page.getByRole("button", { name: "Sign in and keep report" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expectView(page, "/about");
  await page.goto(fixture.origin + "/analyze?resume=1");
  await expectView(page, "/analyze?resume=1");
  await expect(page.locator(".assessment-block h3")).toHaveText(
    "Elevated concern",
  );
  await page
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(
    page.getByLabel("Investigation title", { exact: true }),
  ).toHaveValue("Preserved guest report");
  await expect(
    page.getByRole("checkbox", { name: /Save this conversation/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Save to my account" }),
  ).toBeDisabled();
});

test("auth composition: desktop/mobile, keyboard, reduced motion and accessibility", async ({
  page,
}) => {
  test.slow();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture.origin + "/login");
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Viewport ${width}px must reflow`,
    ).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({
      path: `artifacts/auth/login-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto(fixture.origin + "/signup");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeFocused();
});

test("authenticated navigation and save controls reflow on narrow screens", async ({
  page,
}) => {
  await page.goto(fixture.origin + "/login?next=%2Fanalyze");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expectView(page, "/about");
  await page.goto(fixture.origin + "/analyze");
  await expectView(page, "/analyze");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        { message: `Authenticated viewport ${width}px must reflow` },
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Log out", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".account-link")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "ANALYZE CONVERSATION", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Keep this investigation." }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Investigation title", { exact: true }).press("Escape");
  await expect(
    page.getByRole("heading", { name: "Keep this investigation." }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Save investigation", exact: true }),
  ).toBeFocused();
});

test("the auth sculpture responds to pointer movement without blocking sign-in", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(fixture.origin + "/login");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  const canvas = page.locator(".auth-sculpture canvas");
  await expect(page.locator('[data-film-ready="true"]')).toBeVisible({
    timeout: 15000,
  });
  if (await page.locator(".static-mechanism").isVisible()) {
    test.info().annotations.push({
      type: "graphics",
      description:
        "Software/reduced-performance WebGL uses the same sculpture poster; camera movement is unavailable on this path.",
    });
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeEnabled();
    return;
  }
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.waitForTimeout(900);
  const before = createHash("sha256")
    .update(await canvas.screenshot())
    .digest("hex");
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3);
  await page.waitForTimeout(1100);
  const after = createHash("sha256")
    .update(await canvas.screenshot())
    .digest("hex");
  expect(after).not.toBe(before);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "artifacts/auth/login-live-sculpture.png",
    fullPage: true,
  });
});
