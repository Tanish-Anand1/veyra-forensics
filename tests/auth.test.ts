import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import type pg from "pg";
import { generateKeyPair, SignJWT } from "jose";
import { customFetch } from "@auth/express";
import Google from "@auth/express/providers/google";
import GitHub from "@auth/express/providers/github";
import { createAuth, googleProfile, githubProfile } from "../server/auth";
import { createApp } from "../server/app";
import { safeDestination, profileImage } from "../shared/auth";
import { parseConversation } from "../shared/import";
import { aggregateReport, selectMessages } from "../shared/selection";
import { buildAnalysis } from "../shared/engine";
import { androidExport } from "./forensics-fixtures";

test("redirect and profile boundaries reject unsafe inputs", () => {
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/api/auth/signout",
    "/history?next=https://evil.test",
    "%2f%2fevil.test",
    "/analyze\r\nLocation:evil",
  ])
    assert.equal(safeDestination(value), "/history");
  assert.equal(safeDestination("/analyze?resume=1"), "/analyze?resume=1");
  assert.equal(profileImage("https://evil.test/pixel"), null);
  assert.equal(
    profileImage("https://avatars.githubusercontent.com@evil.test/x"),
    null,
  );
  assert.equal(
    googleProfile({
      sub: "a",
      email: "unverified@example.test",
      email_verified: false,
    }).email,
    null,
  );
  assert.equal(
    googleProfile({
      sub: "a",
      email: "verified@example.test",
      email_verified: true,
    }).email,
    "verified@example.test",
  );
  assert.equal(githubProfile({ id: 1, login: "user" }).email, null);
  const secure = createAuth({
    origin: "https://chainbreak-zero.vercel.app",
    secret: "test-only-configuration-secret-32-characters",
  });
  assert.equal(secure.cookieName, "__Secure-authjs.session-token");
  assert.equal(secure.config.cookies!.sessionToken!.options!.secure, true);
});

test("Auth.js Google OIDC and GitHub code flows, sessions, ownership, expiry and failures", async () => {
  const db = new PGlite();
  await db.exec(await readFile("migrations/001_auth.sql", "utf8"));
  const query = async (sql: string, params?: unknown[]) => {
    const result = await db.query(sql, params);
    return {
      ...result,
      rowCount: /^\s*(SELECT|WITH)\b/i.test(sql)
        ? result.rows.length
        : (result.affectedRows ?? result.rows.length),
    };
  };
  const pool = {
    query,
    async end() {
      await db.close();
    },
    async connect() {
      return { query, release() {} };
    },
  } as unknown as pg.Pool;
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const { privateKey } = await generateKeyPair("RS256");
  let subject = "google-first",
    nonce = "",
    failToken = false,
    verified = true;
  const exchanges: {
    provider: string;
    verifier: string | null;
    challenge: string;
  }[] = [];
  let challenge = "";
  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes(".well-known"))
      return Response.json({
        issuer: "https://accounts.google.com",
        authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        token_endpoint: "https://oauth2.googleapis.com/token",
        userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
        jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
      });
    if (url.includes("/token") || url.includes("/access_token")) {
      const form = new URLSearchParams(String(init?.body));
      exchanges.push({
        provider: url.includes("github") ? "github" : "google",
        verifier: form.get("code_verifier"),
        challenge,
      });
      if (failToken)
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      const idToken = await new SignJWT({
        nonce,
        name: "Test Investigator",
        email: "google-first@example.test",
        email_verified: verified,
        picture: "https://lh3.googleusercontent.com/test",
      })
        .setProtectedHeader({ alg: "RS256" })
        .setSubject(subject)
        .setAudience("test-google")
        .setIssuer("https://accounts.google.com")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      return Response.json({
        access_token: "test-provider-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        ...(url.includes("github") ? {} : { id_token: idToken }),
      });
    }
    throw new Error("Unexpected provider request");
  };
  const auth = createAuth({
    pool,
    origin,
    secret: "test-only-secret-with-at-least-32-characters",
    providers: [
      Google({
        clientId: "test-google",
        clientSecret: "test-google-secret",
        checks: ["pkce", "state", "nonce"],
        profile: googleProfile,
        [customFetch]: mockFetch,
      }),
      GitHub({
        clientId: "test-github",
        clientSecret: "test-github-secret",
        checks: ["pkce", "state"],
        authorization: { params: { scope: "" } },
        userinfo: {
          url: "https://api.github.com/user",
          request: async () => ({
            id: 101,
            login: "github-investigator",
            name: "GitHub Investigator",
            avatar_url: "https://avatars.githubusercontent.com/u/101",
          }),
        },
        profile: githubProfile,
        [customFetch]: mockFetch,
      }),
    ],
  });
  server.on("request", createApp({ auth }));
  function browser() {
    const cookies = new Map<string, string>();
    return {
      cookies,
      async request(path: string, options: RequestInit = {}) {
        const response = await fetch(origin + path, {
          ...options,
          redirect: "manual",
          headers: {
            cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
            ...(options.method && options.method !== "GET" ? { origin } : {}),
            ...options.headers,
          },
        });

        for (const header of response.headers.getSetCookie()) {
          for (const item of header.split(
            /,(?=\s*(?:__Secure-|__Host-)?authjs\.)/,
          )) {
            const [pair] = item.trim().split(";");
            const index = pair.indexOf("=");
            cookies.set(pair.slice(0, index), pair.slice(index + 1));
          }
        }
        return response;
      },
    };
  }
  type Browser = ReturnType<typeof browser>;
  async function start(
    client: Browser,
    provider: string,
    destination = "/analyze",
  ) {
    const csrf = await (await client.request("/api/auth/csrf")).json();
    assert.ok(csrf.csrfToken);
    const response = await client.request(`/api/auth/signin/${provider}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        callbackUrl: destination,
      }),
    });
    assert.equal(response.status, 200);
    assert.ok(
      response.headers.getSetCookie().length >= 2,
      "OAuth state and PKCE must be separate browser cookies",
    );
    const { url } = await response.json();
    const authorize = new URL(url);
    assert.ok(authorize.searchParams.get("state"));
    challenge = authorize.searchParams.get("code_challenge")!;
    assert.ok(challenge);
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    nonce = authorize.searchParams.get("nonce") || "";
    return authorize;
  }
  async function finish(
    client: Browser,
    provider: string,
    authorize: URL,
    extra = "code=test-code",
  ) {
    return client.request(
      `/api/auth/callback/${provider}?state=${encodeURIComponent(authorize.searchParams.get("state")!)}&${extra}`,
    );
  }
  const alice = browser(),
    bob = browser();
  try {
    assert.equal((await alice.request("/api/investigations")).status, 401);
    const google = await start(alice, "google");
    const complete = await finish(alice, "google", google);
    assert.equal(complete.status, 302);
    assert.equal(complete.headers.get("location"), origin + "/analyze");
    assert.match(complete.headers.get("set-cookie") || "", /HttpOnly/);
    assert.match(complete.headers.get("set-cookie") || "", /SameSite=Lax/i);
    const account = await (await alice.request("/api/account")).json();
    assert.equal(account.user.name, "Test Investigator");
    const aliceId = account.user.id;
    assert.equal(
      (await (await alice.request("/api/auth/session")).json()).user.id,
      aliceId,
    );
    assert.equal(
      (await (await alice.request("/api/account")).json()).user.id,
      aliceId,
    );
    const storedSession = (
      await pool.query('SELECT * FROM sessions WHERE "userId"=$1', [aliceId])
    ).rows[0];
    assert.notEqual(
      storedSession.sessionToken,
      alice.cookies.get("authjs.session-token"),
    );
    assert.equal(storedSession.sessionToken.length, 64);
    await pool.query('UPDATE sessions SET expires=$1 WHERE "userId"=$2', [
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      aliceId,
    ]);
    const renewed = await alice.request("/api/auth/session");
    await renewed.json();
    const renewedRecord = (
      await pool.query('SELECT expires FROM sessions WHERE "userId"=$1', [
        aliceId,
      ])
    ).rows[0];
    assert.ok(
      new Date(renewedRecord.expires).getTime() >
        Date.now() + 6.9 * 24 * 60 * 60 * 1000,
    );
    assert.match(renewed.headers.get("set-cookie") || "", /Expires=/);
    const linked = (
      await pool.query('SELECT * FROM accounts WHERE "userId"=$1', [aliceId])
    ).rows[0];
    for (const key of ["access_token", "refresh_token", "id_token"])
      assert.equal(linked[key], null);
    assert.equal(
      createHash("sha256").update(exchanges[0].verifier!).digest("base64url"),
      exchanges[0].challenge,
    );

    const github = await start(bob, "github", "/history");
    assert.equal(github.searchParams.get("scope"), "");
    assert.equal(
      (await finish(bob, "github", github)).headers.get("location"),
      origin + "/history",
    );
    const bobAccount = await (await bob.request("/api/account")).json();
    assert.equal(bobAccount.user.name, "GitHub Investigator");
    assert.notEqual(bobAccount.user.id, aliceId);

    const payload = {
      title: "Evidence test",
      text: "Sender: Send your password immediately.",
      analyzedAt: new Date().toISOString(),
    };
    const saved = await alice.request("/api/investigations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(saved.status, 201, await saved.clone().text());
    const { id } = await saved.json();
    assert.equal(
      (await (await alice.request("/api/investigations")).json()).investigations
        .length,
      1,
    );
    assert.equal(
      (await (await bob.request("/api/investigations")).json()).investigations
        .length,
      0,
    );
    assert.equal((await bob.request(`/api/investigations/${id}`)).status, 404);
    assert.equal(
      (await bob.request(`/api/investigations/${id}`, { method: "DELETE" }))
        .status,
      404,
    );
    assert.equal(
      (
        await alice.request(`/api/investigations/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: '{"user_id":"other"}',
        })
      ).status,
      400,
    );
    const detail = await (
      await alice.request(`/api/investigations/${id}`)
    ).json();
    assert.equal(detail.source_text, payload.text);
    assert.ok(
      detail.analysis.findings.some(
        (f: { kind: string }) => f.kind === "credentials",
      ),
    );
    assert.equal(
      (
        await alice.request("/api/investigations", {
          method: "POST",
          headers: {
            origin: "https://evil.test",
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await alice.request("/api/investigations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, user_id: bobAccount.user.id }),
        })
      ).status,
      400,
    );
    assert.equal(
      (await alice.request(`/api/investigations/${id}`, { method: "DELETE" }))
        .status,
      204,
    );
    assert.equal(
      (await alice.request(`/api/investigations/${id}`)).status,
      404,
    );

    const importedDraft = parseConversation(androidExport());
    const plan = selectMessages(importedDraft.messages, "all");
    const report = aggregateReport(
      plan.messages,
      plan.segments.map((s) => buildAnalysis(s.messages)),
      importedDraft.messages.length,
      plan.description,
      importedDraft.warnings,
    );
    const importedPayload = {
      kind: "imported",
      title: "Generated imported evidence",
      messages: report.messages,
      imported: report.imported,
      analyzedAt: report.provenance.analyzedAt,
    };
    const importedSave = await alice.request("/api/investigations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(importedPayload),
    });
    assert.equal(importedSave.status, 201, await importedSave.clone().text());
    const importedId = (await importedSave.json()).id;
    const renameOptions = {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Reviewed and renamed" }),
    };
    assert.equal(
      (await bob.request(`/api/investigations/${importedId}`, renameOptions))
        .status,
      404,
    );
    assert.equal(
      (await bob.request(`/api/investigations/${importedId}`)).status,
      404,
    );
    assert.equal(
      (
        await bob.request(`/api/investigations/${importedId}`, {
          method: "DELETE",
        })
      ).status,
      404,
    );
    assert.equal(
      (await alice.request(`/api/investigations/${importedId}`, renameOptions))
        .status,
      200,
    );
    const reopened = await (
      await alice.request(`/api/investigations/${importedId}`)
    ).json();
    assert.equal(reopened.title, "Reviewed and renamed");
    assert.deepEqual(reopened.analysis.imported, report.imported);
    assert.deepEqual(reopened.analysis.messages, report.messages);
    assert.equal(
      (
        await alice.request("/api/investigations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...importedPayload,
            imported: { ...report.imported, analyzedIds: ["unowned-id"] },
          }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await alice.request(`/api/investigations/${importedId}`, {
          method: "DELETE",
        })
      ).status,
      204,
    );

    const csrf = await (await alice.request("/api/auth/csrf")).json();
    const logout = await alice.request("/api/auth/signout", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken }),
    });
    assert.equal(logout.status, 200);
    assert.equal(
      (await (await alice.request("/api/account")).json()).user,
      null,
    );
    assert.equal(
      (await pool.query('SELECT * FROM sessions WHERE "userId"=$1', [aliceId]))
        .rowCount,
      0,
    );
    const returning = await start(alice, "google");
    await finish(alice, "google", returning);
    assert.equal(
      (await (await alice.request("/api/account")).json()).user.id,
      aliceId,
    );
    assert.equal((await pool.query("SELECT * FROM users")).rowCount, 2);
    await pool.query('UPDATE sessions SET expires=$1 WHERE "userId"=$2', [
      new Date(Date.now() - 1000),
      aliceId,
    ]);
    assert.equal((await alice.request("/api/investigations")).status, 401);
    assert.equal(
      (await (await alice.request("/api/account")).json()).user,
      null,
    );

    subject = "different-google-identity";
    const collision = browser();
    const collisionStart = await start(collision, "google");
    assert.match(
      (await finish(collision, "google", collisionStart)).headers.get(
        "location",
      ) || "",
      /OAuthAccountNotLinked/,
    );
    assert.equal((await pool.query("SELECT * FROM users")).rowCount, 2);
    verified = false;
    const unverified = browser();
    const unverifiedStart = await start(unverified, "google");
    await finish(unverified, "google", unverifiedStart);
    const unverifiedUser = (
      await (await unverified.request("/api/account")).json()
    ).user;
    assert.notEqual(unverifiedUser.id, aliceId);
    assert.equal(
      (
        await pool.query("SELECT email FROM users WHERE id=$1", [
          unverifiedUser.id,
        ])
      ).rows[0].email,
      null,
    );
    subject = "google-first";
    verified = true;
    await pool.query("DELETE FROM auth_rate_limits");

    const cancelled = await start(alice, "google");
    assert.match(
      (
        await finish(alice, "google", cancelled, "error=access_denied")
      ).headers.get("location") || "",
      /\/login\?error=/,
    );
    assert.equal(
      (await (await alice.request("/api/account")).json()).user,
      null,
    );
    const badState = await start(alice, "google");
    assert.ok(badState);
    assert.match(
      (
        await alice.request("/api/auth/callback/google?code=test&state=invalid")
      ).headers.get("location") || "",
      /error=/,
    );
    const providerError = await start(alice, "google");
    failToken = true;
    assert.match(
      (await finish(alice, "google", providerError)).headers.get("location") ||
        "",
      /error=/,
    );
    failToken = false;

    await pool.query("DELETE FROM auth_rate_limits");
    const external = await start(alice, "google", "https://evil.test/steal");
    assert.equal(
      (await finish(alice, "google", external)).headers.get("location"),
      origin + "/history",
    );
    const noCsrf = await alice.request("/api/auth/signout", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: "csrfToken=wrong",
    });
    assert.match(JSON.stringify(await noCsrf.json()), /MissingCSRF/);
    assert.ok((await (await alice.request("/api/account")).json()).user);
    const badHost = await new Promise<number>((resolve) => {
      const request = httpRequest(
        origin + "/api/auth/csrf",
        { headers: { host: "evil.test" } },
        (response) => {
          response.resume();
          resolve(response.statusCode!);
        },
      );
      request.end();
    });
    assert.equal(badHost, 400);
    for (let i = 0; i < 21; i++)
      await alice.request("/api/auth/signin/google", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "csrfToken=wrong",
      });
    const limited = await alice.request("/api/auth/signin/google", {
      method: "POST",
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

test("missing credentials fail closed while guest analysis remains public", async () => {
  const auth = createAuth({ secret: "" });
  auth.ready = false;
  const server = createApp({ auth }).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(base + "/api/auth/csrf")).status, 503);
    assert.equal((await fetch(base + "/api/investigations")).status, 503);
    assert.equal(
      (await (await fetch(base + "/api/account")).json()).configured,
      false,
    );
    assert.equal(
      (
        await fetch(base + "/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: "Sender: Hello, how are you?",
            mode: "local",
          }),
        })
      ).status,
      200,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
