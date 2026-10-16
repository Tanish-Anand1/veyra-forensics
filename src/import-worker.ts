import { parseConversation, type DateOrder } from "../shared/import";
import { readChatArchive, decodeText } from "./import-files";
self.onmessage = async (
  event: MessageEvent<{
    kind: "text" | "zip";
    bytes?: ArrayBuffer;
    text?: string;
    name: string;
    dateOrder?: DateOrder;
  }>,
) => {
  try {
    const { kind, bytes, text, name, dateOrder } = event.data;
    if (kind === "zip")
      self.postMessage({
        ok: true,
        archive: await readChatArchive(new Uint8Array(bytes!)),
      });
    else {
      const content = text ?? decodeText(new Uint8Array(bytes!));
      self.postMessage({
        ok: true,
        draft: parseConversation(content, name, dateOrder),
        original: content,
      });
    }
  } catch (error) {
    self.postMessage({ ok: false, error: (error as Error).message });
  }
};
