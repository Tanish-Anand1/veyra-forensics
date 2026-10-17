import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectView } from "./expect-view";

test("one public address preserves views, refresh, Back and Forward", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/about");
  await expectView(page, "/about");
  await page
    .getByRole("link", { name: "Explore the TrustGraph", exact: true })
    .click();
  await expect(page).toHaveURL(new URL("/", page.url()).href);
  const documentId = await page.evaluate(() => performance.timeOrigin);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Methodology", exact: true })
    .click();
  await expectView(page, "/methodology");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Sources", exact: true })
    .click();
  await expectView(page, "/sources");
  await expect(
    page.getByRole("heading", { name: /Follow the claim/ }),
  ).toBeVisible();
  await expect(page.locator(".source-register article")).toHaveCount(7);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentId);
  await page.reload();
  await expectView(page, "/sources");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Cyber ethics", exact: true })
    .click();
  await expectView(page, "/cyber-ethics");
  await expect(page.locator(".ethics-principles section")).toHaveCount(6);
  await page.goBack();
  await expectView(page, "/sources");
  await page.goForward();
  await expectView(page, "/cyber-ethics");
  expect(errors).toEqual([]);
});

test("Sources, cyber ethics and footer remain accessible at desktop and mobile widths", async ({
  page,
}) => {
  for (const width of [1920, 1440, 1366, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const route of ["/sources", "/cyber-ethics"]) {
      await page.goto(route);
      await expectView(page, route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/navigation/${route.slice(1)}-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("contentinfo").screenshot({
        path: `artifacts/navigation/footer-${width}.png`,
      });
    }
  }
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Sources", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expectView(page, "/sources");
});

test("Contact shows four sourced India reporting channels with accessible actions", async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/contact");
    await expect(page).toHaveTitle("Contact | VEYRA");
    await expect(page.locator(".contact-directory article")).toHaveCount(4);
    await expect(
      page.getByRole("link", { name: "Call 1930", exact: true }),
    ).toHaveAttribute("href", "tel:1930");
    await expect(
      page.getByRole("link", { name: "Call 112", exact: true }),
    ).toHaveAttribute("href", "tel:112");
    await expect(
      page.getByRole("link", { name: "Open cybercrime.gov.in", exact: true }),
    ).toHaveAttribute("href", "https://cybercrime.gov.in/");
    await expect(
      page.getByRole("link", {
        name: "Email incident@cert-in.org.in",
        exact: true,
      }),
    ).toHaveAttribute("href", "mailto:incident@cert-in.org.in");
    await expect(
      page.getByRole("link", { name: /^Official source:/ }),
    ).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/contact/contact-${width}.png`,
      fullPage: true,
    });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Call 1930", exact: true }).focus();
  await expect(
    page.getByRole("link", { name: "Call 1930", exact: true }),
  ).toBeFocused();
});
