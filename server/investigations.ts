import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { Router, json } from "express";
import { z } from "zod";
import { buildAnalysis, parseMessages } from "../shared/engine.js";
import { extractionSchema } from "../shared/schema.js";
import { baseMessageSchema, importMetadataSchema } from "../shared/import.js";
import {
  currentUser,
  sameOrigin,
  withinLimit,
  authUnavailable,
  type AuthRuntime,
} from "./auth.js";

const legacySaveSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    text: z.string().min(8).max(18_000),
    extraction: extractionSchema.optional(),
    model: z.string().min(1).max(80).optional(),
    analyzedAt: z.iso.datetime(),
  })
  .strict()
  .refine((v) => Boolean(v.extraction) === Boolean(v.model));
const importedSaveSchema = z
  .object({
    kind: z.literal("imported"),
    title: z.string().trim().min(1).max(120),
    messages: z.array(baseMessageSchema).min(1).max(180),
    imported: importMetadataSchema,
    extraction: extractionSchema.optional(),
    model: z.string().min(1).max(80).optional(),
    analyzedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const ids = v.messages.map((m) => m.id),
      all = new Set(ids);
    if (
      all.size !== ids.length ||
      v.messages.reduce((n, m) => n + m.text.length, 0) > 72_000 ||
      v.imported.totalMessages < ids.length ||
      JSON.stringify(ids) !== JSON.stringify(v.imported.analyzedIds) ||
      Object.keys(v.imported.sources).length !== ids.length ||
      ids.some((id) => !v.imported.sources[id]) ||
      (v.extraction?.findings.length ?? 0) > 120 ||
      Boolean(v.extraction) !== Boolean(v.model)
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid imported report boundaries or source references.",
      });
    for (const s of v.imported.summaries)
      if (
        !s.summary.evidence.length ||
        s.summary.evidence.some(
          (e) =>
            e.quote.trim().length < 3 ||
            !v.messages.some(
              (m) => m.id === e.messageId && m.text.includes(e.quote),
            ),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Summary evidence is not in the reviewed source.",
        });
  });
const saveSchema = z.union([legacySaveSchema, importedSaveSchema]);

export function investigationRoutes(auth: AuthRuntime) {
  const router = Router();
  router.use(async (req, res, next) => {
    if (!auth.ready) {
      authUnavailable(res);
      return;
    }
    try {
      const user = await currentUser(req, auth);
      if (!user) {
        res.status(401).json({
          error:
            "Your session has ended. Sign in to access saved investigations.",
        });
        return;
      }
      const writing = req.method !== "GET";
      if (writing && !sameOrigin(req, auth)) {
        res.status(403).json({
          error: "This request must come from your investigation workspace.",
        });
        return;
      }
      if (
        !(await withinLimit(
          auth,
          `history:${writing ? "write" : "read"}:${user.id}`,
          writing ? 20 : 120,
        ))
      ) {
        res.setHeader("Retry-After", "60");
        res
          .status(429)
          .json({ error: "Request limit reached. Wait one minute and retry." });
        return;
      }
      res.locals.user = user;
      next();
    } catch {
      res.status(503).json({
        error:
          "Saved investigations are temporarily unavailable. Retry in a moment.",
      });
    }
  });
  router.use(json({ limit: "2mb" }));
  router.get("/", async (_req, res) => {
    try {
      const result = await auth.pool!.query(
        `SELECT id, title, created_at, analysis->'assessment'->>'label' AS assessment
        FROM investigations WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 101`,
        [res.locals.user.id],
      );
      res.json({
        investigations: result.rows.slice(0, 100),
        hasMore: result.rows.length > 100,
      });
    } catch {
      res
        .status(503)
        .json({ error: "History could not be loaded. Please retry." });
    }
  });
  router.post("/", async (req, res) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          "The saved report is invalid. Run the analysis again before saving.",
      });
      return;
    }
    const { title, extraction, model, analyzedAt } = parsed.data;
    const importing = "kind" in parsed.data ? parsed.data : null;
    const text = importing
      ? importing.messages.map((m) => `${m.sender}: ${m.text}`).join("\n")
      : "text" in parsed.data
        ? parsed.data.text
        : "";
    if (
      extraction &&
      (extraction.findings.length > (importing ? 120 : 14) ||
        JSON.stringify(extraction).length > (importing ? 300_000 : 100_000))
    ) {
      res
        .status(400)
        .json({ error: "This report exceeds the supported evidence limit." });
      return;
    }
    let analysis;
    try {
      analysis = buildAnalysis(
        importing
          ? importing.messages.map((m, index) => ({ ...m, index }))
          : parseMessages(text),
        extraction,
        model,
      );
      if (analysis.provenance.rejectedFindings)
        throw new Error("Invalid quotations");
      analysis.provenance.analyzedAt = analyzedAt;
      if (importing) analysis.imported = importing.imported;
    } catch {
      res.status(400).json({
        error:
          "The source messages and evidence do not match. Run the analysis again.",
      });
      return;
    }
    let client: PoolClient | undefined;
    try {
      client = await auth.pool!.connect();
      await client.query("BEGIN");

      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        res.locals.user.id,
      ]);
      const count = await client.query(
        "SELECT COUNT(*) AS total FROM investigations WHERE user_id=$1",
        [res.locals.user.id],
      );
      if (Number(count.rows[0].total) >= 100) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error:
            "Your archive contains 100 investigations. Delete an older investigation before saving another.",
        });
        return;
      }
      const result = await client.query(
        `INSERT INTO investigations (id,user_id,title,source_text,analysis) VALUES ($1,$2,$3,$4,$5)
        RETURNING id, title, created_at`,
        [
          randomUUID(),
          res.locals.user.id,
          title,
          text,
          JSON.stringify(analysis),
        ],
      );
      await client.query("COMMIT");
      res.status(201).json(result.rows[0]);
    } catch {
      await client?.query("ROLLBACK").catch(() => {});
      res.status(503).json({
        error:
          "The investigation could not be saved. Your report is still available on this page.",
      });
    } finally {
      client?.release();
    }
  });
  router.use("/:id", (req, res, next) => {
    if (!z.uuid().safeParse(req.params.id).success) {
      res.status(404).json({ error: "Investigation not found." });
      return;
    }
    next();
  });
  router.get("/:id", async (req, res) => {
    try {
      const result = await auth.pool!.query(
        "SELECT id,title,source_text,analysis,created_at FROM investigations WHERE id=$1 AND user_id=$2",
        [req.params.id, res.locals.user.id],
      );
      if (!result.rows[0]) {
        res.status(404).json({ error: "Investigation not found." });
        return;
      }
      res.json(result.rows[0]);
    } catch {
      res.status(503).json({
        error: "This investigation could not be loaded. Please retry.",
      });
    }
  });
  router.delete("/:id", async (req, res) => {
    try {
      const result = await auth.pool!.query(
        "DELETE FROM investigations WHERE id=$1 AND user_id=$2 RETURNING id",
        [req.params.id, res.locals.user.id],
      );
      if (!result.rowCount) {
        res.status(404).json({ error: "Investigation not found." });
        return;
      }
      res.status(204).end();
    } catch {
      res.status(503).json({
        error: "This investigation could not be deleted. Please retry.",
      });
    }
  });
  router.patch("/:id", async (req, res) => {
    const parsed = z
      .object({ title: z.string().trim().min(1).max(120) })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Use a title between 1 and 120 characters." });
      return;
    }
    try {
      const result = await auth.pool!.query(
        "UPDATE investigations SET title=$1 WHERE id=$2 AND user_id=$3 RETURNING id,title",
        [parsed.data.title, req.params.id, res.locals.user.id],
      );
      if (!result.rowCount) {
        res.status(404).json({ error: "Investigation not found." });
        return;
      }
      res.json(result.rows[0]);
    } catch {
      res.status(503).json({
        error: "The investigation could not be renamed. Please retry.",
      });
    }
  });
  return router;
}
