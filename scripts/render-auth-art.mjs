import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  });
  await page.goto(process.env.TEST_BASE_URL || "http://localhost:3003/login");
  const canvas = page.locator(".auth-sculpture canvas");
  await canvas.waitFor({ state: "visible" });
  await page.addStyleTag({
    content:
      ".auth-study { visibility:hidden } .auth-sculpture .artwork { inset:0 !important } .auth-sculpture { background:#0b0d0e !important }",
  });

  await page.waitForTimeout(1200);
  await mkdir("artifacts/auth", { recursive: true });
  const png = await canvas.screenshot({
    path: "artifacts/auth/sculpture-source.png",
  });

  const encoded = await page.evaluate(
    async (source) => {
      const image = document.createElement("img");
      image.src = source;
      await image.decode();
      const output = document.createElement("canvas");
      output.width = image.width;
      output.height = image.height;
      output.getContext("2d").drawImage(image, 0, 0);
      return output.toDataURL("image/webp", 0.88).split(",")[1];
    },
    "data:image/png;base64," + png.toString("base64"),
  );
  await writeFile("public/auth-mechanism.webp", Buffer.from(encoded, "base64"));
  console.log(
    "Captured the original Three.js sculpture without page typography.",
  );
} finally {
  await browser.close();
}
