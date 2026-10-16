import ts from "typescript";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve("artifacts/serverless-runtime");
for (const file of [
  "api/index.ts",
  "server/app.ts",
  "server/auth.ts",
  "server/database.ts",
  "server/investigations.ts",
  "server/import-ai.ts",
  "server/import-routes.ts",
  "shared/import.ts",
  "shared/screenshots.ts",
  "shared/auth.ts",
  "shared/engine.ts",
  "shared/schema.ts",
  "shared/constants.ts",
  "shared/actions.ts",
]) {
  const output = path.join(root, file.replace(/\.ts$/, ".js"));
  await mkdir(path.dirname(output), { recursive: true });
  const { outputText } = ts.transpileModule(await readFile(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  await writeFile(output, outputText);
}
process.env.NODE_ENV = "production";
const { default: app } = await import(
  pathToFileURL(path.join(root, "api/index.js")).href
);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
});
try {
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/status`,
  );
  assert.equal(response.status, 200);
  assert.ok(
    response.headers
      .get("content-security-policy")
      .includes("script-src 'self'"),
  );
  console.log(
    JSON.stringify({
      check: "separate-file ESM serverless entrypoint",
      status: response.status,
      passed: true,
    }),
  );
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
