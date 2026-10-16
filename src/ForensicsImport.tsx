import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from "react";
import { Header, Footer } from "./Layout";
import {
  parseConversation,
  IMPORT_LIMITS,
  fingerprint,
  type ImportDraft,
  type DateOrder,
  type ImportedMessage,
} from "../shared/import";
import { selectMessages, aggregateReport } from "../shared/selection";
import {
  reconstructScreenshots,
  type ScreenshotReading,
} from "../shared/screenshots";
import { redact } from "../shared/engine";
import { isAnalysis } from "./evidence";
import { prepareScreenshot, type ScreenshotInput } from "./import-files";
import { pendingReport } from "./Investigations";
import ForensicWorkspace from "./ForensicWorkspace";
import type { Analysis } from "../shared/schema";
import "./forensics.css";

type Status = {
  configured: boolean;
  model: string;
  visionModel: string;
  retention: string;
};
type WorkerResult = {
  ok: boolean;
  error?: string;
  draft?: ImportDraft;
  original?: string;
  archive?: { chats: { name: string; text: string }[]; ignored: number };
};
export default function ForensicsImport() {
  const [restored] = useState(() => pendingReport());
  const [report, setReport] = useState<Analysis | null>(
    restored?.analysis.imported ? restored.analysis : null,
  );
  const [mode, setMode] = useState<"export" | "screenshots" | "paste">(
    "export",
  );
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [images, setImages] = useState<ScreenshotInput[]>([]);
  const [readings, setReadings] = useState<ScreenshotReading[]>([]);
  const [merge, setMerge] = useState(true);
  const [archive, setArchive] = useState<WorkerResult["archive"]>();
  const [archiveChoice, setArchiveChoice] = useState("");
  const [original, setOriginal] = useState<{
    text: string;
    name: string;
  } | null>(null);
  const [dateOrder, setDateOrder] = useState<DateOrder>("auto");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [imageConsent, setImageConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const [method, setMethod] = useState<"openai" | "local">("openai");
  const [selection, setSelection] = useState<"all" | "relevant" | "range">(
    "relevant",
  );
  const [range, setRange] = useState<[number, number]>([1, 180]);
  const [page, setPage] = useState(0);
  const [redactNames, setRedactNames] = useState(false);
  const [terms, setTerms] = useState("");
  const [redactionPreview, setRedactionPreview] = useState<
    ImportedMessage[] | null
  >(null);
  const worker = useRef<Worker | null>(null),
    abort = useRef<AbortController | null>(null),
    file = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const rejectWorker = useRef<((error: Error) => void) | null>(null);
  const requestIds = useRef(new Map<string, string>()),
    completed = useRef(new Map<string, Analysis>()),
    completedImages = useRef(new Map<string, ScreenshotReading>());
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/import/status", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Import configuration could not be checked. Reload to retry.",
          );
        setStatus(await response.json());
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => {
      controller.abort();
      worker.current?.terminate();
      abort.current?.abort();
    };
  }, []);
  const plan = useMemo(
    () => (draft ? selectMessages(draft.messages, selection, range) : null),
    [draft, selection, range],
  );
  const selected = new Set(plan?.messages.map((m) => m.id));
  function resetConfirmation() {
    setConfirmed(false);
    setConsent(false);
    setRedactionPreview(null);
  }
  function cancel() {
    generation.current++;
    worker.current?.terminate();
    worker.current = null;
    rejectWorker.current?.(new Error("Local parsing stopped."));
    rejectWorker.current = null;
    abort.current?.abort();
    setBusy(false);
    setStage("");
    setNote(
      "Processing stopped on this page. An already submitted provider request may finish; a retry reuses the same request identifier.",
    );
  }
  async function task(payload: {
    kind: "text" | "zip";
    bytes?: ArrayBuffer;
    text?: string;
    name: string;
    dateOrder?: DateOrder;
  }) {
    worker.current?.terminate();
    rejectWorker.current?.(new Error("Local parsing replaced."));
    return new Promise<WorkerResult>((resolve, reject) => {
      rejectWorker.current = reject;
      const running = new Worker(
        new URL("./import-worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = running;
      running.onmessage = (event: MessageEvent<WorkerResult>) => {
        running.terminate();
        worker.current = null;
        rejectWorker.current = null;
        if (event.data.ok) resolve(event.data);
        else reject(new Error(event.data.error));
      };
      running.onerror = () => {
        running.terminate();
        worker.current = null;
        rejectWorker.current = null;
        reject(
          new Error(
            "The local parser could not complete. Try a smaller export.",
          ),
        );
      };
      running.postMessage(payload, payload.bytes ? [payload.bytes] : []);
    });
  }
  function acceptDraft(
    next: ImportDraft,
    source?: { text: string; name: string },
  ) {
    setDraft(next);
    setOriginal(source ?? null);
    setDateOrder(next.dateOrder);
    setSelection(next.messages.length > 180 ? "relevant" : "all");
    setRange([1, Math.min(180, next.messages.length)]);
    setPage(0);
    resetConfirmation();
    setNote(
      `${next.messages.length.toLocaleString()} messages reconstructed. Review the transcript before analysis.`,
    );
    requestAnimationFrame(() =>
      document.getElementById("review-title")?.focus(),
    );
  }
  async function processText(content: string, name: string) {
    setBusy(true);
    setError("");
    setStage("Parsing message boundaries locally");
    const run = ++generation.current;
    try {
      const result = await task({
        kind: "text",
        text: content,
        name,
        dateOrder,
      });
      if (run !== generation.current) return;
      acceptDraft(result.draft!, { text: result.original!, name });
    } catch (e) {
      if (run === generation.current) setError((e as Error).message);
    } finally {
      if (run === generation.current) {
        setBusy(false);
        setStage("");
      }
    }
  }
  async function files(list: File[]) {
    if (busy || !list.length) return;
    setError("");
    setNote("");
    const screenshots = list.every((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
    if (screenshots) {
      if (images.length + list.length > IMPORT_LIMITS.screenshots) {
        setError("Use at most eight screenshots per reconstruction.");
        return;
      }
      setMode("screenshots");
      setBusy(true);
      setStage("Preparing screenshots locally; removing file metadata");
      const run = ++generation.current;
      try {
        const prepared: ScreenshotInput[] = [];
        for (const item of list) {
          prepared.push(await prepareScreenshot(item));
          if (run !== generation.current) return;
        }
        setImages((previous) => {
          const seen = new Set(previous.map((i) => i.id));
          const unique = prepared.filter((i) => {
            if (seen.has(i.id)) return false;
            seen.add(i.id);
            return true;
          });
          if (unique.length < prepared.length)
            setNote(
              "Identical screenshots were removed locally before any upload.",
            );
          return [...previous, ...unique];
        });
        setImageConsent(false);
      } catch (e) {
        if (run === generation.current) setError((e as Error).message);
      } finally {
        if (run === generation.current) {
          setBusy(false);
          setStage("");
        }
        if (file.current) file.current.value = "";
      }
      return;
    }
    if (list.length !== 1 || !/\.(txt|zip)$/i.test(list[0].name)) {
      setError(
        "Choose one WhatsApp .txt/.zip export, or a group of supported screenshots.",
      );
      return;
    }
    const item = list[0],
      zip = /\.zip$/i.test(item.name);
    if (
      !item.size ||
      item.size > (zip ? IMPORT_LIMITS.archiveBytes : IMPORT_LIMITS.textBytes)
    ) {
      setError(
        `Choose a nonempty ${zip ? "ZIP up to 12 MB" : "text file up to 10 MB"}.`,
      );
      return;
    }
    setMode("export");
    setBusy(true);
    setStage(
      zip
        ? "Inspecting archive paths and expansion limits locally"
        : "Reading text locally",
    );
    const run = ++generation.current;
    try {
      const bytes = await item.arrayBuffer();
      const result = await task({
        kind: zip ? "zip" : "text",
        bytes,
        name: item.name,
        dateOrder,
      });
      if (run !== generation.current) return;
      if (result.archive) {
        setArchive(result.archive);
        setArchiveChoice(result.archive.chats[0].name);
        setNote(
          `${result.archive.chats.length} text export(s) found; ${result.archive.ignored} other archive entries ignored. No archive or media has been uploaded.`,
        );
        if (result.archive.chats.length === 1) {
          const chat = result.archive.chats[0];
          const parsed = await task({
            kind: "text",
            text: chat.text,
            name: `${item.name} / ${chat.name}`,
            dateOrder,
          });
          if (run === generation.current)
            acceptDraft(parsed.draft!, {
              text: chat.text,
              name: `${item.name} / ${chat.name}`,
            });
        }
      } else
        acceptDraft(result.draft!, { text: result.original!, name: item.name });
    } catch (e) {
      if (run === generation.current) setError((e as Error).message);
    } finally {
      if (run === generation.current) {
        setBusy(false);
        setStage("");
      }
      if (file.current) file.current.value = "";
    }
  }
  async function screenshots() {
    if (!imageConsent || !images.length) return;
    setBusy(true);
    setError("");
    const run = ++generation.current;
    const extracted: ScreenshotReading[] = [];
    try {
      for (let index = 0; index < images.length; index++) {
        const image = images[index];
        setStage(
          `Reading screenshot ${index + 1} of ${images.length}; ${index} completed`,
        );
        let reading = completedImages.current.get(image.id);
        if (!reading) {
          const id = requestIds.current.get(image.id) || crypto.randomUUID();
          requestIds.current.set(image.id, id);
          const controller = new AbortController();
          abort.current = controller;
          const timer = setTimeout(() => controller.abort(), 45_000);
          try {
            const response = await fetch("/api/import/screenshots", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestId: id,
                consent: true,
                imageId: image.id,
                image: image.dataUrl,
              }),
              signal: controller.signal,
            });
            const data = await response.json().catch(() => null);
            if (!response.ok)
              throw new Error(
                data?.error ||
                  "Screenshot processing failed. Retry the unfinished image.",
              );
            reading = {
              id: image.id,
              name: image.name,
              extraction: data.extraction,
            };
            completedImages.current.set(image.id, reading);
          } finally {
            clearTimeout(timer);
          }
        }
        if (run !== generation.current) return;
        extracted.push(reading);
        setReadings([...extracted]);
      }
      const next = reconstructScreenshots(extracted, merge);
      acceptDraft(next);
      if (!next.messages.length)
        setError(
          "No readable conversation was found. Review the unreadable-region notes; use a clearer screenshot or paste the text.",
        );
    } catch (e) {
      if (run === generation.current)
        setError(
          (e as Error).name === "AbortError"
            ? "Screenshot processing was interrupted. Completed images are preserved for retry."
            : (e as Error).message,
        );
    } finally {
      if (run === generation.current) {
        setBusy(false);
        setStage("");
      }
    }
  }
  function changeMessage(id: string, patch: Partial<ImportedMessage>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            messages: d.messages.map((m) =>
              m.id === id ? { ...m, ...patch, reviewed: true } : m,
            ),
          }
        : d,
    );
    resetConfirmation();
  }
  function move(id: string, delta: number) {
    setDraft((d) => {
      if (!d) return d;
      const values = [...d.messages],
        at = values.findIndex((m) => m.id === id),
        next = at + delta;
      if (next < 0 || next >= values.length) return d;
      [values[at], values[next]] = [values[next], values[at]];
      return { ...d, messages: values.map((m, index) => ({ ...m, index })) };
    });
    resetConfirmation();
  }
  async function dates(order: DateOrder) {
    setDateOrder(order);
    if (!original || !draft) return;
    setBusy(true);
    setStage("Rechecking timestamp interpretation locally");
    try {
      const next = parseConversation(original.text, original.name, order);
      const lookup = new Map(next.messages.map((m) => [m.id, m]));
      setDraft((d) =>
        d
          ? {
              ...d,
              dateOrder: next.dateOrder,
              warnings: next.warnings,
              messages: d.messages.map((m) => ({
                ...m,
                timestamp: lookup.get(m.id)?.timestamp ?? null,
                uncertainties: [
                  ...m.uncertainties.filter((w) => !w.includes("Date or date")),
                  ...(lookup
                    .get(m.id)
                    ?.uncertainties.filter((w) => w.includes("Date or date")) ??
                    []),
                ],
              })),
            }
          : d,
      );
      resetConfirmation();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStage("");
    }
  }
  function previewRedaction() {
    if (!draft) return;
    const speakers = [...new Set(draft.messages.map((m) => m.sender))].filter(
      (s) => !["System", "Unknown speaker"].includes(s),
    );
    const custom = terms
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 50);
    setRedactionPreview(
      draft.messages.map((message) => {
        let value = redact(message.text).text;
        for (const term of custom) value = value.split(term).join("[REDACTED]");
        if (redactNames)
          for (const [index, speaker] of speakers.entries())
            if (speaker.length >= 3)
              value = value.split(speaker).join(`Participant ${index + 1}`);
        return {
          ...message,
          text: value,
          sender:
            redactNames && speakers.includes(message.sender)
              ? `Participant ${speakers.indexOf(message.sender) + 1}`
              : redact(message.sender).text,
        };
      }),
    );
  }
  async function analyze() {
    if (
      !plan?.messages.length ||
      !draft ||
      !confirmed ||
      (method === "openai" && !consent)
    )
      return;
    setBusy(true);
    setError("");
    const run = ++generation.current;
    const results: Analysis[] = [];
    try {
      for (const [index, segment] of plan.segments.entries()) {
        setStage(
          method === "local"
            ? `Applying local rules to segment ${index + 1} of ${plan.segments.length}`
            : `Analyzing segment ${index + 1} of ${plan.segments.length}; ${index} completed`,
        );
        const hash = fingerprint(
          JSON.stringify({
            method,
            messages: segment.messages,
            model: status?.model,
          }),
        );
        let result = completed.current.get(hash);
        if (!result) {
          if (method === "local") {
            const { buildAnalysis } = await import("../shared/engine");
            result = buildAnalysis(
              segment.messages.map((m, index) => ({ ...m, index })),
            );
          } else {
            const requestId =
              requestIds.current.get(hash) || crypto.randomUUID();
            requestIds.current.set(hash, requestId);
            const controller = new AbortController();
            abort.current = controller;
            const timer = setTimeout(() => controller.abort(), 45_000);
            try {
              const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  kind: "import-segment",
                  requestId,
                  consent: true,
                  messages: segment.messages,
                }),
                signal: controller.signal,
              });
              const data = await response.json().catch(() => null);
              if (!response.ok)
                throw new Error(
                  data?.error ||
                    "The analysis step failed. Retry only the unfinished segment.",
                );
              if (!isAnalysis(data))
                throw new Error(
                  "The server returned an invalid evidence report. No graph was created.",
                );
              result = data;
            } finally {
              clearTimeout(timer);
            }
          }
          completed.current.set(hash, result);
        }
        if (run !== generation.current) return;
        results.push(result);
      }
      setStage("Connecting validated quotations to the TrustGraph");
      const combined = aggregateReport(
        plan.messages,
        results,
        draft.messages.length,
        plan.description,
        draft.warnings,
      );
      setReport(combined);
      setImages([]);
      setArchive(undefined);
      setOriginal(null);
      setReadings([]);
      setDraft(null);
      setText("");
      completed.current.clear();
      completedImages.current.clear();
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (e) {
      if (run === generation.current)
        setError(
          (e as Error).name === "AbortError"
            ? "Analysis was interrupted. Completed segments are preserved; retry resumes without resending them."
            : (e as Error).message,
        );
    } finally {
      if (run === generation.current) {
        setBusy(false);
        setStage("");
      }
    }
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void files([...event.dataTransfer.files]);
  }
  if (report?.imported)
    return (
      <ForensicWorkspace
        initial={report}
        initialTitle={restored?.title}
        onNew={() => {
          setReport(null);
          setNote("");
          setError("");
        }}
      />
    );
  const pages = Math.max(1, Math.ceil((draft?.messages.length || 0) / 20));
  return (
    <>
      <Header app />
      <main id="main" className="import-page">
        <div className="intake-masthead">
          <span className="mono">
            CONVERSATION FORENSICS /{" "}
            {draft ? "RECONSTRUCTION REVIEW" : "SOURCE INTAKE"}
          </span>
          <h1>
            {draft ? (
              <>
                REVIEW THE
                <br />
                CONVERSATION.
              </>
            ) : (
              <>
                UPLOAD A
                <br />
                CONVERSATION.
              </>
            )}
          </h1>
          <p>
            {draft
              ? "The source is yours to correct. Analysis begins only after you confirm the reconstruction and the exact selection."
              : "Import an authorized export or screenshots. Reconstruct the exchange, remove personal details, then follow the evidence."}
          </p>
        </div>
        <ol className="intake-stages mono" aria-label="Investigation stages">
          <li className={!draft ? "active" : "complete"}>01 / Import</li>
          <li className={draft ? "active" : ""}>02 / Review & redact</li>
          <li>03 / Investigate</li>
        </ol>
        <div className="import-feedback" aria-live="polite">
          {busy ? (
            <>
              <span className="stage-mark" aria-hidden="true" />
              <span>{stage}</span>
              <button onClick={cancel}>Stop processing</button>
            </>
          ) : (
            note && <span>{note}</span>
          )}
        </div>
        {error && (
          <p className="import-error" role="alert">
            {error}
          </p>
        )}
        {!draft ? (
          <>
            <section
              className={`intake-field ${dragging ? "drag-active" : ""}`}
              aria-labelledby="source-title"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={drop}
            >
              <div className="intake-tools">
                <h2 id="source-title">Choose your source.</h2>
                <div className="source-switch" aria-label="Import source">
                  {(
                    [
                      ["export", "WhatsApp export"],
                      ["screenshots", "Screenshots"],
                      ["paste", "Paste text"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={mode === value}
                      disabled={busy}
                      onClick={() => {
                        setMode(value);
                        setError("");
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {mode === "paste" ? (
                <div className="paste-intake">
                  <label htmlFor="paste-conversation">
                    Paste the exported conversation or a speaker-labelled
                    transcript
                  </label>
                  <textarea
                    id="paste-conversation"
                    value={text}
                    maxLength={IMPORT_LIMITS.characters}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="[16/10/2026, 09:20] Participant: The original message…"
                    rows={11}
                  />
                  <div className="source-utility">
                    <span>
                      {text.length.toLocaleString()} characters · processed
                      locally first
                    </span>
                    <button
                      className="button primary"
                      disabled={busy || !text.trim()}
                      onClick={() =>
                        void processText(text, "Pasted conversation")
                      }
                    >
                      Reconstruct conversation ↗
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="file-intake">
                    <span className="intake-bracket" aria-hidden="true">
                      [ + ]
                    </span>
                    <div>
                      <h3>
                        {mode === "export"
                          ? "Drop your exported conversation here."
                          : "Drop screenshots in conversation order."}
                      </h3>
                      <p>
                        {mode === "export"
                          ? ".txt or .zip · Text up to 10 MB · ZIP up to 12 MB"
                          : "PNG, JPEG or WebP · Up to eight images · 12 MB per original"}
                      </p>
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => file.current?.click()}
                      >
                        {mode === "export"
                          ? "Choose export"
                          : "Choose screenshots"}{" "}
                        ↗
                      </button>
                    </div>
                  </div>
                  <input
                    ref={file}
                    className="sr-only"
                    tabIndex={-1}
                    type="file"
                    aria-label="Choose conversation source files"
                    accept={
                      mode === "export" ? ".txt,.zip" : ".png,.jpg,.jpeg,.webp"
                    }
                    multiple={mode === "screenshots"}
                    onChange={(e) => void files([...(e.target.files || [])])}
                  />
                </>
              )}
              <p className="intake-privacy">
                Use only conversations you are authorized to share. Remove other
                people’s personal information where possible. Text and archives
                are parsed in this browser. Screenshots are sent to OpenAI only
                after you review and confirm their prepared previews.
              </p>
            </section>
            {archive && archive.chats.length > 1 && (
              <section className="archive-choice">
                <h2>This archive contains more than one text file.</h2>
                <label htmlFor="chat-choice">
                  Choose the conversation to reconstruct
                </label>
                <select
                  id="chat-choice"
                  value={archiveChoice}
                  onChange={(e) => setArchiveChoice(e.target.value)}
                >
                  {archive.chats.map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </select>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => {
                    const chat = archive.chats.find(
                      (c) => c.name === archiveChoice,
                    )!;
                    void processText(chat.text, chat.name);
                  }}
                >
                  Review this conversation ↗
                </button>
              </section>
            )}
            {images.length > 0 && (
              <section
                className="screenshot-intake"
                aria-labelledby="screenshot-title"
              >
                <div className="intake-tools">
                  <div>
                    <span className="mono">
                      PREPARED LOCALLY / {images.length} IMAGES
                    </span>
                    <h2 id="screenshot-title">
                      What the vision model will see.
                    </h2>
                  </div>
                  <span>
                    Drag a rectangle over private details to cover them.
                  </span>
                </div>
                <div className="screenshot-strip">
                  {images.map((image, index) => (
                    <ScreenshotEditor
                      key={image.id}
                      image={image}
                      index={index}
                      total={images.length}
                      disabled={busy}
                      onChange={(value) => {
                        setImages((values) =>
                          values.map((v) => (v.id === image.id ? value : v)),
                        );
                        setImageConsent(false);
                      }}
                      onRemove={() => {
                        setImages((values) =>
                          values.filter((v) => v.id !== image.id),
                        );
                        setImageConsent(false);
                      }}
                      onMove={(delta) => {
                        setImages((values) => {
                          const next = [...values],
                            at = index + delta;
                          [next[index], next[at]] = [next[at], next[index]];
                          return next;
                        });
                        setImageConsent(false);
                      }}
                    />
                  ))}
                </div>
                <p className="small-copy">
                  These metadata-free, locally resized previews are the only
                  images submitted. Original ZIP archives and unrelated media
                  are never uploaded. The model can misread text or speaker
                  labels; mandatory transcript review follows extraction.{" "}
                  {status?.retention}
                </p>
                <label className="intake-consent">
                  <input
                    type="checkbox"
                    checked={imageConsent}
                    disabled={busy}
                    onChange={(e) => setImageConsent(e.target.checked)}
                  />
                  <span>
                    I am authorized to share these {images.length} prepared
                    screenshots and consent to sending them to this server and
                    OpenAI ({status?.visionModel || "checking model"}).
                  </span>
                </label>
                <button
                  className="button primary"
                  disabled={busy || !imageConsent || !status?.configured}
                  onClick={() => void screenshots()}
                >
                  Reconstruct {images.length} screenshot
                  {images.length === 1 ? "" : "s"} ↗
                </button>
                {status && !status.configured && (
                  <p>
                    Vision processing requires the server OpenAI key. You can
                    import a text export instead.
                  </p>
                )}
              </section>
            )}
            <div className="intake-footnote">
              <span className="mono">NO WHATSAPP ACCOUNT ACCESS</span>
              <p>
                We read files you choose. We do not connect to WhatsApp,
                retrieve private chats, visit suspicious links or verify sender
                identities.
              </p>
            </div>
          </>
        ) : (
          <>
            <section className="review-section" aria-labelledby="review-title">
              <div className="intake-tools">
                <div>
                  <span className="mono">
                    USER-REVIEWED TRANSCRIPT /{" "}
                    {draft.messages.length.toLocaleString()} MESSAGES
                  </span>
                  <h2 id="review-title" tabIndex={-1}>
                    The reconstructed exchange.
                  </h2>
                </div>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => {
                    setDraft(null);
                    setOriginal(null);
                    setImages([]);
                    setReadings([]);
                    setArchive(undefined);
                    resetConfirmation();
                  }}
                >
                  Start another import ↗
                </button>
              </div>
              <div className="review-format">
                {original && (
                  <label>
                    Date order{" "}
                    <select
                      value={dateOrder}
                      disabled={busy}
                      onChange={(e) => void dates(e.target.value as DateOrder)}
                    >
                      <option value="auto">
                        Detect; leave ambiguity visible
                      </option>
                      <option value="DMY">Day / month / year</option>
                      <option value="MDY">Month / day / year</option>
                      <option value="YMD">Year / month / day</option>
                    </select>
                  </label>
                )}
                {readings.length > 1 && (
                  <label>
                    <input
                      type="checkbox"
                      checked={merge}
                      disabled={busy}
                      onChange={(e) => {
                        setMerge(e.target.checked);
                        acceptDraft(
                          reconstructScreenshots(readings, e.target.checked),
                        );
                      }}
                    />{" "}
                    Merge probable screenshot overlaps (rebuilds transcript)
                  </label>
                )}
                <span>
                  Original order is preserved unless you move a message. No
                  timezone is inferred.
                </span>
              </div>
              {draft.warnings.length > 0 && (
                <details className="parse-warnings" open>
                  <summary>
                    {draft.warnings.length} reconstruction note
                    {draft.warnings.length === 1 ? "" : "s"}
                  </summary>
                  <ul>
                    {draft.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="review-pagination">
                <span>
                  Messages{" "}
                  {draft.messages.length
                    ? Math.min(page * 20 + 1, draft.messages.length)
                    : 0}
                  –{Math.min((page + 1) * 20, draft.messages.length)} of{" "}
                  {draft.messages.length.toLocaleString()}
                </span>
                <div>
                  <button
                    disabled={page <= 0 || busy}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous page
                  </button>
                  <button
                    disabled={page >= pages - 1 || busy}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next page
                  </button>
                </div>
              </div>
              <ol className="message-review">
                {draft.messages
                  .slice(page * 20, (page + 1) * 20)
                  .map((message, offset) => (
                    <li
                      key={message.id}
                      className={
                        selected.has(message.id) ? "included" : "not-included"
                      }
                    >
                      <div className="review-message-meta">
                        <span className="mono">
                          {String(page * 20 + offset + 1).padStart(3, "0")} /{" "}
                          {message.kind.toUpperCase()}
                        </span>
                        <span>
                          {selected.has(message.id)
                            ? "In analysis selection"
                            : "Outside current selection"}
                        </span>
                        <span className="source-reference">
                          {message.sources
                            .map((s) =>
                              s.kind === "text"
                                ? `${s.name} · lines ${s.firstLine}–${s.lastLine}`
                                : `${s.name} · image region`,
                            )
                            .join(" / ")}
                        </span>
                      </div>
                      <div className="review-message-fields">
                        <label>
                          Speaker
                          <input
                            value={message.sender}
                            maxLength={120}
                            disabled={busy}
                            onChange={(e) =>
                              changeMessage(message.id, {
                                sender: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Visible timestamp
                          <input
                            value={message.timestampLabel || ""}
                            maxLength={100}
                            disabled={busy}
                            placeholder="Not supplied"
                            onChange={(e) =>
                              changeMessage(message.id, {
                                timestampLabel: e.target.value || null,
                                timestamp: null,
                              })
                            }
                          />
                        </label>
                        <label className="review-message-text">
                          Message text
                          <textarea
                            value={message.text}
                            rows={Math.min(
                              6,
                              Math.max(2, message.text.split("\n").length),
                            )}
                            disabled={busy}
                            onChange={(e) =>
                              changeMessage(message.id, {
                                text: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      {message.uncertainties.length > 0 && (
                        <ul className="message-uncertainty">
                          {message.uncertainties.map((u, i) => (
                            <li key={i}>
                              <span>{u}</span>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  changeMessage(message.id, {
                                    uncertainties: message.uncertainties.filter(
                                      (_, at) => at !== i,
                                    ),
                                  })
                                }
                              >
                                Mark resolved
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="message-review-actions">
                        <span className="mono" title={message.id}>
                          {message.id}
                        </span>
                        <button
                          aria-label={`Move earlier ↑: message ${page * 20 + offset + 1}`}
                          disabled={busy || page * 20 + offset === 0}
                          onClick={() => move(message.id, -1)}
                        >
                          Move earlier ↑
                        </button>
                        <button
                          aria-label={`Move later ↓: message ${page * 20 + offset + 1}`}
                          disabled={
                            busy ||
                            page * 20 + offset === draft.messages.length - 1
                          }
                          onClick={() => move(message.id, 1)}
                        >
                          Move later ↓
                        </button>
                        <button
                          aria-label={`Remove message ${page * 20 + offset + 1}`}
                          disabled={busy}
                          onClick={() => {
                            setDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    messages: d.messages
                                      .filter((m) => m.id !== message.id)
                                      .map((m, index) => ({ ...m, index })),
                                  }
                                : d,
                            );
                            setPage((p) =>
                              Math.min(
                                p,
                                Math.max(
                                  0,
                                  Math.ceil((draft.messages.length - 1) / 20) -
                                    1,
                                ),
                              ),
                            );
                            resetConfirmation();
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
              </ol>
            </section>
            <section
              className="redaction-workbench"
              aria-labelledby="redaction-title"
            >
              <div>
                <span className="mono">LOCAL PRIVACY PASS</span>
                <h2 id="redaction-title">
                  Keep the meaning.
                  <br />
                  <em>Remove the identifiers.</em>
                </h2>
                <p>
                  Preview common phone, email and identifier redactions locally.
                  Detection is incomplete; edit any remaining private details in
                  the transcript. Replacing names can remove useful authority
                  context.
                </p>
              </div>
              <div>
                <label className="intake-consent">
                  <input
                    type="checkbox"
                    checked={redactNames}
                    disabled={busy}
                    onChange={(e) => {
                      setRedactNames(e.target.checked);
                      setRedactionPreview(null);
                    }}
                  />
                  <span>
                    Replace speaker names and their exact mentions with
                    participant labels
                  </span>
                </label>
                <label htmlFor="redact-terms">
                  Additional names or sensitive terms, one per line
                </label>
                <textarea
                  id="redact-terms"
                  value={terms}
                  rows={3}
                  maxLength={2000}
                  disabled={busy}
                  onChange={(e) => {
                    setTerms(e.target.value);
                    setRedactionPreview(null);
                  }}
                />
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={previewRedaction}
                >
                  Preview local redaction ↗
                </button>
              </div>
              {redactionPreview && (
                <div className="redaction-preview">
                  <h3>
                    Local preview ·{" "}
                    {
                      redactionPreview.filter(
                        (m, i) =>
                          m.text !== draft.messages[i].text ||
                          m.sender !== draft.messages[i].sender,
                      ).length
                    }{" "}
                    messages changed
                  </h3>
                  <div>
                    {redactionPreview
                      .filter(
                        (m, i) =>
                          m.text !== draft.messages[i].text ||
                          m.sender !== draft.messages[i].sender,
                      )
                      .slice(0, 10)
                      .map((m) => (
                        <blockquote key={m.id}>
                          <strong>{m.sender}</strong>
                          <p>{m.text}</p>
                        </blockquote>
                      ))}
                  </div>
                  <p>
                    Preview shows the first ten changed messages; applying
                    updates all reconstructed messages. Nothing is sent by this
                    action.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => {
                      setDraft((d) =>
                        d ? { ...d, messages: redactionPreview } : d,
                      );
                      resetConfirmation();
                      setTerms("");
                      setNote(
                        "Redaction applied locally. Review the updated selection before confirming analysis.",
                      );
                    }}
                  >
                    Apply redaction
                  </button>
                  <button onClick={() => setRedactionPreview(null)}>
                    Discard preview
                  </button>
                </div>
              )}
            </section>
            <section className="analysis-intake" aria-labelledby="scope-title">
              <div>
                <span className="mono">ANALYSIS SCOPE / EXPLICIT BUDGET</span>
                <h2 id="scope-title">
                  Decide what
                  <br />
                  <em>leaves this browser.</em>
                </h2>
                <p>
                  Up to 180 messages, 72,000 characters and six chronological
                  segments. Each request includes at most 36 messages and 14,000
                  characters, including a small amount of earlier context. No
                  unlimited history is sent.
                </p>
              </div>
              <div className="scope-controls">
                <label>
                  Selection method
                  <select
                    value={selection}
                    disabled={busy}
                    onChange={(e) => {
                      setSelection(e.target.value as typeof selection);
                      resetConfirmation();
                    }}
                  >
                    <option value="all">
                      Chronological conversation within budget
                    </option>
                    <option value="relevant">
                      Relevant-message windows with surrounding context
                    </option>
                    <option value="range">Choose a source-message range</option>
                  </select>
                </label>
                {selection === "range" && (
                  <div className="range-controls">
                    <label>
                      First message
                      <input
                        type="number"
                        min={1}
                        max={draft.messages.length}
                        value={range[0]}
                        disabled={busy}
                        onChange={(e) => {
                          setRange([
                            Math.max(1, Number(e.target.value)),
                            range[1],
                          ]);
                          resetConfirmation();
                        }}
                      />
                    </label>
                    <label>
                      Last message
                      <input
                        type="number"
                        min={range[0]}
                        max={draft.messages.length}
                        value={range[1]}
                        disabled={busy}
                        onChange={(e) => {
                          setRange([
                            range[0],
                            Math.max(range[0], Number(e.target.value)),
                          ]);
                          resetConfirmation();
                        }}
                      />
                    </label>
                  </div>
                )}
                <div className="coverage-readout">
                  <strong>
                    {plan?.messages.length.toLocaleString()}{" "}
                    <span>
                      / {draft.messages.length.toLocaleString()} messages
                      selected
                    </span>
                  </strong>
                  <span>
                    {plan?.segments.length} segment
                    {plan?.segments.length === 1 ? "" : "s"} ·{" "}
                    {plan?.characters.toLocaleString()} message characters
                  </span>
                  {plan?.partial && (
                    <p className="partial-coverage">
                      Partial coverage: {plan.excluded.toLocaleString()}{" "}
                      messages will not be analyzed. Conclusions apply only to
                      the submitted selection.
                    </p>
                  )}
                  <p>{plan?.description}</p>
                </div>
                <fieldset className="import-method">
                  <legend>Analysis method</legend>
                  <label>
                    <input
                      type="radio"
                      name="forensic-method"
                      checked={method === "openai"}
                      disabled={busy}
                      onChange={() => {
                        setMethod("openai");
                        resetConfirmation();
                      }}
                    />
                    OpenAI structured evidence ·{" "}
                    {status?.model || "checking model"}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="forensic-method"
                      checked={method === "local"}
                      disabled={busy}
                      onChange={() => {
                        setMethod("local");
                        resetConfirmation();
                      }}
                    />
                    Local rules only · no external text processing
                  </label>
                </fieldset>
              </div>
              <details className="submission-preview">
                <summary>
                  Inspect the exact message packets{" "}
                  {method === "openai"
                    ? "to be submitted"
                    : "for local analysis"}
                </summary>
                <p>
                  Message IDs, sender labels, message text and source order
                  below are the conversation data sent to the analysis endpoint.
                  Original files, screenshots and source filenames are excluded
                  from text-analysis packets.
                </p>
                {plan?.segments.map((segment, index) => (
                  <details key={index}>
                    <summary>
                      Segment {index + 1} · {segment.messages.length} messages,
                      including context
                    </summary>
                    <pre>{JSON.stringify(segment.messages, null, 2)}</pre>
                  </details>
                ))}
              </details>
              <div className="analysis-confirmation">
                <label className="intake-consent">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>
                    I reviewed the message text, speaker labels, order,
                    uncertain regions and analysis selection.
                  </span>
                </label>
                {method === "openai" && (
                  <>
                    <label className="intake-consent">
                      <input
                        type="checkbox"
                        checked={consent}
                        disabled={busy}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <span>
                        I am authorized to share the selected messages and
                        consent to sending these exact message packets to this
                        server and OpenAI ({status?.model || "checking model"}).
                      </span>
                    </label>
                    <p>
                      {status?.retention} OpenAI requests use store: false;
                      provider retention policies may still apply. No model
                      tools or link visits are enabled.
                    </p>
                  </>
                )}
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !confirmed ||
                    !plan?.messages.length ||
                    (method === "openai" && (!consent || !status?.configured))
                  }
                  onClick={() => void analyze()}
                >
                  {method === "openai"
                    ? "Investigate selected conversation"
                    : "Run local checks"}{" "}
                  <span aria-hidden="true">↗</span>
                </button>
                {method === "openai" && status && !status.configured && (
                  <p>
                    OpenAI is not configured on this server. Review locally or
                    use the clearly labelled local-rules option.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

function ScreenshotEditor({
  image,
  index,
  total,
  disabled,
  onChange,
  onMove,
  onRemove,
}: {
  image: ScreenshotInput;
  index: number;
  total: number;
  disabled: boolean;
  onChange: (image: ScreenshotInput) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const element = useRef<HTMLImageElement>(null);
  const start = useRef<[number, number] | null>(null);
  const [masking, setMasking] = useState(false);
  const [rectangle, setRectangle] = useState<
    [number, number, number, number] | null
  >(null);
  const [keyboardMask, setKeyboardMask] = useState({
    x: 0,
    y: 0,
    width: 30,
    height: 15,
  });
  const point = (e: PointerEvent) => {
    const box = element.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
      Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
    ] as [number, number];
  };
  function apply(rect: [number, number, number, number]) {
    if (disabled || !element.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(element.current, 0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111111";
    context.fillRect(
      rect[0] * canvas.width,
      rect[1] * canvas.height,
      rect[2] * canvas.width,
      rect[3] * canvas.height,
    );
    const dataUrl = canvas.toDataURL("image/webp", 0.9);
    onChange({
      ...image,
      dataUrl,
      id: `img-${fingerprint(dataUrl)}`,
      masked: true,
    });
    setRectangle(null);
  }
  return (
    <article className="screenshot-editor">
      <div className="screenshot-order mono">
        <span>IMAGE {String(index + 1).padStart(2, "0")}</span>
        <span>
          {image.width} × {image.height}
        </span>
      </div>
      <div
        className={`screenshot-mask-surface${masking ? " masking" : ""}`}
        onPointerDown={(e) => {
          if (disabled || !masking) return;
          start.current = point(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const end = point(e),
            [x, y] = start.current;
          setRectangle([
            Math.min(x, end[0]),
            Math.min(y, end[1]),
            Math.abs(x - end[0]),
            Math.abs(y - end[1]),
          ]);
        }}
        onPointerUp={(e) => {
          if (!start.current) return;
          const end = point(e),
            [x, y] = start.current;
          start.current = null;
          const rect: [number, number, number, number] = [
            Math.min(x, end[0]),
            Math.min(y, end[1]),
            Math.abs(x - end[0]),
            Math.abs(y - end[1]),
          ];
          if (rect[2] > 0.005 && rect[3] > 0.005) apply(rect);
        }}
        onPointerCancel={() => {
          start.current = null;
          setRectangle(null);
        }}
      >
        <img
          ref={element}
          src={image.dataUrl}
          alt={`Prepared screenshot ${index + 1}: ${image.name}`}
          draggable={false}
        />
        {rectangle && (
          <span
            className="mask-preview"
            style={{
              left: `${rectangle[0] * 100}%`,
              top: `${rectangle[1] * 100}%`,
              width: `${rectangle[2] * 100}%`,
              height: `${rectangle[3] * 100}%`,
            }}
          />
        )}
      </div>
      <span className="screenshot-filename">
        {image.name}
        {image.masked ? " · redacted locally" : ""}
      </span>
      <button
        disabled={disabled}
        aria-pressed={masking}
        onClick={() => setMasking((v) => !v)}
      >
        {masking
          ? "Finish rectangle redaction"
          : "Redact rectangles by dragging"}
      </button>
      <details className="keyboard-mask">
        <summary>Redact using coordinates</summary>
        <p>Percent of image width and height, measured from the top left.</p>
        {(["x", "y", "width", "height"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              type="number"
              min={0}
              max={100}
              value={keyboardMask[key]}
              disabled={disabled}
              onChange={(e) =>
                setKeyboardMask((m) => ({
                  ...m,
                  [key]: Math.max(0, Math.min(100, Number(e.target.value))),
                }))
              }
            />
          </label>
        ))}
        <button
          disabled={disabled}
          onClick={() =>
            apply([
              keyboardMask.x / 100,
              keyboardMask.y / 100,
              keyboardMask.width / 100,
              keyboardMask.height / 100,
            ])
          }
        >
          Cover rectangle
        </button>
      </details>
      <div className="screenshot-actions">
        <button disabled={disabled || index === 0} onClick={() => onMove(-1)}>
          Earlier ↑
        </button>
        <button
          disabled={disabled || index === total - 1}
          onClick={() => onMove(1)}
        >
          Later ↓
        </button>
        <button disabled={disabled} onClick={onRemove}>
          Remove image
        </button>
      </div>
    </article>
  );
}
