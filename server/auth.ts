import { ExpressAuth, AuthError, type ExpressAuthConfig } from "@auth/express";
import Google from "@auth/express/providers/google";
import GitHub from "@auth/express/providers/github";
import type { Adapter } from "@auth/core/adapters";
import type { Request, Response, Express } from "express";
import { createHmac } from "node:crypto";
import type pg from "pg";
import { databasePool, privateAdapter } from "./database.js";
import { profileImage, safeDestination } from "../shared/auth.js";

export type AuthRuntime = {
  pool?: pg.Pool;
  adapter?: Adapter;
  config: ExpressAuthConfig;
  origin: string;
  secret: string;
  cookieName: string;
  providers: { google: boolean; github: boolean };
  ready: boolean;
};

export const googleProfile = (p: {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}) => ({
  id: p.sub,
  name: p.name?.slice(0, 120) ?? null,
  email: p.email_verified === true ? (p.email ?? null) : null,
  image: profileImage(p.picture),
});
export const githubProfile = (p: {
  id: number;
  name?: string | null;
  login: string;
  avatar_url?: string;
}) => ({
  id: String(p.id),
  name: (p.name || p.login).slice(0, 120),

  email: null,
  image: profileImage(p.avatar_url),
});

export function createAuth(
  options: {
    pool?: pg.Pool;
    origin?: string;
    secret?: string;
    providers?: ExpressAuthConfig["providers"];
  } = {},
): AuthRuntime {
  const pool = options.pool ?? databasePool();
  const secret = options.secret ?? process.env.AUTH_SECRET ?? "";
  let origin = "http://localhost:3000";
  let validOrigin: boolean;
  try {
    const configured = new URL(
      options.origin ?? process.env.AUTH_URL ?? origin,
    );
    validOrigin =
      ["http:", "https:"].includes(configured.protocol) &&
      !configured.username &&
      !configured.password &&
      configured.pathname === "/" &&
      !configured.search &&
      !configured.hash;
    origin = configured.origin;
  } catch {
    validOrigin = false;
  }
  const providers = {
    google: Boolean(
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
    ),
    github: Boolean(
      process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
    ),
  };
  const configuredProviders = options.providers ?? [
    ...(providers.google
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            checks: ["pkce", "state", "nonce"],
            authorization: { params: { scope: "openid email profile" } },
            profile: googleProfile,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
    ...(providers.github
      ? [
          GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
            checks: ["pkce", "state"],
            authorization: { params: { scope: "" } },
            userinfo: {
              url: "https://api.github.com/user",
              async request({ tokens }: { tokens: { access_token?: string } }) {
                const response = await fetch("https://api.github.com/user", {
                  headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                    "User-Agent": "chainbreak-zero",
                    Accept: "application/vnd.github+json",
                  },
                  signal: AbortSignal.timeout(10_000),
                });
                if (!response.ok)
                  throw new Error("Provider profile unavailable");
                return response.json();
              },
            },
            profile: githubProfile,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ];
  if (options.providers) {
    for (const provider of options.providers) {
      const id = typeof provider === "function" ? provider().id : provider.id;
      if (id === "google" || id === "github") providers[id] = true;
    }
  }
  const adapter = pool ? privateAdapter(pool) : undefined;
  const secure = origin.startsWith("https://");
  const cookieName = secure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const ready = Boolean(
    pool &&
    validOrigin &&
    secret.length >= 32 &&
    configuredProviders.length &&
    (process.env.NODE_ENV !== "production" || secure),
  );
  const config: ExpressAuthConfig = {
    adapter,
    secret,
    providers: configuredProviders,
    basePath: "/api/auth",
    trustHost: true,
    useSecureCookies: secure,
    session: {
      strategy: "database",
      maxAge: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    cookies: {
      sessionToken: {
        name: cookieName,
        options: { httpOnly: true, sameSite: "lax", path: "/", secure },
      },
    },
    pages: { signIn: "/login", error: "/login" },
    callbacks: {
      async redirect({ url }) {
        try {
          const target = new URL(url, origin);
          return (
            origin +
            (target.origin === origin
              ? safeDestination(target.pathname + target.search)
              : "/history")
          );
        } catch {
          return origin + "/history";
        }
      },
      async session({ session, user }) {
        return {
          expires: session.expires,
          user: {
            id: user.id,
            name: user.name,
            image: profileImage(user.image),
          },
        };
      },
    },

    logger: {
      error(error) {
        console.error(
          JSON.stringify({
            event: "auth_error",
            code: error instanceof AuthError ? error.type : "Unknown",
          }),
        );
      },
      warn(code) {
        console.warn(JSON.stringify({ event: "auth_warning", code }));
      },
      debug() {},
    },
  };
  return {
    pool,
    adapter,
    origin,
    secret,
    cookieName,
    config,
    providers,
    ready,
  };
}

function sessionToken(req: Request, auth: AuthRuntime) {
  const item = req.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(auth.cookieName + "="));
  if (!item) return null;
  try {
    const value = decodeURIComponent(item.slice(auth.cookieName.length + 1));
    return value.length < 256 ? value : null;
  } catch {
    return null;
  }
}
export async function currentUser(req: Request, auth: AuthRuntime) {
  const token = sessionToken(req, auth);
  if (!auth.ready || !token) return null;
  const result = await auth.adapter!.getSessionAndUser!(token);
  if (!result) return null;
  if (new Date(result.session.expires).getTime() <= Date.now()) {
    await auth.adapter!.deleteSession!(token);
    return null;
  }
  return {
    id: String(result.user.id),
    name: result.user.name,
    image: profileImage(result.user.image),
    expires: result.session.expires,
  };
}
export function sameOrigin(req: Request, auth: AuthRuntime) {
  return (
    req.headers.origin === auth.origin &&
    req.headers["sec-fetch-site"] !== "cross-site"
  );
}
export async function withinLimit(
  auth: AuthRuntime,
  key: string,
  limit: number,
) {
  if (!auth.pool) return true;
  const bucket = createHmac("sha256", auth.secret).update(key).digest("hex");
  const now = Date.now();
  const result = await auth.pool.query(
    `INSERT INTO auth_rate_limits (bucket_key,hits,reset_at) VALUES ($1,1,$2)
    ON CONFLICT (bucket_key) DO UPDATE SET hits = CASE WHEN auth_rate_limits.reset_at <= $3 THEN 1 ELSE auth_rate_limits.hits + 1 END,
    reset_at = CASE WHEN auth_rate_limits.reset_at <= $3 THEN $2 ELSE auth_rate_limits.reset_at END RETURNING hits`,
    [bucket, now + 60_000, now],
  );
  return result.rows[0].hits <= limit;
}
export function authUnavailable(res: Response) {
  res.status(503).json({
    error:
      "Sign-in is not configured yet. You can still explore the public demonstration.",
  });
}

export function mountAuth(app: Express, auth: AuthRuntime) {
  app.get("/api/account", async (req, res) => {
    try {
      if (auth.ready && !(await withinLimit(auth, `account:${req.ip}`, 120))) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({
          error: "Session check limit reached. Wait one minute and retry.",
        });
        return;
      }
      const user = await currentUser(req, auth);
      res.json({
        user,
        configured: auth.ready,
        providers: {
          google: auth.ready && auth.providers.google,
          github: auth.ready && auth.providers.github,
        },
      });
    } catch {
      res.status(503).json({
        error: "Your session could not be checked. Retry in a moment.",
      });
    }
  });
  app.use("/api/auth", async (req, res, next) => {
    if (!auth.ready) {
      authUnavailable(res);
      return;
    }

    if (req.get("host") !== new URL(auth.origin).host) {
      res.status(400).json({ error: "Invalid authentication host." });
      return;
    }
    if (req.method === "POST" && !sameOrigin(req, auth)) {
      res.status(403).json({ error: "Return to this site and retry sign-in." });
      return;
    }
    try {
      const sensitive = /\/(signin|callback|signout)/.test(req.path);
      if (
        !(await withinLimit(
          auth,
          `auth:${sensitive ? "write" : "read"}:${req.ip}`,
          sensitive ? 20 : 120,
        ))
      ) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({
          error: "Too many sign-in attempts. Wait one minute and retry.",
        });
        return;
      }

      req.headers["x-forwarded-host"] = new URL(auth.origin).host;
      req.headers["x-forwarded-proto"] = new URL(auth.origin).protocol.slice(
        0,
        -1,
      );
      await ExpressAuth(auth.config)(req, res, next);
    } catch {
      res
        .status(503)
        .json({ error: "Sign-in is temporarily unavailable. Please retry." });
    }
  });
}
