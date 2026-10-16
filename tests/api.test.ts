import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app";
import type { AddressInfo } from "node:net";

test("real HTTP boundary: configuration, validation, consent, local and malformed input", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (body: unknown) =>
    fetch(base + "/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const status = await fetch(base + "/api/status");
    assert.equal(status.status, 200);
    assert.equal(status.headers.get("cache-control"), "no-store");
    const invalid = await post({ text: "tiny", mode: "local" });
    assert.equal(invalid.status, 400);
    const noConsent = await post({
      text: "A sender says hello.",
      mode: "openai",
      consent: false,
    });
    assert.equal(noConsent.status, 400);
    const local = await post({
      text: "Sender: Send your password. Act immediately.",
      mode: "local",
    });
    assert.equal(local.status, 200);
    const a = await local.json();
    assert.equal(a.assessment.level, "elevated");
    assert.equal(a.provenance.mode, "local");
    assert.match(
      local.headers.get("content-security-policy") || "",
      /frame-ancestors 'none'/,
    );
    const unicode = await post({ text: "文".repeat(18000), mode: "local" });
    assert.equal(unicode.status, 200);
    const oversized = await post({ text: "x".repeat(140000), mode: "local" });
    assert.equal(oversized.status, 413);
    const malformed = await fetch(base + "/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid",
    });
    assert.equal(malformed.status, 400);
    for (let i = 0; i < 10; i++)
      await post({
        text: "Sender: This is a harmless message.",
        mode: "local",
      });
    const limited = await post({
      text: "Sender: Another message.",
      mode: "local",
    });
    assert.equal(limited.status, 429);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
