import "dotenv/config";
import express from "express";
import compression from "compression";
import path from "node:path";
import { createApp } from "./app";

const production =
  process.env.NODE_ENV === "production" ||
  process.argv[1]?.endsWith("server.mjs");
if (production) process.env.NODE_ENV = "production";
const app = createApp();
if (production) {
  app.use(compression());
  app.use(
    express.static(path.resolve("dist"), {
      index: false,
      setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`))
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );
  app.get("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve("dist/index.html"));
  });
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () =>
  console.log(`VEYRA is available at http://localhost:${port}`),
);
