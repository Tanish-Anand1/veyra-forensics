import { PGlite } from "@electric-sql/pglite";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type pg from "pg";
import express from "express";
import { customFetch } from "@auth/express";
import type { OAuthConfig } from "@auth/core/providers";
import { createAuth } from "../server/auth";
import { createApp } from "../server/app";
import type { ImportAI } from "../server/import-ai";

export async function authFixture(importAI?: ImportAI) {
  const database = new PGlite();
  await database.exec(await readFile("migrations/001_auth.sql", "utf8"));
  const query = async (sql: string, params?: unknown[]) => {
    const result = await database.query(sql, params);
    return {
      ...result,
      rowCount: /^\s*(SELECT|WITH)\b/i.test(sql)
        ? result.rows.length
        : (result.affectedRows ?? result.rows.length),
    };
  };
  const pool = {
    query,
    async connect() {
      return { query, release() {} };
    },
  } as unknown as pg.Pool;
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const state = { cancel: false, fail: false, subject: "investigator" };
  const codes = new Map<string, { challenge: string; subject: string }>();
  const provider = (id: string): OAuthConfig<Record<string, string>> => ({
    id,
    name: id === "google" ? "Google" : "GitHub",
    type: "oauth",
    clientId: `test-${id}`,
    clientSecret: `test-${id}-secret`,
    authorization: {
      url: `${origin}/mock-provider/${id}`,
      params: { scope: "" },
    },
    token: `${origin}/mock-token/${id}`,
    userinfo: {
      url: `${origin}/mock-user`,
      request: async ({ tokens }: { tokens: { access_token?: string } }) => ({
        id: codes.get(tokens.access_token!)!.subject,
      }),
    },
    checks: ["state", "pkce"],
    profile: (p) => ({
      id: `${id}-${p.id}`,
      name: `${id === "google" ? "Google" : "GitHub"} Investigator`,
      email: null,
      image: null,
    }),
    async [customFetch](_input, init) {
      const params = new URLSearchParams(String(init?.body));
      const code = params.get("code")!;
      const authorization = codes.get(code);
      if (
        state.fail ||
        !authorization ||
        createHash("sha256")
          .update(params.get("code_verifier") || "")
          .digest("base64url") !== authorization.challenge
      )
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({ access_token: code, token_type: "bearer" });
    },
  });
  const auth = createAuth({
    pool,
    origin,
    secret: "test-only-browser-secret-at-least-32-characters",
    providers: [provider("google"), provider("github")],
  });
  const app = createApp({ auth, importAI });
  app.get("/mock-provider/:provider", (req, res) => {
    const callback = new URL(
      `/api/auth/callback/${req.params.provider}`,
      origin,
    );
    callback.searchParams.set("state", String(req.query.state));
    if (state.cancel) {
      state.cancel = false;
      callback.searchParams.set("error", "access_denied");
    } else {
      const code = randomUUID();
      codes.set(code, {
        challenge: String(req.query.code_challenge),
        subject: state.subject,
      });
      callback.searchParams.set("code", code);
    }
    res.redirect(callback.href);
  });
  app.use(express.static("dist"));
  app.use((_req, res) => res.sendFile("index.html", { root: "dist" }));
  server.on("request", app);
  return {
    origin,
    state,
    database,
    async close() {
      const closed = new Promise<void>((resolve) =>
        server.close(() => resolve()),
      );

      server.closeAllConnections();
      await closed;
      await database.close();
    },
  };
}
