import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.TEST_BASE_URL;
assert.ok(
  base?.startsWith("https://"),
  "Set TEST_BASE_URL to the HTTPS deployment.",
);
const assets = new Set([
  "/mechanism.webp",
  "/mechanism-mobile.webp",
  "/auth-mechanism.webp",
  "/favicon.svg",
  "/veyra-social.webp",
  "/licenses/Archivo-Black-OFL.txt",
  "/licenses/Barlow-Condensed-OFL.txt",
  "/licenses/ibm-plex-sans.txt",
  "/licenses/ibm-plex-mono.txt",
]);
const checked = [];
for (const route of [
  "/",
  "/about",
  "/analyze",
  "/methodology",
  "/sources",
  "/cyber-ethics",
  "/privacy",
  "/terms",
  "/contact",
  "/login",
  "/signup",
  "/history",
  "/investigate/import",
]) {
  const res = await fetch(base + route);
  const body = await res.text();
  assert.equal(res.status, 200, route);
  assert.ok(body.includes('id="root"'), route);
  assert.ok(
    res.headers.get("content-security-policy")?.includes("script-src 'self'"),
  );
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  for (const match of body.matchAll(/(?:src|href)="(\/[^"#]+)"/g))
    assets.add(match[1]);
  checked.push({ route, status: res.status });
}
for (const asset of assets) {
  const url = new URL(asset, base);
  const res = await fetch(url);
  const body = await res.text();
  assert.equal(res.status, 200, asset);
  assert.ok(
    !res.headers.get("content-type")?.includes("text/html"),
    `Asset fell through to SPA: ${asset}`,
  );
  assert.ok(
    !process.env.OPENAI_API_KEY || !body.includes(process.env.OPENAI_API_KEY),
    "Credential appeared in a public asset",
  );
  assert.ok(
    !/sk-proj-[A-Za-z0-9_-]{30,}/.test(body),
    "Project credential appeared in public output",
  );
  if (asset.endsWith(".css"))
    for (const match of body.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g))
      if (!match[1].startsWith("data:"))
        assets.add(new URL(match[1], url).pathname);
  if (asset.endsWith(".js"))
    for (const match of body.matchAll(/import\(["']([^"']+\.js)["']\)/g))
      assets.add(new URL(match[1], url).pathname);
}
const statusRes = await fetch(base + "/api/status");
assert.equal(statusRes.status, 200);
const status = await statusRes.json();
assert.equal(status.configured, true);
const request = async (body) =>
  fetch(base + "/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const invalid = await request({ text: "short", mode: "openai", consent: true });
assert.equal(invalid.status, 400);
const noConsent = await request({
  text: "Advisor: Please send documents today.",
  mode: "openai",
  consent: false,
});
assert.equal(noConsent.status, 400);
const local = await request({
  text: "Courier: Transfer money to release the parcel. Act immediately.",
  mode: "local",
  consent: false,
});
assert.equal(local.status, 200);
assert.equal(local.headers.get("cache-control"), "no-store");
const report = await local.json();
assert.equal(report.assessment.level, "elevated");
assert.ok(
  report.findings.every((finding) =>
    finding.evidence.every((e) =>
      report.messages.find((m) => m.id === e.messageId)?.text.includes(e.quote),
    ),
  ),
);
const result = {
  url: base,
  routes: checked,
  assets: assets.size,
  configured: status.configured,
  model: status.model,
  validation: invalid.status,
  consent: noConsent.status,
  localAnalysis: local.status,
  passed: true,
};
await mkdir("artifacts/deployment", { recursive: true });
await writeFile(
  "artifacts/deployment/http-verification.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
