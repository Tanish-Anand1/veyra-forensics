import { IMPORT_LIMITS, fingerprint } from "../shared/import";

export function decodeText(bytes: Uint8Array) {
  try {
    const utf16 =
      bytes[0] === 0xff && bytes[1] === 0xfe
        ? "utf-16le"
        : bytes[0] === 0xfe && bytes[1] === 0xff
          ? "utf-16be"
          : "utf-8";
    return new TextDecoder(utf16, { fatal: true })
      .decode(bytes)
      .replace(/^\ufeff/, "");
  } catch {
    throw new Error(
      "The text encoding could not be read. Export the chat as UTF-8 or UTF-16 text.",
    );
  }
}
function safePath(name: string) {
  const normalized = name.replace(/\\/g, "/");
  return (
    Boolean(name) &&
    name.length <= 240 &&
    ![...name].some((c) => c.charCodeAt(0) < 32) &&
    !normalized.startsWith("/") &&
    !/^[a-z]:/i.test(normalized) &&
    normalized.split("/").every((part) => part !== ".." && part !== ".")
  );
}
export async function readChatArchive(bytes: Uint8Array) {
  if (!bytes.length) throw new Error("This ZIP archive is empty.");
  if (bytes.length > IMPORT_LIMITS.archiveBytes)
    throw new Error("Use a ZIP archive smaller than 12 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (
    let at = bytes.length - 22;
    at >= Math.max(0, bytes.length - 65557);
    at--
  )
    if (
      view.getUint32(at, true) === 0x06054b50 &&
      at + 22 + view.getUint16(at + 20, true) === bytes.length
    ) {
      end = at;
      break;
    }
  if (end < 0) throw new Error("This ZIP archive is malformed or incomplete.");
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    view.getUint16(end + 8, true) !== view.getUint16(end + 10, true)
  )
    throw new Error("Split ZIP archives are not supported.");
  const entries = view.getUint16(end + 10, true),
    centralSize = view.getUint32(end + 12, true),
    centralAt = view.getUint32(end + 16, true);
  if (
    entries === 0 ||
    entries > IMPORT_LIMITS.archiveEntries ||
    centralAt + centralSize !== end
  )
    throw new Error(
      "Archive entry count or directory layout is unsupported. Use a normal ZIP export with at most 2,000 entries.",
    );
  let cursor = centralAt,
    total = 0;
  const textNames = new Set<string>(),
    names = new Set<string>();
  const expected = new Map<
    string,
    {
      size: number;
      crc: number;
      start: number;
      compressed: number;
      method: number;
    }
  >();
  const ranges: [number, number][] = [];
  for (let i = 0; i < entries; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      throw new Error("The ZIP directory is malformed.");
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      compressed = view.getUint32(cursor + 20, true),
      expanded = view.getUint32(cursor + 24, true),
      nameSize = view.getUint16(cursor + 28, true),
      extraSize = view.getUint16(cursor + 30, true),
      commentSize = view.getUint16(cursor + 32, true),
      disk = view.getUint16(cursor + 34, true),
      attributes = view.getUint32(cursor + 38, true),
      local = view.getUint32(cursor + 42, true);
    if (cursor + 46 + nameSize + extraSize + commentSize > end)
      throw new Error("The ZIP directory is truncated.");
    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameSize),
    );
    if (
      !safePath(name) ||
      names.has(name.toLocaleLowerCase()) ||
      ((attributes >>> 16) & 0xf000) === 0xa000
    )
      throw new Error(
        "Unsafe, duplicate or symbolic-link archive paths were rejected.",
      );
    names.add(name.toLocaleLowerCase());
    if (flags & 0x41 || disk || ![0, 8].includes(method))
      throw new Error(
        "Encrypted archives and unsupported compression methods are not accepted.",
      );
    if (
      expanded === 0xffffffff ||
      compressed === 0xffffffff ||
      local === 0xffffffff ||
      expanded > IMPORT_LIMITS.archiveExpandedBytes ||
      local + 30 > centralAt ||
      view.getUint32(local, true) !== 0x04034b50
    )
      throw new Error(
        "Oversized, ZIP64 or malformed archive data was rejected.",
      );
    const localNameLength = view.getUint16(local + 26, true),
      localExtra = view.getUint16(local + 28, true),
      start = local + 30 + localNameLength + localExtra;
    if (
      start + compressed > centralAt ||
      view.getUint16(local + 6, true) & 0x41 ||
      view.getUint16(local + 8, true) !== method
    )
      throw new Error(
        "Archive data or encryption flags do not match its directory.",
      );
    const localName = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(local + 30, local + 30 + localNameLength),
    );
    if (localName !== name)
      throw new Error("Archive filenames do not match their source records.");
    if (ranges.some(([from, to]) => local < to && start + compressed > from))
      throw new Error("Overlapping archive entries were rejected.");
    ranges.push([local, start + compressed]);
    if (
      !(flags & 8) &&
      (view.getUint32(local + 18, true) !== compressed ||
        view.getUint32(local + 22, true) !== expanded ||
        view.getUint32(local + 14, true) !== view.getUint32(cursor + 16, true))
    )
      throw new Error(
        "Archive sizes or checksums do not match their source records.",
      );
    total += expanded;
    if (
      total > IMPORT_LIMITS.archiveExpandedBytes ||
      (expanded > 1_000_000 && expanded / Math.max(1, compressed) > 150)
    )
      throw new Error(
        "The archive exceeds the decompression budget or has a suspicious compression ratio.",
      );
    if (/\.txt$/i.test(name) && !name.endsWith("/")) {
      if (expanded > IMPORT_LIMITS.textBytes)
        throw new Error(
          "The chat text exceeds 10 MB. Export a shorter date range.",
        );
      textNames.add(name);
      expected.set(name, {
        size: expanded,
        crc: view.getUint32(cursor + 16, true),
        start,
        compressed,
        method,
      });
    }
    cursor += 46 + nameSize + extraSize + commentSize;
  }
  if (cursor !== end || !textNames.size)
    throw new Error("No readable .txt conversation was found in this ZIP.");
  try {
    const files: Record<string, Uint8Array> = {};
    for (const [name, entry] of expected) {
      const compressed = bytes.slice(
        entry.start,
        entry.start + entry.compressed,
      );
      if (entry.method === 0) files[name] = compressed;
      else {
        let offset = 0;
        const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
          pull(controller) {
            if (offset >= compressed.length) {
              controller.close();
              return;
            }
            controller.enqueue(compressed.slice(offset, (offset += 16384)));
          },
        }).pipeThrough(new DecompressionStream("deflate-raw"));
        const reader = stream.getReader(),
          chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > entry.size || size > IMPORT_LIMITS.textBytes) {
              await reader.cancel();
              throw new Error("Archive expansion exceeds the declared budget");
            }
            chunks.push(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
        const output = new Uint8Array(size);
        let at = 0;
        for (const chunk of chunks) {
          output.set(chunk, at);
          at += chunk.length;
        }
        files[name] = output;
      }
    }
    return {
      chats: Object.entries(files).map(([name, data]) => {
        let crc = 0xffffffff;
        for (const byte of data) {
          crc ^= byte;
          for (let bit = 0; bit < 8; bit++)
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
        if (
          data.length !== expected.get(name)!.size ||
          (crc ^ 0xffffffff) >>> 0 !== expected.get(name)!.crc
        )
          throw new Error("Archive checksum mismatch");
        return { name, text: decodeText(data) };
      }),
      ignored: entries - textNames.size,
    };
  } catch {
    throw new Error(
      "The ZIP text could not be decompressed safely. Export a fresh archive.",
    );
  }
}
export type ScreenshotInput = {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  masked: boolean;
};
export function imageDimensions(data: Uint8Array): [number, number] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const ascii = (at: number, size: number) =>
    String.fromCharCode(...data.subarray(at, at + size));
  let size: [number, number] | null = null;
  if (data.length >= 24 && ascii(1, 3) === "PNG" && ascii(12, 4) === "IHDR") {
    for (let at = 8; at + 12 <= data.length;) {
      const length = view.getUint32(at);
      if (ascii(at + 4, 4) === "acTL")
        throw new Error(
          "Use a static screenshot rather than an animated image.",
        );
      if (length > data.length - at - 12) break;
      at += length + 12;
    }
    size = [view.getUint32(16), view.getUint32(20)];
  } else if (
    data.length >= 30 &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 4) === "WEBP"
  ) {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") {
      if (data[20] & 2)
        throw new Error(
          "Use a static screenshot rather than an animated image.",
        );
      size = [
        1 + data[24] + (data[25] << 8) + (data[26] << 16),
        1 + data[27] + (data[28] << 8) + (data[29] << 16),
      ];
    } else if (chunk === "VP8 " && ascii(23, 3) === "\x9d\x01\x2a")
      size = [
        view.getUint16(26, true) & 0x3fff,
        view.getUint16(28, true) & 0x3fff,
      ];
    else if (chunk === "VP8L" && data[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      size = [1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)];
    }
  } else if (data[0] === 255 && data[1] === 216) {
    let at = 2;
    while (at + 4 < data.length) {
      if (data[at++] !== 255) break;
      while (data[at] === 255) at++;
      const marker = data[at++];
      if (marker === 0xda || marker === 0xd9) break;
      const length = view.getUint16(at);
      if (length < 2 || at + length > data.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 7
      ) {
        size = [view.getUint16(at + 5), view.getUint16(at + 3)];
        break;
      }
      at += length;
    }
  }
  if (
    !size ||
    size[0] < 20 ||
    size[1] < 20 ||
    size[0] * size[1] > IMPORT_LIMITS.imagePixels
  )
    throw new Error(
      "Use a valid static screenshot between 20 pixels and 16 megapixels.",
    );
  return size;
}
export async function prepareScreenshot(file: File): Promise<ScreenshotInput> {
  if (
    !/\.(png|jpe?g|webp)$/i.test(file.name) ||
    file.size > IMPORT_LIMITS.imageBytes ||
    !file.size
  )
    throw new Error("Choose a nonempty PNG, JPEG or WebP image up to 12 MB.");
  const data = new Uint8Array(await file.arrayBuffer());
  imageDimensions(data);
  if (!(
    (data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71) ||
    (data[0] === 255 && data[1] === 216 && data[2] === 255) ||
    (String.fromCharCode(...data.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...data.slice(8, 12)) === "WEBP")
  ))
    throw new Error("This file does not contain a supported screenshot image.");
  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width * bitmap.height > IMPORT_LIMITS.imagePixels ||
      bitmap.width < 20 ||
      bitmap.height < 20
    )
      throw new Error("Use screenshots between 20 pixels and 16 megapixels.");
    const ratio = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/webp", 0.9);
    if (dataUrl.length > 1_300_000)
      throw new Error(
        "This screenshot is still too large after local preparation. Crop it to the conversation first.",
      );
    return {
      id: `img-${fingerprint(dataUrl)}`,
      name: file.name.slice(0, 240),
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      masked: false,
    };
  } finally {
    bitmap.close();
  }
}
