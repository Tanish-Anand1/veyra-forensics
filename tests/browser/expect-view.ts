import { expect, type Page } from "@playwright/test";

export async function expectView(
  page: Page,
  route: string,
  options: { timeout?: number } = {},
) {
  const pathname = route.split("?")[0];
  const titles: Record<string, string> = {
    "/login": "Log in",
    "/signup": "Create a workspace",
    "/history": "Your investigations",
    "/analyze": "Analysis Workstation",
    "/investigate/import": "Conversation import",
    "/about": "Conversation forensics",
    "/methodology": "Methodology",
    "/sources": "Sources",
    "/cyber-ethics": "Cyber ethics",
    "/privacy": "Privacy Policy",
  };
  await expect(page).toHaveTitle(
    `${titles[pathname] || "Saved investigation"} | VEYRA`,
    options,
  );
  await expect(page).toHaveURL(new URL("/", page.url()).href, options);
}
