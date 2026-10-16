import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { zipSync, strToU8 } from "fflate";
import sharp from "sharp";
import { parseConversation, IMPORT_LIMITS } from "../shared/import";
import { selectMessages, aggregateReport } from "../shared/selection";
import { reconstructScreenshots } from "../shared/screenshots";
import {
  readChatArchive,
  decodeText,
  imageDimensions,
} from "../src/import-files";
import { buildAnalysis } from "../shared/engine";
import { createApp } from "../server/app";
import { ImportError, type ImportAI } from "../server/import-ai";
import {
  androidExport,
  iosExport,
  chatZip,
  screenshotReading,
} from "./forensics-fixtures";

test("Android and iOS exports preserve message boundaries, Unicode and stable source IDs", () => {
  const source = androidExport(),
    a = parseConversation(source, "generated.txt"),
    b = parseConversation(source, "renamed.txt");
  assert.equal(a.messages.length, 8);
  assert.equal(a.dateOrder, "DMY");
  assert.equal(
    a.messages[3].text,
    "Why is a fee necessary?\nCan I verify this independently?",
  );
  assert.equal(a.messages[3].sources[0].lastLine, 5);
  assert.equal(a.messages[0].sender, "Alex, Operations");
  assert.match(a.messages[0].text, /नमस्ते 🌿/);
  assert.deepEqual(
    a.messages.map((m) => m.id),
    b.messages.map((m) => m.id),
  );
  const ios = parseConversation(iosExport());
  assert.equal(ios.dateOrder, "MDY");
  assert.equal(ios.messages[0].timestamp, "2026-10-16T21:04:10");
  assert.equal(ios.messages[1].kind, "system");
  assert.equal(ios.messages[2].kind, "media");
});
test("date ambiguity is visible; locale digits, month names, 12-hour and invalid boundaries remain honest", () => {
  const ambiguous = parseConversation(
    "[01/02/26, 9:30 PM] Ada: Test\n[01/02/26, 9:31 PM] Bo: Reply",
  );
  assert.equal(ambiguous.messages[0].timestamp, null);
  assert.match(ambiguous.warnings.join(), /ambiguous/);
  assert.equal(
    parseConversation("[01/02/26, 9:30 PM] Ada: Test", "x", "MDY").messages[0]
      .timestamp,
    "2026-01-02T21:30:00",
  );
  for (const stamp of [
    "١٦/١٠/٢٠٢٦, ١٠:٣٠ ص",
    "16 octobre 2026, 10:30",
    "2026-10-16, 上午10:30",
  ])
    assert.equal(
      parseConversation(`[${stamp}] Ada: नमस्ते`).messages[0].timestamp,
      "2026-10-16T10:30:00",
    );
  const malformed = parseConversation(
    "16/10/2026, 10:30 - Ada: Test\n16/10/2026, 25:90 - Bo: preserved",
  );
  assert.equal(malformed.messages.length, 1);
  assert.match(malformed.messages[0].uncertainties.join(), /boundary/);
  const plain = parseConversation("Ada: First\ncontinues here\nBo: Reply");
  assert.equal(plain.messages.length, 2);
  assert.equal(plain.messages[0].text, "First\ncontinues here");
  assert.throws(() => parseConversation(""), /empty/);
  assert.throws(() => parseConversation("binary\0text"), /binary/);
  assert.throws(
    () => parseConversation("x".repeat(IMPORT_LIMITS.characters + 1)),
    /3 million/,
  );
});
test("ZIP import reads only chat text; rejects malformed, encrypted, unsafe and expanding archives", async () => {
  const good = await readChatArchive(chatZip());
  assert.equal(good.chats.length, 1);
  assert.equal(good.ignored, 1);
  assert.equal(good.chats[0].text, androidExport());
  assert.equal(
    (
      await readChatArchive(
        zipSync({
          "one.txt": strToU8("Ada: one"),
          "two.txt": strToU8("Bo: two"),
        }),
      )
    ).chats.length,
    2,
  );
  for (const name of [
    "../chat.txt",
    "/chat.txt",
    "C:\\chat.txt",
    "folder/../chat.txt",
  ])
    await assert.rejects(
      readChatArchive(zipSync({ [name]: strToU8("Ada: unsafe") })),
      /Unsafe/,
    );
  await assert.rejects(readChatArchive(new Uint8Array()), /empty/);
  await assert.rejects(readChatArchive(chatZip().slice(0, -9)), /malformed/);
  const encrypted = chatZip();
  new DataView(encrypted.buffer).setUint16(6, 1, true);
  await assert.rejects(readChatArchive(encrypted), /encryption/);
  const corrupt = chatZip();
  corrupt[50] ^= 32;
  await assert.rejects(readChatArchive(corrupt));
  await assert.rejects(
    readChatArchive(zipSync({ "bomb.txt": strToU8("x".repeat(2_000_000)) })),
    /compression ratio/,
  );
  const understated = zipSync({ "chat.txt": strToU8("x".repeat(300_000)) });
  const view = new DataView(understated.buffer),
    central = view.getUint32(understated.length - 6, true);
  view.setUint32(22, 10, true);
  view.setUint32(central + 24, 10, true);
  await assert.rejects(readChatArchive(understated), /decompressed safely/);
  assert.equal(decodeText(new Uint8Array([255, 254, 65, 0])), "A");
  assert.throws(() => decodeText(new Uint8Array([255, 254, 65])), /encoding/);
});
test("screenshot overlap preserves both sources; uncertain and unreadable content is never guessed", () => {
  const first = screenshotReading(1, ["Hello", "Pay a fee", "Please verify"]),
    second = screenshotReading(2, [
      "Pay a fee",
      "Please verify",
      "I will check",
    ]);
  second.extraction.messages[0].timestamp = "10:01";
  second.extraction.messages[1].timestamp = "10:02";
  const combined = reconstructScreenshots([first, second, first]);
  assert.equal(combined.messages.length, 4);
  assert.equal(combined.messages[1].sources.length, 2);
  assert.match(combined.warnings.join(), /Duplicate screenshot/);
  assert.equal(
    reconstructScreenshots([first, second], false).messages.length,
    6,
  );
  assert.equal(
    reconstructScreenshots([
      screenshotReading(3, ["OK"]),
      screenshotReading(4, ["OK"]),
    ]).messages.length,
    2,
  );
  const unreadable = screenshotReading(5, [], null);
  unreadable.extraction.unreadableRegions.push("Entire image blurred");
  const empty = reconstructScreenshots([unreadable]);
  assert.equal(empty.messages.length, 0);
  assert.match(empty.warnings.join(), /blurred/);
  assert.match(
    reconstructScreenshots([
      screenshotReading(6, ["[unreadable]"], null),
    ]).messages[0].uncertainties.join(),
    /unknown/,
  );
});
test("5,000-message histories select deterministic bounded chronological segments and canonical evidence", () => {
  const all = parseConversation(androidExport(5000)).messages;
  const a = selectMessages(all, "relevant"),
    b = selectMessages(all, "relevant");
  assert.deepEqual(a, b);
  assert.ok(a.partial && a.excluded > 0);
  assert.ok(
    a.messages.length <= 180 &&
      a.characters <= 72_000 &&
      a.segments.length <= 6,
  );
  for (const s of a.segments) {
    assert.ok(s.messages.length <= 36);
    assert.ok(s.messages.reduce((n, m) => n + m.text.length, 0) <= 14_000);
    assert.equal(new Set(s.messages.map((m) => m.id)).size, s.messages.length);
  }
  const report = aggregateReport(
    a.messages,
    a.segments.map((s) =>
      buildAnalysis(s.messages.map((m, index) => ({ ...m, index }))),
    ),
    all.length,
    a.description,
    [],
  );
  for (const f of report.findings)
    for (const e of f.evidence)
      assert.ok(
        report.messages
          .find((m) => m.id === e.messageId)
          ?.text.includes(e.quote),
      );
  for (const edge of report.edges) {
    assert.ok(report.nodes.some((n) => n.id === edge.from));
    assert.ok(report.nodes.some((n) => n.id === edge.to));
  }
  assert.equal(report.imported.totalMessages, 5000);
  assert.equal(selectMessages(all, "range", [9, 12]).messages[0].id, all[8].id);
});
test("image headers are bounded before decoding, including PNG, JPEG and WebP", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    const image = await sharp({
      create: { width: 80, height: 100, channels: 3, background: "white" },
    })
      .toFormat(format)
      .toBuffer();
    assert.deepEqual(imageDimensions(image), [80, 100]);
  }
  const oversized = await sharp({
    create: { width: 80, height: 100, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  oversized.writeUInt32BE(500000, 16);
  assert.throws(() => imageDimensions(oversized), /16 megapixels/);
  assert.throws(
    () => imageDimensions(new Uint8Array([1, 2, 3])),
    /valid static/,
  );
});
test("import HTTP boundary requires consent/origin, verifies images, shares concurrent work and recovers failures", async () => {
  let analyses = 0,
    visions = 0,
    fail = false;
  const ai: ImportAI = {
    async analyze(input) {
      analyses++;
      await new Promise((r) => setTimeout(r, 20));
      if (fail) throw new ImportError(502, "Generated provider failure");
      return buildAnalysis(input.messages);
    },
    async readScreenshot() {
      visions++;
      return screenshotReading(1, ["Generated OCR"]).extraction;
    },
  };
  const server = createApp({ importAI: ai }).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const status = await fetch(origin + "/api/import/status");
    const cookie = status.headers.getSetCookie()[0].split(";")[0];
    assert.match(
      status.headers.getSetCookie()[0],
      /HttpOnly.*SameSite=Strict/i,
    );
    const post = (path: string, body: unknown, source = origin) =>
      fetch(origin + path, {
        method: "POST",
        headers: { origin: source, cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const messages = selectMessages(
      parseConversation(androidExport()).messages,
      "all",
    ).segments[0].messages;
    const body = {
      kind: "import-segment",
      requestId: randomUUID(),
      consent: true,
      messages,
    };
    assert.equal(
      (await post("/api/analyze", { ...body, consent: false })).status,
      400,
    );
    assert.equal(
      (await post("/api/analyze", body, "https://evil.test")).status,
      403,
    );
    const concurrent = await Promise.all([
      post("/api/analyze", body),
      post("/api/analyze", body),
    ]);
    assert.deepEqual(
      concurrent.map((r) => r.status),
      [200, 200],
    );
    assert.equal(analyses, 1);
    assert.equal(
      (await post("/api/analyze", { ...body, messages: [messages[0]] })).status,
      409,
    );
    fail = true;
    const retry = { ...body, requestId: randomUUID() };
    assert.equal((await post("/api/analyze", retry)).status, 502);
    fail = false;
    assert.equal((await post("/api/analyze", retry)).status, 200);
    assert.equal(analyses, 3);
    const image = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "white" },
    })
      .webp()
      .toBuffer();
    const picture = {
      requestId: randomUUID(),
      consent: true,
      imageId: "img-0000000000000001",
      image: `data:image/webp;base64,${image.toString("base64")}`,
    };
    assert.equal((await post("/api/import/screenshots", picture)).status, 200);
    assert.equal((await post("/api/import/screenshots", picture)).status, 200);
    assert.equal(visions, 1);
    assert.equal(
      (
        await post("/api/import/screenshots", {
          ...picture,
          requestId: randomUUID(),
          image: "data:image/webp;base64,YmFk",
        })
      ).status,
      400,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
