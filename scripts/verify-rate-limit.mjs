import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.TEST_BASE_URL;
assert.ok(base?.startsWith("https://"), "Set TEST_BASE_URL to HTTPS.");

const responses = [];
for (let i = 0; i < 12; i++) {
  const response = await fetch(base + "/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "short", mode: "local", consent: false }),
  });
  responses.push({
    status: response.status,
    contentType: response.headers.get("content-type"),
    retryAfter: response.headers.get("retry-after"),
  });
  await response.arrayBuffer();
  assert.ok([400, 429].includes(response.status));
  if (response.status === 429) break;
}
assert.ok(responses.some((response) => response.status === 429));
const result = { url: base, responses, passed: true };
await mkdir("artifacts/deployment", { recursive: true });
await writeFile(
  "artifacts/deployment/rate-limit.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
