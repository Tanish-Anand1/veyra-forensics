import { randomUUID, createHmac } from "node:crypto";
import { Router, json, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import sharp from "sharp";
import {
  importAI,
  segmentSchema,
  visionRequestSchema,
  providerError,
  forensicModel,
  visionModel,
  type ImportAI,
  ImportError,
} from "./import-ai.js";

type Cached = {
  hash: string;
  expires: number;
  promise: Promise<unknown>;
  timer: ReturnType<typeof setTimeout>;
};
export function importService(ai: ImportAI = importAI) {
  const cache = new Map<string, Cached>();
  const secret =
    process.env.AUTH_SECRET || process.env.OPENAI_API_KEY || randomUUID();
  const digest = (value: string) =>
    createHmac("sha256", secret).update(value).digest("hex");
  const owner = (req: Request) =>
    req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("cb-import="))
      ?.slice(10);
  const sameSite = (req: Request) => {
    try {
      const url = new URL(req.headers.origin || "");
      return (
        url.host === req.get("host") &&
        req.headers["sec-fetch-site"] !== "cross-site"
      );
    } catch {
      return false;
    }
  };
  async function once(
    req: Request,
    id: string,
    payload: unknown,
    run: () => Promise<unknown>,
  ) {
    const client = owner(req);
    if (!client || !/^[a-f0-9-]{36}$/.test(client))
      throw new ImportError(
        400,
        "Refresh the import page to establish a private processing session.",
      );
    if (!sameSite(req))
      throw new ImportError(
        403,
        "Return to the import page before submitting this request.",
      );
    const now = Date.now();
    for (const [key, value] of cache)
      if (value.expires <= now) {
        clearTimeout(value.timer);
        cache.delete(key);
      }
    const key = digest(`${client}:${id}`),
      hash = digest(JSON.stringify(payload));
    const existing = cache.get(key);
    if (existing) {
      if (existing.hash !== hash)
        throw new ImportError(
          409,
          "This processing request was already used for different content. Review and start a new request.",
        );
      return existing.promise;
    }
    if (cache.size >= 32)
      throw new ImportError(
        503,
        "The processing queue is full. Your source is still available; retry shortly.",
      );
    const promise = run().catch((error) => {
      clearTimeout(cache.get(key)?.timer);
      cache.delete(key);
      throw error;
    });
    const timer = setTimeout(() => cache.delete(key), 5 * 60_000);
    timer.unref();
    cache.set(key, { hash, expires: now + 5 * 60_000, promise, timer });
    return promise;
  }
  async function segment(req: Request, res: Response) {
    const parsed = segmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          "Confirm the reviewed text and submit a bounded segment with unique source message IDs.",
      });
      return;
    }
    try {
      res.json(
        await once(req, parsed.data.requestId, parsed.data, () =>
          ai.analyze(parsed.data),
        ),
      );
    } catch (error) {
      const safe = providerError(error);
      res.status(safe.status).json({ error: safe.message });
    }
  }
  const router = Router();
  router.get("/status", (req, res) => {
    if (!/^[a-f0-9-]{36}$/.test(owner(req) || ""))
      res.cookie("cb-import", randomUUID(), {
        httpOnly: true,
        secure:
          (process.env.NODE_ENV === "production" &&
            Boolean(process.env.VERCEL)) ||
          req.secure,
        sameSite: "strict",
        path: "/",
        maxAge: 15 * 60_000,
      });
    res.json({
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: forensicModel(),
      visionModel: visionModel(),
      limits: {
        screenshots: 8,
        selectedMessages: 180,
        selectedCharacters: 72000,
        segments: 6,
      },
      retention:
        "Requests and results may be held in server memory for up to five minutes to prevent duplicate processing. Original archives are never uploaded.",
    });
  });
  router.use(
    "/screenshots",
    rateLimit({
      windowMs: 60_000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error:
          "Screenshot request limit reached. Wait one minute; completed reconstructions remain available.",
      },
    }),
  );
  router.post("/screenshots", json({ limit: "1400kb" }), async (req, res) => {
    const parsed = visionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          "Confirm the prepared screenshot preview before uploading one valid image (at most 1 MB).",
      });
      return;
    }
    try {
      const result = await once(
        req,
        parsed.data.requestId,
        parsed.data,
        async () => {
          const bytes = Buffer.from(parsed.data.image.split(",")[1], "base64");
          let prepared: Buffer;
          try {
            const input = sharp(bytes, {
              limitInputPixels: 16_000_000,
              failOn: "error",
            });
            const metadata = await input.metadata();
            if (
              metadata.format !== "webp" ||
              !metadata.width ||
              !metadata.height ||
              metadata.width < 20 ||
              metadata.height < 20 ||
              Math.max(metadata.width, metadata.height) > 1800 ||
              (metadata.pages && metadata.pages > 1)
            )
              throw new Error("Unsupported image");
            prepared = await input.webp({ lossless: true }).toBuffer();
          } catch {
            throw new ImportError(
              400,
              "The prepared screenshot is malformed, animated or exceeds the image limits.",
            );
          }
          return {
            imageId: parsed.data.imageId,
            model: visionModel(),
            extraction: await ai.readScreenshot({
              ...parsed.data,
              image: `data:image/webp;base64,${prepared.toString("base64")}`,
            }),
          };
        },
      );
      res.json(result);
    } catch (error) {
      const safe = providerError(error);
      res.status(safe.status).json({ error: safe.message });
    }
  });
  return { router, segment };
}
